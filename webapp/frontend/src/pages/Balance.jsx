import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { ToastContainer, useToast } from "../hooks/useToast.jsx";
import "./Balance.css";

// Pricing tiers (CFA/kWh)
const PRICING_TIERS = [
  {
    id: "eco",
    label: "Eco Mode",
    sub: "Solar divert / off-peak — lower cost",
    min: 96,
    max: 108,
    color: "var(--green)",
    bg: "rgba(22,163,74,0.08)",
    border: "rgba(22,163,74,0.25)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 01-3.88 19.93C4.28 20.77 2 17.69 2 14c0-5.18 4.28-8.5 8-10 0 2.5 1 5 3 7-1.5.5-3 .5-4 0 .67 2.33 2.5 4 5 4a6 6 0 006-6c0-4-3-7-8-7z"/>
      </svg>
    ),
  },
  {
    id: "fast",
    label: "Fast Mode",
    sub: "Maximum current — quickest charge",
    min: 480,
    max: 608,
    color: "var(--amber)",
    bg: "rgba(224,145,16,0.08)",
    border: "rgba(224,145,16,0.25)",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
];

function PricingCard({ tier }) {
  return (
    <div className="pricing-card" style={{ background: tier.bg, borderColor: tier.border }}>
      <div className="pricing-card-icon" style={{ color: tier.color }}>{tier.icon}</div>
      <div className="pricing-card-body">
        <div className="pricing-card-label" style={{ color: tier.color }}>{tier.label}</div>
        <div className="pricing-card-sub">{tier.sub}</div>
      </div>
      <div className="pricing-card-rate">
        <span className="pricing-rate-value" style={{ color: tier.color }}>
          {tier.min === tier.max ? tier.min : `${tier.min} – ${tier.max}`}
        </span>
        <span className="pricing-rate-unit">CFA/kWh</span>
      </div>
    </div>
  );
}

function TxRow({ tx, idx }) {
  const isCharge = tx.type === "charge";
  const ts = new Date(tx.timestamp + (tx.timestamp.endsWith("Z") ? "" : "Z"));
  return (
    <div className={`tx-row ${idx === 0 ? "tx-row--latest" : ""}`}>
      <div className="tx-row-time">
        <div className="tx-time-date">{ts.toLocaleDateString()}</div>
        <div className="tx-time-clock">{ts.toLocaleTimeString()}</div>
      </div>
      <div className="tx-row-type">
        <span
          className="tx-badge"
          style={{
            color: isCharge ? "var(--orange)" : "var(--green)",
            background: isCharge ? "rgba(249,115,22,0.1)" : "rgba(22,163,74,0.1)",
            borderColor: isCharge ? "rgba(249,115,22,0.3)" : "rgba(22,163,74,0.3)",
          }}
        >
          {isCharge ? "Charge" : "Top-up"}
        </span>
      </div>
      <div className="tx-row-detail">
        {tx.kwh > 0 && (
          <span className="tx-kwh">{tx.kwh.toFixed(3)} kWh</span>
        )}
      </div>
      <div className="tx-row-amount">
        <span
          className="tx-amount"
          style={{ color: isCharge ? "var(--orange)" : "var(--green)" }}
        >
          {isCharge ? "−" : "+"}{Math.abs(tx.amount_cfa).toLocaleString()} CFA
        </span>
      </div>
    </div>
  );
}

