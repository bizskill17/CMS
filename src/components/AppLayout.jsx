import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { menuSections } from "../data/menu";
import Sidebar from "./Sidebar";

function getCurrentViewName(pathname) {
  for (const section of menuSections) {
    if (section.standalone && section.path === pathname) {
      return section.label;
    }

    const matchedItem = section.items.find((item) => item.path === pathname);
    if (matchedItem) {
      return matchedItem.label;
    }
  }

  return "";
}

export default function AppLayout() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const currentViewName = getCurrentViewName(location.pathname);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <Sidebar isOpen={isSidebarOpen} onShow={() => setIsSidebarOpen(true)} />
      <main className="content-area">
        {!isSidebarOpen ? (
          <div className="content-topbar">
            <button
              className="sidebar-toggle"
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Show menu"
            >
              <span className="sidebar-toggle__line" aria-hidden="true"></span>
              <span className="sidebar-toggle__line" aria-hidden="true"></span>
              <span className="sidebar-toggle__line" aria-hidden="true"></span>
            </button>
            {currentViewName ? <h1 className="content-topbar__title">{currentViewName}</h1> : null}
          </div>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
