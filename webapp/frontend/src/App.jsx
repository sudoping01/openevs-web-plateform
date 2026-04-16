import { useState } from "react";
import { useAuth } from "./contexts/AuthContext.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Events from "./pages/Events.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import { useWebSocket } from "./hooks/useWebSocket.js";

function AppShell() {
  const { user, token, logout } = useAuth();
  const [activePage, setActivePage] = useState("dashboard");

  const { evse, powerHistory, wsStatus } = useWebSocket({ token, onLogout: logout });

  return (
    <Layout
      activePage={activePage}
      setActivePage={setActivePage}
      user={user}
      onLogout={logout}
      wsStatus={wsStatus}
    >
      {activePage === "dashboard" && (
        <Dashboard evse={evse} powerHistory={powerHistory} wsStatus={wsStatus} />
      )}
      {activePage === "events" && <Events />}
      {activePage === "settings" && <SettingsPage />}
    </Layout>
  );
}

export default function App() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  return <AppShell />;
}