function TopupModal({ onClose, onSuccess }) {
  const { authFetch } = useAuth();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const PRESETS = [1000, 2500, 5000, 10000, 25000];

  async function handleSubmit(e) {
    e.preventDefault();
    const val = parseInt(amount, 10);
    if (!val || val <= 0) { setError("Enter a valid amount"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/balance/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cfa: val }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Top-up failed");
      onSuccess(data.balance_cfa);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-title">Recharge Account</span>
          <button className="modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="modal-notice">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Payment integration coming soon. Credits are added directly for testing.
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-presets">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`preset-btn ${amount === String(p) ? "preset-btn--active" : ""}`}
                onClick={() => setAmount(String(p))}
              >
                {p.toLocaleString()}
              </button>
            ))}
          </div>

          <div className="modal-input-group">
            <input
              className="modal-input"
              type="number"
              min="1"
              max="500000"
              placeholder="Custom amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <span className="modal-input-unit">CFA</span>
          </div>

          {error && <div className="modal-error">{error}</div>}

          <button className="modal-submit" type="submit" disabled={loading || !amount}>
            {loading ? "Processing…" : `Add ${amount ? parseInt(amount, 10).toLocaleString() : "0"} CFA`}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Balance() {
  const { authFetch } = useAuth();
  const { toasts, addToast } = useToast();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTopup, setShowTopup] = useState(false);
  const [limit, setLimit] = useState(50);

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/balance?limit=${limit}`);
      if (!res.ok) throw new Error("Failed to load balance");
      const data = await res.json();
      setBalance(data.balance_cfa);
      setTransactions(data.transactions ?? []);
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [authFetch, limit, addToast]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  function handleTopupSuccess(newBalance) {
    setBalance(newBalance);
    setShowTopup(false);
    addToast("Balance updated successfully", "success");
    fetchBalance();
  }

  const totalSpent = transactions
    .filter((t) => t.type === "charge")
    .reduce((sum, t) => sum + Math.abs(t.amount_cfa), 0);

  const totalTopups = transactions
    .filter((t) => t.type === "topup")
    .reduce((sum, t) => sum + t.amount_cfa, 0);

  return (
    <div className="balance-page">
      <ToastContainer toasts={toasts} />
      {showTopup && (
        <TopupModal
          onClose={() => setShowTopup(false)}
          onSuccess={handleTopupSuccess}
        />
      )}

      {/* Header */}
      <header className="balance-header">
        <div className="balance-header-left">
          <h1 className="balance-title">Balance</h1>
          <span className="balance-sub">Charging account & history</span>
        </div>
        <div className="balance-header-actions">
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
          <button className="events-refresh-btn" onClick={fetchBalance} disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: loading ? "spin 0.8s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
            </svg>
            Refresh
          </button>
        </div>
      </header>

      <main className="balance-main">

        {/* Balance + stats row */}
        <div className="balance-top-row">

          {/* Current balance card */}
          <div className="balance-card balance-card--main">
            <div className="balance-card-label">Current Balance</div>
            {loading ? (
              <div className="skeleton" style={{ height: 52, width: 200, borderRadius: 4, marginTop: 8 }} />
            ) : (
              <div className="balance-amount">
                {(balance ?? 0).toLocaleString()}
                <span className="balance-currency">CFA</span>
              </div>
            )}
            <button className="topup-btn" onClick={() => setShowTopup(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Credit
            </button>
          </div>

          {/* Stats */}
          <div className="balance-stats">
            <div className="balance-stat-card">
              <div className="balance-stat-label">Total Spent</div>
              <div className="balance-stat-value" style={{ color: "var(--orange)" }}>
                {loading ? "—" : `${totalSpent.toLocaleString()} CFA`}
              </div>
            </div>
            <div className="balance-stat-card">
              <div className="balance-stat-label">Total Topped Up</div>
              <div className="balance-stat-value" style={{ color: "var(--green)" }}>
                {loading ? "—" : `${totalTopups.toLocaleString()} CFA`}
              </div>
            </div>
            <div className="balance-stat-card">
              <div className="balance-stat-label">Transactions</div>
              <div className="balance-stat-value">{loading ? "—" : transactions.length}</div>
            </div>
          </div>
        </div>

        {/* Pricing section */}
        <section className="pricing-section">
          <div className="section-heading">
            <span className="section-heading-text">Charging Rates</span>
            <span className="section-heading-note">All prices in CFA (XOF)</span>
          </div>
          <div className="pricing-grid">
            {PRICING_TIERS.map((tier) => (
              <PricingCard key={tier.id} tier={tier} />
            ))}
          </div>
        </section>

        {/* Transaction history */}
        <section className="tx-section">
          <div className="section-heading">
            <span className="section-heading-text">Transaction History</span>
            <span className="section-heading-note">{transactions.length} records</span>
          </div>

          {loading ? (
            <div className="events-card">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="tx-row-skeleton">
                  <div className="skeleton" style={{ height: 14, width: 80 }} />
                  <div className="skeleton" style={{ height: 22, width: 70, borderRadius: 20 }} />
                  <div className="skeleton" style={{ height: 14, width: 70 }} />
                  <div className="skeleton" style={{ height: 16, width: 100 }} />
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="events-card">
              <div className="events-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                </svg>
                <div className="events-empty-title">No transactions yet</div>
                <div className="events-empty-sub">Charging sessions and top-ups will appear here</div>
              </div>
            </div>
          ) : (
            <div className="events-card">
              <div className="tx-table-header">
                <span>Time</span>
                <span>Type</span>
                <span>Energy</span>
                <span>Amount</span>
              </div>
              {transactions.map((tx, i) => (
                <TxRow key={i} tx={tx} idx={i} />
              ))}
            </div>
          )}
        </section>

      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
