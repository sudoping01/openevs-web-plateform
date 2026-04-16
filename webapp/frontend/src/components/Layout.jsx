import Sidebar from "./Sidebar.jsx";
import "./Layout.css";

export default function Layout({ activePage, setActivePage, user, onLogout, wsStatus, children }) {
  return (
    <div className="layout">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        user={user}
        onLogout={onLogout}
        wsStatus={wsStatus}
      />
      <div className="layout-content">
        {children}
      </div>
    </div>
  );
}
