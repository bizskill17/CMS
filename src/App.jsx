import { Routes, Route, Navigate } from "react-router-dom";
import AllPoliciesPage from "./components/AllPoliciesPage";
import AttachDocumentsPage from "./components/AttachDocumentsPage";
import AppLayout from "./components/AppLayout";
import DashboardPage from "./components/DashboardPage";
import IssuePolicyPage from "./components/IssuePolicyPage";
import MasterPage from "./components/MasterPage";
import PendingPaymentsPage from "./components/PendingPaymentsPage";
import PagePlaceholder from "./components/PagePlaceholder";
import ReportsTablePage from "./components/ReportsTablePage";
import RenewPolicyPage from "./components/RenewPolicyPage";
import { menuSections } from "./data/menu";
import { masterConfigs } from "./data/masterConfigs";

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
        ) : item.path === "/reports/pending-payments" ? (
          <PendingPaymentsPage />
        ) : item.path === "/reports/pending-document-uploads" ? (
          <AttachDocumentsPage />
        ) : [
          "/reports/policies-added",
          "/reports/policies-this-week",
          "/reports/policies-this-month",
          "/reports/payments-received"
        ].includes(item.path) ? (
          <ReportsTablePage reportKey={item.path.replace("/reports/", "")} />
        ) : item.path === "/policies/issue" ? (
          <IssuePolicyPage />
        ) : item.path === "/policies/renew" ? (
          <RenewPolicyPage />
        ) : item.section === "Masters" && masterConfigs[item.resourceKey] ? (
          <MasterPage resourceKey={item.resourceKey} />
        ) : (
          <PagePlaceholder title={item.label} section={item.section} />
        )
      }
    />
  ));
}

const allRoutes = menuSections.flatMap((section) =>
  section.items.map((item) => ({
    ...item,
    section: section.label,
    resourceKey:
      section.label === "Masters" ? item.path.replace("/masters/", "") : undefined
  }))
);

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        {buildRoutes(allRoutes)}
      </Route>
    </Routes>
  );
}
