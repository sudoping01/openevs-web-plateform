import { useCallback } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { ToastContainer, useToast } from "../hooks/useToast.jsx";
import { EVSE_STATES, fmtEnergy, fmtElapsed } from "../utils/evse.js";
import PowerChart from "../components/PowerChart.jsx";
import ControlPanel from "../components/ControlPanel.jsx";
import "./Dashboard.css";

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, unit, color, highlight, loading }) {
  if (loading) {
    return (
      <div className="metric-card">
        <div className="skeleton" style={{ height: 9, width: "55%", marginBottom: 14 }} />
        <div className="skeleton" style={{ height: 28, width: "65%" }} />
      </div>
    );
  }
  return (
    <div className={`metric-card ${highlight ? "metric-card--active" : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: color || "var(--text)" }}>
        {value}
        {unit && <span className="metric-unit">{unit}</span>}
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ state, loading }) {
  if (loading) {
    return <div className="skeleton" style={{ height: 30, width: 140, borderRadius: 2 }} />;
  }
  const st = EVSE_STATES[parseInt(state)] ?? EVSE_STATES[0];
  return (
    <div className="status-badge" style={{ borderColor: `${st.color}50`, color: st.color, background: `${st.color}08` }}>
      <span className="status-dot" style={{ background: st.color, boxShadow: `0 0 6px ${st.color}` }} />
      {st.label}
    </div>
  );
}

// ── Charging ring (140×140, rotating outer dashed ring when charging) ─────────
function ChargingRing({ isCharging, amp, pilot }) {
  const pct = pilot > 0 ? Math.min(amp / pilot, 1) : 0;
  const cx = 70, cy = 70;
  const rOuter = 62;
  const r = 50;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const color = isCharging ? "var(--amber)" : "var(--border-lit)";
  const textColor = isCharging ? "#f5a623" : "#444444";

  return (
    <div className="charging-ring-wrap" title={`${amp.toFixed(1)} / ${pilot} A`}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <defs>
          <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* Outer rotating dashed ring — only when charging */}
        {isCharging && (
          <circle
            cx={cx} cy={cy} r={rOuter}
            fill="none"
            stroke="rgba(245,166,35,0.25)"
            strokeWidth="1.5"
            strokeDasharray="5 9"
            className="ring-outer-rotating"
          />
        )}

        {/* Outer static ring */}
        <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="var(--border)" strokeWidth="1" />

        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="8" />

        {/* Progress arc */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={isCharging ? offset : circ}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{
            transition: "stroke-dashoffset 1s ease, stroke 0.4s ease",
            filter: isCharging ? "url(#ringGlow)" : "none",
          }}
        />

        {/* Inner subtle ring */}
        <circle cx={cx} cy={cy} r={36} fill="none" stroke="var(--border)" strokeWidth="1" />

        {/* Center: amp value */}
        <text
          x={cx} y={cy - 8}
          textAnchor="middle"
          fontSize="26"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
          fill={textColor}
          letterSpacing="-1"
        >
          {isCharging ? amp.toFixed(0) : "—"}
        </text>

        {/* Center: AMPS / OFF label */}
        <text
          x={cx} y={cy + 12}
          textAnchor="middle"
          fontSize="10"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
          fill={isCharging ? "#7a5010" : "#2e2e2e"}
          letterSpacing="0.14em"
        >
          {isCharging ? "AMPS" : "OFF"}
        </text>

        {/* Center: /pilotA */}
        {isCharging && (
          <text
            x={cx} y={cy + 28}
            textAnchor="middle"
            fontSize="9"
            fontFamily="'JetBrains Mono', monospace"
            fontWeight="400"
            fill="#3a3a3a"
            letterSpacing="0.06em"
          >
            /{pilot}A
          </text>
        )}
      </svg>
      {isCharging && <div className="ring-glow" />}
    </div>
  );
}

// ── Connection pill ───────────────────────────────────────────────────────────
function ConnPill({ label, active, color }) {
  return (
    <div className="conn-pill" style={{
      borderColor: active ? `${color}60` : "var(--border)",
      color: active ? color : "var(--text-muted)",
      background: active ? `${color}08` : "transparent",
    }}>
      <span className="conn-pill-dot" style={{ background: active ? color : "var(--border-lit)" }} />
      {label}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children, charging }) {
  return (
    <section className={`dash-section ${charging ? "dash-section--charging" : ""}`}>
      <div className="dash-section-header">
        <div className="dash-section-title">{title}</div>
      </div>
      {children}
    </section>
  );
}

// ── Dashboard page ────────────────────────────────────────────────────────────
export default function Dashboard({ evse, powerHistory, wsStatus }) {
  const { authFetch } = useAuth();
  const { toasts, addToast } = useToast();

  const loading = wsStatus === "connecting" && Object.keys(evse).length === 0;

  const send = useCallback(async (path, successMsg) => {
    try {
      const res = await authFetch(`/api/command/${path}`, { method: "POST" });
      const data = await res.json();
      if (data.ok) addToast(successMsg || "Command sent", "success");
      else addToast(data.error || "Command failed", "error");
    } catch (err) {
      addToast(err.message || "Request failed", "error");
    }
  }, [authFetch, addToast]);

  const deviceName  = evse["config"]?.hostname ?? "openevse";
  const evseConn    = evse["evse_connected"] === "1" || evse["evse_connected"] === 1;
  const state       = evse["state"] ?? "0";
  const isCharging  = parseInt(state) === 3;

  const amp     = parseFloat(evse["amp"]) || 0;
  const voltage = parseFloat(evse["voltage"]) || 0;
  const power   = parseFloat(evse["power"]) || 0;
  const pilot   = parseFloat(evse["pilot"]) || 32;

  const sessionEnergy  = evse["session_energy"] ?? "0";
  const sessionElapsed = evse["session_elapsed"] ?? evse["elapsed"] ?? "0";
  const totalEnergy    = evse["total_energy"] ?? "0";

  const hasTemp = evse["temp"] !== undefined;
  const temp  = evse["temp"]  != null && evse["temp"]  !== "false" ? `${parseFloat(evse["temp"]).toFixed(1)}°C` : "—";
  const temp1 = evse["temp1"] != null && evse["temp1"] !== "false" ? `${parseFloat(evse["temp1"]).toFixed(1)}°C` : null;
  const temp2 = evse["temp2"] != null && evse["temp2"] !== "false" ? `${parseFloat(evse["temp2"]).toFixed(1)}°C` : null;

  const divertmode = parseInt(evse["divertmode"]) || 1;
  const maxCurrent = parseInt(evse["max_current"]) || 32;
  const amberColor = "var(--amber)";

  return (
    <div className="dashboard">
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <header className="dash-header">
        <div className="dash-header-left">
          <h1 className="dash-header-title">DASHBOARD</h1>
          <span className="dash-header-device">
            {typeof deviceName === "string" ? deviceName : "openevse"}
          </span>
        </div>
        <div className="dash-header-pills">
          <ConnPill label="LIVE"    active={wsStatus === "connected"} color="var(--green)" />
          <ConnPill label="CHARGER" active={evseConn}                 color="var(--cyan)"  />
        </div>
      </header>

      <main className="dash-main">
        {/* Status: ring on left, 2×2 metrics on right */}
        <Section title="CHARGER STATUS" charging={isCharging}>
          <div className="status-row">
            <div className="status-row-left">
              <ChargingRing isCharging={isCharging} amp={amp} pilot={pilot} />
              <StatusBadge state={state} loading={loading} />
            </div>
            <div className="metrics-grid">
              <MetricCard label="Current" value={amp.toFixed(1)} unit="A"
                color={isCharging ? amberColor : undefined} highlight={isCharging} loading={loading} />
              <MetricCard label="Voltage" value={voltage.toFixed(0)} unit="V" loading={loading} />
              <MetricCard label="Power"   value={power.toFixed(0)} unit="W"
                color={isCharging ? amberColor : undefined} highlight={isCharging} loading={loading} />
              <MetricCard label="Pilot"   value={pilot.toFixed(0)} unit="A" loading={loading} />
            </div>
          </div>
        </Section>

        {/* Power chart */}
        <Section title="POWER TELEMETRY">
          <PowerChart data={powerHistory} />
        </Section>

        {/* Session & energy */}
        <Section title="SESSION & ENERGY">
          <div className="metrics-grid four">
            <MetricCard label="Session Energy"   value={fmtEnergy(sessionEnergy)} loading={loading} />
            <MetricCard label="Session Duration" value={fmtElapsed(sessionElapsed)} loading={loading} />
            <MetricCard label="Total Energy"     value={fmtEnergy(totalEnergy)} loading={loading} />
            <MetricCard label="Today"            value={fmtEnergy(evse["total_day"] ?? "0")} loading={loading} />
          </div>
        </Section>

        {/* Temperature */}
        {hasTemp && (
          <Section title="TEMPERATURE">
            <div className="metrics-grid auto">
              <MetricCard label="Internal" value={temp} />
              {temp1 && <MetricCard label="Sensor 1" value={temp1} />}
              {temp2 && <MetricCard label="Sensor 2" value={temp2} />}
            </div>
          </Section>
        )}

        {/* Controls */}
        <Section title="CONTROLS">
          <ControlPanel
            isCharging={isCharging}
            state={parseInt(state)}
            pilot={pilot}
            maxCurrent={maxCurrent}
            divertmode={divertmode}
            onStart={() => send("start", "Charging started")}
            onStop={() => send("stop", "Charging stopped")}
            onClear={() => send("clear", "Override cleared")}
            onSetCurrent={(a) => send(`current/${a}`, `Current set to ${a} A`)}
            onSetDivert={(m) => send(`divert/${m}`, m === 2 ? "Fast mode enabled" : "Eco mode enabled")}
            onRestart={(t) => send(`restart/${t}`, `${t} restart requested`)}
          />
        </Section>
      </main>
    </div>
  );
}
