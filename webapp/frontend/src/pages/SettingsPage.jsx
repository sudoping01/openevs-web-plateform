import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import "./SettingsPage.css";

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value ?? "—"}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { user, authFetch, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/api/auth/me")
      .then((r) => r.json())
      .then(setProfile)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authFetch]);

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "??";
  const created = profile?.created_at
    ? new Date(profile.created_at + (profile.created_at.endsWith("Z") ? "" : "Z")).toLocaleDateString(undefined, {
        year: "numeric", month: "long", day: "numeric",
      })
    : null;

  return (
    <div className="settings-page">
      <header className="settings-header">
        <h1 className="settings-title">SETTINGS</h1>
      </header>

      <main className="settings-main">
        {/* Profile */}
        <section className="settings-card">
          <div className="settings-card-title">Profile</div>
          <div className="settings-profile">
            <div className="settings-avatar">{initials}</div>
            <div className="settings-profile-info">
              {loading ? (
                <>
                  <div className="skeleton" style={{ height: 20, width: 140, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 14, width: 200 }} />
                </>
              ) : (
                <>
                  <div className="settings-profile-name">{profile?.username}</div>
                  <div className="settings-profile-email">{profile?.email}</div>
                </>
              )}
            </div>
            <div className="settings-role-badge">{profile?.role ?? "user"}</div>
          </div>

          <div className="settings-info-list">
            <InfoRow label="Username"     value={profile?.username} />
            <InfoRow label="Email"        value={profile?.email} />
            <InfoRow label="Member since" value={created} />
          </div>
        </section>

        {/* Sign out */}
        <section className="settings-card settings-signout-card">
          <div className="settings-card-title">Session</div>
          <div className="settings-danger-row">
            <div>
              <div className="settings-danger-label">Sign out</div>
              <div className="settings-danger-desc">End your current session and return to the login screen</div>
            </div>
            <button className="btn-danger" onClick={logout}>Sign out</button>
          </div>
        </section>
      </main>
    </div>
  );
}
