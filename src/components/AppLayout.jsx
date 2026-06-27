import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { API_BASE } from "../config/api";
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

export default function AppLayout({ currentUser, allowedMenuSections, allowedRoutes, onLogout }) {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(() => getIsMobileViewport());
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => !getIsMobileViewport());
  const [appBrand, setAppBrand] = useState({
    name: currentUser?.organization_name || "Leads & Tasks",
    logo: currentUser?.organization_logo || ""
  });
  const currentViewName = getCurrentViewName(location.pathname);
  const fallbackPath = allowedRoutes[0]?.path || "/login";
  const isAllowedPath = allowedRoutes.some((item) => {
    if (item.path === location.pathname) {
      return true;
    }

    return (item.matchPrefixes || []).some((prefix) => location.pathname.startsWith(prefix));
  });

  useEffect(() => {
    const handleResize = () => {
      const nextIsMobile = getIsMobileViewport();
      setIsMobile(nextIsMobile);
      setIsSidebarOpen(!nextIsMobile);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setAppBrand({
      name: currentUser?.organization_name || "Leads & Tasks",
      logo: currentUser?.organization_logo || ""
    });
  }, [currentUser?.organization_logo, currentUser?.organization_name]);

  useEffect(() => {
    const scrollToTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTo(0, 0);
      document.body.scrollTo(0, 0);
    };

    scrollToTop();
    const timer = setTimeout(scrollToTop, 100);

    setIsSidebarOpen(false);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const handleSidebarToggle = () => {
    setIsSidebarOpen((current) => !current);
  };

  if (!isAllowedPath) {
    return <Navigate to={fallbackPath} replace />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={isSidebarOpen}
        isMobile={isMobile}
        onClose={() => setIsSidebarOpen(false)}
        menuSections={allowedMenuSections}
        currentUser={currentUser}
        onLogout={onLogout}
      />
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
          </div>
          {appBrand.logo ? (
            <div className="content-topbar__brand">
              <img
                src={
                  /^https?:\/\//i.test(appBrand.logo)
                    ? appBrand.logo
                    : `${API_BASE}/${String(appBrand.logo).replace(/^\/+/, "")}`
                }
                alt={appBrand.name}
                className="content-topbar__brand-logo"
              />
            </div>
          ) : null}
        </div>
        <div className="content-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}


