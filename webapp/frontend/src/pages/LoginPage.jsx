import { useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import "./LoginPage.css";

export default function LoginPage() {
  const { login, register, loading } = useAuth();
  const [tab, setTab] = useState("login");

  const [loginData, setLoginData]   = useState({ username: "", password: "" });
  const [regData, setRegData]       = useState({ username: "", email: "", password: "", confirm: "", car_name: "" });
  const [error, setError]           = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    const result = await login(loginData.username, loginData.password);
    if (!result.ok) setError(result.error);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (regData.password !== regData.confirm) { setError("Passwords do not match"); return; }
    const result = await register(regData.username, regData.email, regData.password, regData.car_name);
    if (!result.ok) setError(result.error);
  };

  const switchTab = (t) => { setTab(t); setError(""); };

  return (
    <div className="login-page">
      {/* ── Left brand panel ── */}
      <div className="login-brand">
        {/* Animated glow orb */}
        <div className="login-brand-glow" />

        {/* Electric arc decorations */}
        <svg className="login-arc login-arc-1" width="80" height="120" viewBox="0 0 80 120" fill="none">
          <path d="M40 0 L20 50 L45 50 L10 120" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" opacity="0.8"/>
        </svg>
        <svg className="login-arc login-arc-2" width="60" height="90" viewBox="0 0 60 90" fill="none">
          <path d="M30 0 L15 38 L35 38 L8 90" stroke="var(--amber)" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
        </svg>
        <svg className="login-arc login-arc-3" width="50" height="75" viewBox="0 0 50 75" fill="none">
          <path d="M25 0 L12 30 L28 30 L5 75" stroke="var(--amber)" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
        </svg>

        {/* Background bolt art */}
        <div className="login-brand-art">
          <svg className="login-brand-bolt" width="640" height="640" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </div>

        <div className="login-brand-content">
          <div className="login-brand-eyebrow">EV Charge Management Platform</div>

          <h1 className="login-brand-title">DAUST EV Charger</h1>
          <div className="login-brand-tagline">Smart Charging Infrastructure</div>

          <p className="login-brand-subtitle">
            Real-time power monitoring and intelligent control<br />
            for your EV charging infrastructure.
          </p>

          <div className="login-brand-stats">
            <div className="login-stat">
              <div className="login-stat-val">32A</div>
              <div className="login-stat-label">Max Current</div>
            </div>
            <div className="login-stat">
              <div className="login-stat-val">7.4kW</div>
              <div className="login-stat-label">Peak Power</div>
            </div>
            <div className="login-stat">
              <div className="login-stat-val">24/7</div>
              <div className="login-stat-label">Monitoring</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="login-form-panel">
        <div className="login-form-card">
          <div className="login-form-logo">
            <div className="login-form-logo-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <span className="login-form-logo-text">DAUST EV Charger</span>
          </div>

          <div className="login-tabs">
            <button className={`login-tab ${tab === "login" ? "active" : ""}`} onClick={() => switchTab("login")}>
              Sign In
            </button>
            <button className={`login-tab ${tab === "register" ? "active" : ""}`} onClick={() => switchTab("register")}>
              Register
            </button>
          </div>

          {tab === "login" ? (
            <form className="auth-form" onSubmit={handleLogin} noValidate>
              <div className="form-group">
                <label className="form-label">Username or Email</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="your_username"
                  autoComplete="username"
                  value={loginData.username}
                  onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                />
              </div>
              {error && <div className="form-error">{error}</div>}
              <button className="form-submit" type="submit" disabled={loading}>
                {loading ? <span className="btn-spinner" /> : "Login"}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegister} noValidate>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" type="text" placeholder="your_username"
                  autoComplete="username" value={regData.username}
                  onChange={(e) => setRegData({ ...regData, username: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" placeholder="you@example.com"
                  autoComplete="email" value={regData.email}
                  onChange={(e) => setRegData({ ...regData, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" placeholder="Min. 8 characters"
                  autoComplete="new-password" value={regData.password}
                  onChange={(e) => setRegData({ ...regData, password: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input className="form-input" type="password" placeholder="••••••••"
                  autoComplete="new-password" value={regData.confirm}
                  onChange={(e) => setRegData({ ...regData, confirm: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Car Name</label>
                <input className="form-input" type="text" placeholder="e.g. Tesla Model 3"
                  autoComplete="off" value={regData.car_name}
                  onChange={(e) => setRegData({ ...regData, car_name: e.target.value })} />
              </div>
              {error && <div className="form-error">{error}</div>}
              <button className="form-submit" type="submit" disabled={loading}>
                {loading ? <span className="btn-spinner" /> : "Create Account"}
              </button>
            </form>
          )}

          <p className="login-footer">
            {tab === "login" ? (
              <>No account?{" "}<button className="link-btn" onClick={() => switchTab("register")}>Register here</button></>
            ) : (
              <>Have an account?{" "}<button className="link-btn" onClick={() => switchTab("login")}>Sign in</button></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
