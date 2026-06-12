import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Sidebar isOpen={isSidebarOpen} onShow={() => setIsSidebarOpen(true)} />
      <main className="content-area">
        {!isSidebarOpen ? (
          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setIsSidebarOpen(true)}
          >
            Show Menu
          </button>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
