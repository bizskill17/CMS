import { useMemo, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AllPoliciesPage from "./components/AllPoliciesPage";
import AttachDocumentsPage from "./components/AttachDocumentsPage";
import AppLayout from "./components/AppLayout";
import DashboardPage from "./components/DashboardPage";
import ExpiryReportsPage from "./components/ExpiryReportsPage";
import ExpiryReportDetailPage from "./components/ExpiryReportDetailPage";
import IssuePolicyPage from "./components/IssuePolicyPage";
import LeadsPage from "./components/LeadsPage";
import LoginPage from "./components/LoginPage";
import MasterPage from "./components/MasterPage";
import PendingPaymentsPage from "./components/PendingPaymentsPage";
import PagePlaceholder from "./components/PagePlaceholder";
import ReportsTablePage from "./components/ReportsTablePage";
import RenewPolicyPage from "./components/RenewPolicyPage";
import TasksPage from "./components/TasksPage";
import { filterMenuSectionsByViews, getMenuRouteEntries, menuSections } from "./data/menu";
import { masterConfigs } from "./data/masterConfigs";
import { clearStoredAuthUser, getStoredAuthUser, setStoredAuthUser } from "./utils/auth";

function buildRoutes(items) {
  return items.map((item) => (
    <Route
      key={item.path}
      path={item.path}
      element={
        item.path === "/policies/all" ? (
          <AllPoliciesPage />
        ) : item.path === "/dashboard" ? (
          <DashboardPage />
        ) : item.path === "/payments/pending" ? (
          <PendingPaymentsPage />
        ) : item.path === "/policies/attach-documents" ? (
          <AttachDocumentsPage />
        ) : item.path === "/payments/received" ? (
          <ReportsTablePage reportKey="payments-received" />
        ) : item.path === "/reports/pending-payments" ? (
          <PendingPaymentsPage />
        ) : item.path === "/reports/pending-document-uploads" ? (
          <AttachDocumentsPage />
        ) : item.path === "/reports/expiry-reports" || item.path.startsWith("/reports/expiry-reports/section/") ? (
          <ExpiryReportsPage />
        ) : [
          "/reports/policies-added",
          "/reports/policies-this-week",
          "/reports/policies-this-month"
        ].includes(item.path) ? (
          <ReportsTablePage reportKey={item.path.replace("/reports/", "")} />
        ) : item.path === "/policies/issue" ? (
          <IssuePolicyPage />
        ) : item.path === "/policies/renew" ? (
          <RenewPolicyPage />
        ) : item.section === "Leads" ? (
          <LeadsPage viewPath={item.path} />
        ) : item.section === "Tasks" ? (
          <TasksPage viewPath={item.path} />
        ) : item.section === "Masters" && masterConfigs[item.resourceKey] ? (
          <MasterPage resourceKey={item.resourceKey} />
        ) : (
          <PagePlaceholder title={item.label} section={item.section} />
        )
      }
    />
  ));
}

const allRoutes = getMenuRouteEntries(menuSections);

export default function App() {
  const [authUser, setAuthUser] = useState(() => getStoredAuthUser());
  const allowedMenuSections = useMemo(
    () => filterMenuSectionsByViews(authUser?.views || []),
    [authUser]
  );
  const allowedRoutes = useMemo(() => getMenuRouteEntries(allowedMenuSections), [allowedMenuSections]);
  const defaultPath = allowedRoutes[0]?.path || "/dashboard";

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
        element={authUser ? <Navigate to={defaultPath} replace /> : <LoginPage onLogin={handleLogin} />}
      />
      <Route
        element={
          authUser ? (
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
        <Route path="/reports/payments-received" element={<Navigate to="/payments/received" replace />} />
        <Route path="/reports/expiry-reports/section/:sectionId" element={<ExpiryReportsPage />} />
        <Route path="/reports/expiry-reports/:reportType/:reportValue" element={<ExpiryReportDetailPage />} />
        {buildRoutes(allRoutes)}
      </Route>
      <Route path="*" element={<Navigate to={authUser ? defaultPath : "/login"} replace />} />
    </Routes>
  );
}
