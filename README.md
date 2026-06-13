# OpenEVSE Web Platform

A self-hosted web platform for monitoring and controlling [OpenEVSE](https://openevse.com) charging hardware. It connects to the device over MQTT, exposes a REST and WebSocket API, and serves a browser dashboard with real-time metrics, charging controls, an event log, and a per-user balance system.

## Hardware

This platform is built around the [OpenEVSE](https://openevse.com) open-source EV charging station. The device runs an [ESP32 WiFi gateway](https://github.com/OpenEVSE/ESP32_WiFi_V4.x) that publishes state and telemetry over MQTT and accepts commands on the same broker. The gateway firmware documentation is at [openevse.github.io](https://openevse.github.io).

The relevant MQTT protocol is documented in the [OpenEVSE MQTT guide](https://github.com/OpenEVSE/ESP32_WiFi_V4.x/blob/master/docs/mqtt.md). Charging commands use the [RAPI protocol](https://github.com/OpenEVSE/open_evse/blob/develop/firmware/open_evse/rapi_proc.h).

## Architecture

```
OpenEVSE device (ESP32)
        |
        | MQTT (publish telemetry / receive commands)
        |
  Mosquitto broker  :1883
        |
  FastAPI backend   :8001
  - MQTT subscriber
  - WebSocket bridge
  - REST API
  - JWT auth
  - MongoDB (users, events, balance)
        |
  React frontend    :3000
  - Real-time dashboard
  - Charging controls
  - Events log
  - Balance / top-up
```

| Service | Base image | Host port |
|---|---|---|
| `mqtt-broker` | eclipse-mosquitto 2.0.20 | 1883 |
| `backend` | python:3.12-slim | 8001 |
| `frontend` | nginx:1.27-alpine | 3000 |
| `mongodb` | mongo:7 | internal only |

## Requirements

- [Docker](https://docs.docker.com/get-docker/) with the Compose plugin

## Quick start

```bash
git clone https://github.com/sudoping01/openevs-web-plateform
cd openevs-web-plateform
docker compose up -d
```

Open `http://localhost:3000` in a browser, create an account, and log in.

## Configuration

Create a `.env` file at the project root. All variables are optional; defaults are shown.

```env
# MQTT broker credentials
MQTT_USER=openevse
MQTT_PASS=openevse

# Must match the base topic configured on the OpenEVSE device
MQTT_BASE_TOPIC=openevse/openevse

# JWT signing secret — change this in any non-local deployment
SECRET_KEY=change-me-in-production-use-a-long-random-secret

# Session lifetime in minutes (default 24 h)
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Energy price used for the balance system
RATE_CFA_PER_KWH=100
```

## Connecting the OpenEVSE device

On the device web interface go to **Services → MQTT** and set:

| Field | Value |
|---|---|
| Server | IP address of the machine running this stack |
| Port | `1883` |
| Username | value of `MQTT_USER` |
| Password | value of `MQTT_PASS` |
| Base topic | value of `MQTT_BASE_TOPIC` |

The ESP32 firmware documentation covers this in detail: [ESP32 WiFi gateway — MQTT setup](https://github.com/OpenEVSE/ESP32_WiFi_V4.x#mqtt).

Once the device connects and starts publishing, the dashboard will update in real time.

## Features

**Dashboard** — live state badge, current / voltage / power / pilot readings, session energy and duration, lifetime energy counter, and a rolling power chart of the last ~60 minutes.

**Controls** — start and stop charging, clear a manual override, set charge current (6–32 A via RAPI `$SC`), switch between Eco (solar divert) and Fast modes, and restart the gateway or EVSE module.

**Events** — paginated log of commands sent through the platform, stored in MongoDB and scoped to the authenticated user.

**Balance** — per-user credit balance. Energy cost is deducted automatically when a charging session is stopped. Users can top up their balance through the platform. The rate is set with `RATE_CFA_PER_KWH`.

## API

The backend API is accessible at port 8001 directly or via the frontend nginx proxy at `/api`.

```
POST /api/auth/register
POST /api/auth/token
GET  /api/auth/me

GET  /api/status                    Full state snapshot and power history
GET  /api/events                    Charging event log (paginated)
GET  /api/balance                   User balance and transaction history

POST /api/command/start             Start charging
POST /api/command/stop              Stop charging and deduct energy cost
POST /api/command/clear             Clear manual override
POST /api/command/current/{amps}    Set charge current (6–32 A)
POST /api/command/divert/{mode}     Divert mode: 1 = eco, 2 = fast
POST /api/command/restart/{target}  Restart: gateway or evse

POST /api/balance/topup             Credit a user's balance

WS   /ws                            Real-time MQTT updates
```


## License

MIT
