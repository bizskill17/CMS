import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
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

export default function AppLayout() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(() => getIsMobileViewport());
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => !getIsMobileViewport());
  const [appBrand, setAppBrand] = useState({
    name: "Policy Management System",
    logo: ""
  });
  const currentViewName = getCurrentViewName(location.pathname);

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
    let isActive = true;

    const loadBrand = () => {
      fetch(`${API_BASE}/masters/settings?limit=1`)
        .then((res) => res.json())
        .then((json) => {
          if (!isActive || json.status !== "ok") {
            return;
          }

          const record = Array.isArray(json.data) ? json.data[0] : null;
          if (!record) {
            return;
          }

          setAppBrand({
            name: record.organization_name || "Policy Management System",
            logo: record.logo || ""
          });
        })
        .catch((err) => console.error("Failed to fetch settings brand", err));
    };

    loadBrand();
    window.addEventListener("focus", loadBrand);

    return () => {
      isActive = false;
      window.removeEventListener("focus", loadBrand);
    };
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
        <Outlet />
      </main>
    </div>
  );
}
