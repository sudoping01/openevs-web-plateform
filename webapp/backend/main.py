import asyncio
import json
import os
import time
from collections import deque
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional

import paho.mqtt.client as mqtt
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Query, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# ── Config ────────────────────────────────────────────────────────────────────
MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USER = os.getenv("MQTT_USER", "test")
MQTT_PASS = os.getenv("MQTT_PASS", "test")
MQTT_BASE_TOPIC = os.getenv("MQTT_BASE_TOPIC", "DAUSTCharger/openevse")

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "openevse")
RATE_CFA_PER_KWH = int(os.getenv("RATE_CFA_PER_KWH", "100"))

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production-use-a-long-random-secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24h

# ── Rate limiter ──────────────────────────────────────────────────────────────
def _get_real_ip(request: Request) -> str:
    """Respect X-Forwarded-For set by nginx so each client IP is bucketed separately."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

limiter = Limiter(key_func=_get_real_ip)

# ── Auth utilities ────────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ── Pydantic models ───────────────────────────────────────────────────────────
class TopupRequest(BaseModel):
    amount_cfa: int


class ProfileUpdate(BaseModel):
    email: Optional[str] = None
    car_name: Optional[str] = None
    profile_pic: Optional[str] = None   # base64 data URL
    car_pic: Optional[str] = None       # base64 data URL


class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    car_name: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    username: str
    email: str
    car_name: Optional[str] = None


# ── Shared state ──────────────────────────────────────────────────────────────
evse_state: dict = {}
power_history: deque = deque(maxlen=120)
connected_clients: set[WebSocket] = set()
active_sessions: dict = {}  # username -> {start_energy_wh, start_time}

_mqtt_client: mqtt.Client | None = None
_event_loop: asyncio.AbstractEventLoop | None = None
_mongo_client: AsyncIOMotorClient | None = None
_db = None


# ── MongoDB helpers ───────────────────────────────────────────────────────────
async def get_user_by_username(username: str):
    return await _db.users.find_one({"username": username})


async def get_user_by_email(email: str):
    return await _db.users.find_one({"email": email})


async def create_user(username: str, email: str, password: str, car_name: str = None) -> dict:
    doc = {
        "username": username,
        "email": email,
        "hashed_password": hash_password(password),
        "created_at": datetime.utcnow(),
        "role": "user",
        "car_name": car_name or "",
        "balance_cfa": 0,
    }
    result = await _db.users.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


async def log_billing_transaction(username: str, tx_type: str, amount_cfa: int, kwh: float = 0.0, session_energy_wh: float = 0.0):
    await _db.transactions.insert_one({
        "username": username,
        "type": tx_type,           # "charge" | "topup"
        "amount_cfa": amount_cfa,  # negative for charges, positive for topups
        "kwh": round(kwh, 4),
        "session_energy_wh": session_energy_wh,
        "timestamp": datetime.utcnow(),
    })


async def log_event(command: str, username: str, meta: dict = None):
    """Log a charger command event to MongoDB."""
    await _db.events.insert_one({
        "command": command,
        "username": username,
        "timestamp": datetime.utcnow(),
        "meta": meta or {},
        "evse_snapshot": {
            "state": evse_state.get("state"),
            "power": evse_state.get("power"),
            "amp": evse_state.get("amp"),
        },
    })


# ── JWT dependency ────────────────────────────────────────────────────────────
async def decode_token(token: str) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = await get_user_by_username(username)
    if not user:
        raise credentials_exception
    return user


async def require_auth(authorization: Optional[str] = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = authorization.removeprefix("Bearer ")
    return await decode_token(token)


# ── MQTT callbacks ────────────────────────────────────────────────────────────
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"[MQTT] Connected to {MQTT_HOST}:{MQTT_PORT}")
        client.subscribe(f"{MQTT_BASE_TOPIC}/#")
        client.subscribe("openevse/announce/#")
    else:
        print(f"[MQTT] Connection failed, rc={rc}")


def on_disconnect(client, userdata, rc):
    print(f"[MQTT] Disconnected, rc={rc}")


def on_message(client, userdata, msg: mqtt.MQTTMessage):
    try:
        payload_str = msg.payload.decode("utf-8")
    except Exception:
        return

    subtopic = msg.topic.removeprefix(f"{MQTT_BASE_TOPIC}/")

    try:
        value = json.loads(payload_str)
    except json.JSONDecodeError:
        value = payload_str

    evse_state[subtopic] = value

    if subtopic == "power":
        try:
            power_history.append({"t": int(time.time() * 1000), "v": float(payload_str)})
        except ValueError:
            pass

    if _event_loop and not _event_loop.is_closed():
        asyncio.run_coroutine_threadsafe(
            _broadcast(json.dumps({"type": "update", "topic": subtopic, "value": value})),
            _event_loop,
        )


# ── WebSocket broadcast ───────────────────────────────────────────────────────
async def _broadcast(message: str):
    dead: set[WebSocket] = set()
    for ws in connected_clients:
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)
    connected_clients.difference_update(dead)


# ── App lifecycle ─────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _mqtt_client, _event_loop, _mongo_client, _db
    _event_loop = asyncio.get_event_loop()

    # MongoDB
    _mongo_client = AsyncIOMotorClient(MONGO_URL)
    _db = _mongo_client[MONGO_DB]
    await _db.users.create_index("username", unique=True)
    await _db.users.create_index("email", unique=True)
    # Auto-expire events after 90 days; also serves as an index for sorted queries
    await _db.events.create_index("timestamp", expireAfterSeconds=7776000, name="events_ttl")
    await _db.transactions.create_index([("username", 1), ("timestamp", -1)])
    await _db.transactions.create_index("timestamp", expireAfterSeconds=31536000, name="transactions_ttl")  # 1yr
    print(f"[MongoDB] Connected to {MONGO_URL}/{MONGO_DB}")

    # MQTT
    _mqtt_client = mqtt.Client(client_id="openevse-webapp")
    _mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)
    _mqtt_client.on_connect = on_connect
    _mqtt_client.on_disconnect = on_disconnect
    _mqtt_client.on_message = on_message

    try:
        _mqtt_client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
        _mqtt_client.loop_start()
    except Exception as e:
        print(f"[MQTT] Failed to connect: {e}")

    yield

    _mqtt_client.loop_stop()
    _mqtt_client.disconnect()
    _mongo_client.close()


app = FastAPI(title="OpenEVSE Manager", lifespan=lifespan)

# Rate limiter exception handler (must be before CORS middleware registration)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health check (public) ─────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "mqtt_connected": _mqtt_client is not None and _mqtt_client.is_connected(),
    }


# ── Auth endpoints (public, rate-limited) ─────────────────────────────────────
@app.post("/api/auth/register", response_model=Token)
@limiter.limit("5/minute")
async def register(request: Request, data: UserRegister):
    if len(data.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if "@" not in data.email:
        raise HTTPException(status_code=400, detail="Invalid email address")

    if await get_user_by_username(data.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    if await get_user_by_email(data.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    user = await create_user(data.username, data.email, data.password, data.car_name)
    token = create_access_token({"sub": user["username"]})
    return Token(access_token=token, token_type="bearer", username=user["username"], email=user["email"], car_name=user["car_name"])


@app.post("/api/auth/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, data: UserLogin):
    user = await get_user_by_username(data.username)
    if not user:
        user = await get_user_by_email(data.username)
    if not user or not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token({"sub": user["username"]})
    return Token(access_token=token, token_type="bearer", username=user["username"], email=user["email"])


@app.get("/api/auth/me")
async def me(user: dict = Depends(require_auth)):
    created_at = user.get("created_at")
    return {
        "username": user["username"],
        "email": user["email"],
        "role": user.get("role", "user"),
        "car_name": user.get("car_name", ""),
        "profile_pic": user.get("profile_pic"),
        "car_pic": user.get("car_pic"),
        "created_at": created_at.isoformat() if created_at else None,
    }


@app.patch("/api/auth/me")
async def update_profile(data: ProfileUpdate, user: dict = Depends(require_auth)):
    updates = {}
    if data.email is not None:
        if "@" not in data.email:
            raise HTTPException(status_code=400, detail="Invalid email address")
        existing = await get_user_by_email(data.email)
        if existing and existing["username"] != user["username"]:
            raise HTTPException(status_code=400, detail="Email already in use")
        updates["email"] = data.email
    if data.car_name is not None:
        updates["car_name"] = data.car_name
    if data.profile_pic is not None:
        if len(data.profile_pic) > 600_000:
            raise HTTPException(status_code=400, detail="Profile picture too large (max ~450 KB)")
        updates["profile_pic"] = data.profile_pic
    if data.car_pic is not None:
        if len(data.car_pic) > 600_000:
            raise HTTPException(status_code=400, detail="Car picture too large (max ~450 KB)")
        updates["car_pic"] = data.car_pic
    if updates:
        await _db.users.update_one({"username": user["username"]}, {"$set": updates})
    updated = await get_user_by_username(user["username"])
    created_at = updated.get("created_at")
    return {
        "username": updated["username"],
        "email": updated["email"],
        "role": updated.get("role", "user"),
        "car_name": updated.get("car_name", ""),
        "profile_pic": updated.get("profile_pic"),
        "car_pic": updated.get("car_pic"),
        "created_at": created_at.isoformat() if created_at else None,
    }


# ── EVSE status (protected) ───────────────────────────────────────────────────
@app.get("/api/status")
async def get_status(user: dict = Depends(require_auth)):
    return {"state": evse_state, "power_history": list(power_history)}


# ── Events endpoint (protected) ───────────────────────────────────────────────
@app.get("/api/events")
async def get_events(
    limit: int = Query(default=50, ge=1, le=500),
    user: dict = Depends(require_auth),
):
    cursor = _db.events.find({"username": user["username"]}, {"_id": 0}).sort("timestamp", -1).limit(limit)
    events = await cursor.to_list(length=limit)
    for e in events:
        if isinstance(e.get("timestamp"), datetime):
            e["timestamp"] = e["timestamp"].isoformat()
    return {"events": events}


# ── EVSE commands (protected) ─────────────────────────────────────────────────
@app.post("/api/command/start")
async def start_charging(user: dict = Depends(require_auth)):
    _mqtt_client.publish(f"{MQTT_BASE_TOPIC}/override/set", json.dumps({"state": "active"}))
    await log_event("start", user["username"])
    return {"ok": True, "command": "start"}


@app.post("/api/command/stop")
async def stop_charging(user: dict = Depends(require_auth)):
    _mqtt_client.publish(f"{MQTT_BASE_TOPIC}/override/set", json.dumps({"state": "disabled"}))
    await log_event("stop", user["username"])
    return {"ok": True, "command": "stop"}


@app.post("/api/command/clear")
async def clear_override(user: dict = Depends(require_auth)):
    _mqtt_client.publish(f"{MQTT_BASE_TOPIC}/override/set", "clear")
    await log_event("clear_override", user["username"])
    return {"ok": True, "command": "clear_override"}


@app.post("/api/command/current/{amps}")
async def set_current(amps: int, user: dict = Depends(require_auth)):
    if not 6 <= amps <= 32:
        return {"ok": False, "error": "Current must be between 6 and 32 A"}
    _mqtt_client.publish(f"{MQTT_BASE_TOPIC}/rapi/in/$SC", str(amps))
    await log_event("set_current", user["username"], {"amps": amps})
    return {"ok": True, "command": f"set_current_{amps}A"}


@app.post("/api/command/divert/{mode}")
async def set_divert_mode(mode: int, user: dict = Depends(require_auth)):
    if mode not in (1, 2):
        return {"ok": False, "error": "Mode must be 1 (eco/divert) or 2 (fast)"}
    _mqtt_client.publish(f"{MQTT_BASE_TOPIC}/divertmode/set", str(mode))
    await log_event("set_divert", user["username"], {"mode": mode, "label": "eco" if mode == 1 else "fast"})
    return {"ok": True, "command": f"divert_mode_{mode}"}


@app.post("/api/command/restart/{target}")
async def restart(target: str, user: dict = Depends(require_auth)):
    if target not in ("gateway", "evse"):
        return {"ok": False, "error": "target must be 'gateway' or 'evse'"}
    _mqtt_client.publish(f"{MQTT_BASE_TOPIC}/restart", json.dumps({"device": target}))
    await log_event("restart", user["username"], {"target": target})
    return {"ok": True, "command": f"restart_{target}"}


# ── Balance endpoints (protected) ────────────────────────────────────────────
@app.get("/api/balance")
async def get_balance(
    limit: int = Query(default=50, ge=1, le=200),
    user: dict = Depends(require_auth),
):
    cursor = _db.transactions.find(
        {"username": user["username"]}, {"_id": 0}
    ).sort("timestamp", -1).limit(limit)
    transactions = await cursor.to_list(length=limit)
    for tx in transactions:
        if isinstance(tx.get("timestamp"), datetime):
            tx["timestamp"] = tx["timestamp"].isoformat()
    return {
        "balance_cfa": user.get("balance_cfa", 0),
        "rate_cfa_per_kwh": RATE_CFA_PER_KWH,
        "transactions": transactions,
    }


@app.post("/api/balance/topup")
async def topup_balance(data: TopupRequest, user: dict = Depends(require_auth)):
    if data.amount_cfa <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if data.amount_cfa > 500_000:
        raise HTTPException(status_code=400, detail="Amount exceeds maximum top-up limit (500 000 CFA)")

    new_balance = user.get("balance_cfa", 0) + data.amount_cfa
    await _db.users.update_one(
        {"username": user["username"]},
        {"$set": {"balance_cfa": new_balance}},
    )
    await log_billing_transaction(
        username=user["username"],
        tx_type="topup",
        amount_cfa=data.amount_cfa,
    )
    return {"ok": True, "balance_cfa": new_balance}


# ── WebSocket endpoint (auth via ?token= query param) ─────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(default="")):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            await websocket.close(code=4001)
            return
    except JWTError:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    connected_clients.add(websocket)

    await websocket.send_text(json.dumps({
        "type": "snapshot",
        "state": evse_state,
        "power_history": list(power_history),
    }))

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
