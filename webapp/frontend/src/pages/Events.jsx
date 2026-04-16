import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { ToastContainer, useToast } from "../hooks/useToast.jsx";
import "./Events.css";

const COMMAND_META = {
  start:         { label: "Start Charging",  color: "var(--green)",  bg: "rgba(16,185,129,0.12)"  },
  stop:          { label: "Stop Charging",   color: "var(--red)",    bg: "rgba(239,68,68,0.12)"   },
  clear_override:{ label: "Clear Override",  color: "var(--yellow)", bg: "rgba(245,158,11,0.12)"  },
  set_current:   { label: "Set Current",     color: "var(--blue)",   bg: "rgba(59,130,246,0.12)"  },
  set_divert:    { label: "Set Mode",        color: "var(--purple)", bg: "rgba(139,92,246,0.12)"  },
  restart:       { label: "Restart",         color: "var(--orange)", bg: "rgba(249,115,22,0.12)"  },
};

function CommandBadge({ command }) {
  const meta = COMMAND_META[command] ?? { label: command, color: "var(--text-muted)", bg: "var(--surface2)" };
  return (
    <span
      className="event-badge"
      style={{ color: meta.color, background: meta.bg, borderColor: `${meta.color}40` }}
    >
      {meta.label}
    </span>
  );
}

function formatMeta(meta) {
  if (!meta || Object.keys(meta).length === 0) return null;
  return Object.entries(meta)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

function EventRow({ event, idx }) {
  const ts = new Date(event.timestamp + (event.timestamp.endsWith("Z") ? "" : "Z"));
  return (
    <div className={`event-row ${idx === 0 ? "event-row--latest" : ""}`}>
      <div className="event-row-time">
        <div className="event-time-date">{ts.toLocaleDateString()}</div>
        <div className="event-time-clock">{ts.toLocaleTimeString()}</div>
      </div>
      <div className="event-row-badge">
        <CommandBadge command={event.command} />
      </div>
      <div className="event-row-user">
        <span className="event-user-avatar">{event.username?.slice(0, 1).toUpperCase()}</span>
        <span className="event-username">{event.username}</span>
      </div>
      <div className="event-row-detail">
        {formatMeta(event.meta) && (
          <span className="event-meta">{formatMeta(event.meta)}</span>
        )}
        {event.evse_snapshot?.power != null && (
          <span className="event-power">{parseFloat(event.evse_snapshot.power).toFixed(0)} W</span>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="events-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/>
        <line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
      <div className="events-empty-title">No events yet</div>
      <div className="events-empty-sub">Commands sent to the charger will appear here</div>
    </div>
  );
}

export default function Events() {
  const { authFetch } = useAuth();
  const { toasts, addToast } = useToast();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/events?limit=${limit}`);
      if (!res.ok) throw new Error("Failed to load events");
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [authFetch, limit, addToast]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return (
    <div className="events-page">
      <ToastContainer toasts={toasts} />

      <header className="events-header">
        <div className="events-header-left">
          <h1 className="events-title">Events</h1>
          <span className="events-count">{events.length} records</span>
        </div>
        <div className="events-header-actions">
          <select
            className="events-limit-select"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={25}>Last 25</option>
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={200}>Last 200</option>
          </select>
          <button className="events-refresh-btn" onClick={fetchEvents} disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
        </div>
      </header>

      <main className="events-main">
        {loading ? (
          <div className="events-card">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="event-row-skeleton">
                <div className="skeleton" style={{ height: 14, width: 80 }} />
                <div className="skeleton" style={{ height: 24, width: 110, borderRadius: 20 }} />
                <div className="skeleton" style={{ height: 14, width: 90 }} />
                <div className="skeleton" style={{ height: 14, width: 60 }} />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="events-card"><EmptyState /></div>
        ) : (
          <div className="events-card">
            <div className="events-table-header">
              <span>Time</span>
              <span>Command</span>
              <span>User</span>
              <span>Details</span>
            </div>
            {events.map((ev, i) => (
              <EventRow key={i} event={ev} idx={i} />
            ))}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
