import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import LeadsPage from "./components/LeadsPage";
import LoginPage from "./components/LoginPage";
import MasterPage from "./components/MasterPage";
import TasksPage from "./components/TasksPage";
import { filterMenuSectionsByViews, getMenuRouteEntries } from "./data/menu";
import { masterConfigs } from "./data/masterConfigs";
import { clearStoredAuthUser, getStoredAuthUser, setStoredAuthUser } from "./utils/auth";

const DEFAULT_PATH = "/masters/customers";

function buildRoutes(items) {
  return items.map((item) => (
    <Route
      key={item.path}
      path={item.path}
      element={
        item.section === "Leads" ? (
          <LeadsPage viewPath={item.path} />
        ) : item.section === "Tasks" ? (
          <TasksPage viewPath={item.path} />
        ) : item.section === "Masters" && masterConfigs[item.resourceKey] ? (
          <MasterPage resourceKey={item.resourceKey} />
        ) : (
          <Navigate to={DEFAULT_PATH} replace />
        )
      }
    />
  ));
}

export default function App() {
  const [authUser, setAuthUser] = useState(() => getStoredAuthUser());
  const nativeFetchRef = useRef(window.fetch.bind(window));
  const hasValidAuth = Boolean(authUser?.organization_id);
  const effectiveViews = useMemo(() => authUser?.views || [], [authUser]);
  const allowedMenuSections = useMemo(
    () => filterMenuSectionsByViews(effectiveViews),
    [effectiveViews]
  );
  const allowedRoutes = useMemo(() => getMenuRouteEntries(allowedMenuSections), [allowedMenuSections]);
  const defaultPath = allowedRoutes[0]?.path || DEFAULT_PATH;

  useLayoutEffect(() => {
    const nativeFetch = nativeFetchRef.current;

    if (!authUser?.organization_id) {
      window.fetch = nativeFetch;
      return () => {
        window.fetch = nativeFetch;
      };
    }

    window.fetch = (input, init) => {
      const request = input instanceof Request ? input : null;
      const headers = new Headers(init?.headers ?? request?.headers ?? undefined);

      if (!headers.has("X-Organization-Id")) {
        headers.set("X-Organization-Id", String(authUser.organization_id));
      }

      return nativeFetch(input, {
        ...init,
        headers
      });
    };

    return () => {
      window.fetch = nativeFetch;
    };
  }, [authUser?.organization_id]);

  const handleLogin = (user) => {
    setStoredAuthUser(user);
    setAuthUser(getStoredAuthUser());
  };

  const handleLogout = () => {
    clearStoredAuthUser();
    setAuthUser(null);
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={hasValidAuth ? <Navigate to={defaultPath} replace /> : <LoginPage onLogin={handleLogin} />}
      />
      <Route
        element={
          hasValidAuth ? (
            <AppLayout
              currentUser={authUser}
              allowedMenuSections={allowedMenuSections}
              allowedRoutes={allowedRoutes}
              onLogout={handleLogout}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<Navigate to={defaultPath} replace />} />
        {buildRoutes(allowedRoutes)}
      </Route>
      <Route path="*" element={<Navigate to={hasValidAuth ? defaultPath : "/login"} replace />} />
    </Routes>
  );
}
