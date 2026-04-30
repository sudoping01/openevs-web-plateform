import { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { ToastContainer, useToast } from "../hooks/useToast.jsx";
import "./SettingsPage.css";

// Resize image to max dimension and return base64 data URL
function resizeImage(file, maxDim = 600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AvatarUpload({ src, initials, onFile }) {
  const ref = useRef();
  return (
    <div className="avatar-upload" onClick={() => ref.current.click()} title="Change profile picture">
      {src ? (
        <img src={src} alt="avatar" className="settings-avatar settings-avatar--img" />
      ) : (
        <div className="settings-avatar">{initials}</div>
      )}
      <div className="avatar-overlay">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
    </div>
  );
}

function CarImageUpload({ src, onFile }) {
  const ref = useRef();
  return (
    <div className="car-upload" onClick={() => ref.current.click()} title="Change car picture">
      {src ? (
        <img src={src} alt="car" className="car-upload-img" />
      ) : (
        <div className="car-upload-placeholder">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3"/>
            <rect x="9" y="11" width="14" height="10" rx="2"/>
            <circle cx="12" cy="16" r="1"/><circle cx="20" cy="16" r="1"/>
          </svg>
          <span>Add car photo</span>
        </div>
      )}
      <div className="car-upload-overlay">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        Change photo
      </div>
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
    </div>
  );
}

export default function SettingsPage() {
  const { user, authFetch, logout, updateUser } = useAuth();
  const { toasts, addToast } = useToast();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editEmail, setEditEmail]     = useState("");
  const [editCarName, setEditCarName] = useState("");
  const [profilePic, setProfilePic]   = useState(null);
  const [carPic, setCarPic]           = useState(null);

  useEffect(() => {
    authFetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data);
        setEditEmail(data.email ?? "");
        setEditCarName(data.car_name ?? "");
        setProfilePic(data.profile_pic ?? null);
        setCarPic(data.car_pic ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authFetch]);

  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "??";
  const created = profile?.created_at
    ? new Date(profile.created_at + (profile.created_at.endsWith("Z") ? "" : "Z")).toLocaleDateString(undefined, {
        year: "numeric", month: "long", day: "numeric",
      })
    : null;

  async function handleProfilePicFile(file) {
    try {
      const b64 = await resizeImage(file, 400);
      setProfilePic(b64);
    } catch {
      addToast("Could not process image", "error");
    }
  }

  async function handleCarPicFile(file) {
    try {
      const b64 = await resizeImage(file, 800);
      setCarPic(b64);
    } catch {
      addToast("Could not process image", "error");
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        email: editEmail !== profile?.email ? editEmail : undefined,
        car_name: editCarName !== profile?.car_name ? editCarName : undefined,
        profile_pic: profilePic !== (profile?.profile_pic ?? null) ? profilePic : undefined,
        car_pic: carPic !== (profile?.car_pic ?? null) ? carPic : undefined,
      };
      // Strip undefined
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
      if (Object.keys(payload).length === 0) { addToast("Nothing changed", "info"); return; }

      const res = await authFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Update failed");

      setProfile(data);
      setEditEmail(data.email);
      setEditCarName(data.car_name ?? "");
      setProfilePic(data.profile_pic ?? null);
      setCarPic(data.car_pic ?? null);

      updateUser({ email: data.email, car_name: data.car_name, profile_pic: data.profile_pic });
      addToast("Profile saved", "success");
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const isDirty =
    editEmail !== (profile?.email ?? "") ||
    editCarName !== (profile?.car_name ?? "") ||
    profilePic !== (profile?.profile_pic ?? null) ||
    carPic !== (profile?.car_pic ?? null);

  return (
    <div className="settings-page">
      <ToastContainer toasts={toasts} />

      <header className="settings-header">
        <h1 className="settings-title">SETTINGS</h1>
      </header>

      <main className="settings-main">

        {/* Profile card */}
        <section className="settings-card">
          <div className="settings-card-title">Profile</div>

          {/* Avatar row */}
          <div className="settings-profile">
            {loading ? (
              <div className="skeleton" style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0 }} />
            ) : (
              <AvatarUpload
                src={profilePic}
                initials={initials}
                onFile={handleProfilePicFile}
              />
            )}
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

          {/* Editable fields */}
          <div className="settings-fields">
            <div className="settings-field">
              <label className="settings-field-label">Username</label>
              <div className="settings-field-static">{profile?.username ?? "—"}</div>
            </div>
            <div className="settings-field">
              <label className="settings-field-label">Email</label>
              <input
                className="settings-field-input"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={loading}
              />
            </div>
            <div className="settings-field">
              <label className="settings-field-label">Member since</label>
              <div className="settings-field-static">{created ?? "—"}</div>
            </div>
          </div>
        </section>

        {/* Vehicle card */}
        <section className="settings-card">
          <div className="settings-card-title">Vehicle</div>

          <div className="settings-fields">
            <div className="settings-field">
              <label className="settings-field-label">Car name / model</label>
              <input
                className="settings-field-input"
                type="text"
                value={editCarName}
                onChange={(e) => setEditCarName(e.target.value)}
                placeholder="e.g. Tesla Model 3"
                disabled={loading}
              />
            </div>
          </div>

          <div className="settings-car-pic-section">
            <div className="settings-field-label" style={{ marginBottom: 10 }}>Car photo</div>
            <CarImageUpload src={carPic} onFile={handleCarPicFile} />
          </div>
        </section>

        {/* Save button */}
        <div className="settings-save-row">
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={!isDirty || saving || loading}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {isDirty && !saving && (
            <span className="settings-unsaved">Unsaved changes</span>
          )}
        </div>

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
