import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { menuSections } from "../data/menu";
import Sidebar from "./Sidebar";

function getIsMobileViewport() {
  return window.innerWidth <= 900;
}

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
  const [isMobile, setIsMobile] = useState(() => getIsMobileViewport());
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => !getIsMobileViewport());
  const currentViewName = getCurrentViewName(location.pathname);

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  useEffect(() => {
    const handleResize = () => {
      const nextIsMobile = getIsMobileViewport();
      setIsMobile(nextIsMobile);
      setIsSidebarOpen(!nextIsMobile);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSidebarToggle = () => {
    setIsSidebarOpen((current) => !current);
  };

  return (
    <div className="app-shell">
      <Sidebar isOpen={isSidebarOpen} isMobile={isMobile} onClose={() => setIsSidebarOpen(false)} />
      <main className="content-area">
        <div className="content-topbar">
          <button
            className="sidebar-toggle"
            type="button"
            onClick={handleSidebarToggle}
            aria-label={isSidebarOpen ? "Hide menu" : "Show menu"}
          >
            <span className="sidebar-toggle__line" aria-hidden="true"></span>
            <span className="sidebar-toggle__line" aria-hidden="true"></span>
            <span className="sidebar-toggle__line" aria-hidden="true"></span>
          </button>
          <div className="content-topbar__copy">
            {currentViewName ? <h1 className="content-topbar__title">{currentViewName}</h1> : null}
            <p className="content-topbar__subtitle">Insurance workflow suite</p>
          </div>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
