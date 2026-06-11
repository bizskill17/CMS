import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import IssuePolicyPage from "./components/IssuePolicyPage";
import MasterPage from "./components/MasterPage";
import PagePlaceholder from "./components/PagePlaceholder";
import { menuSections } from "./data/menu";
import { masterConfigs } from "./data/masterConfigs";

function buildRoutes(items) {
  return items.map((item) => (
    <Route
      key={item.path}
      path={item.path}
      element={
        item.path === "/policies/issue" ? (
          <IssuePolicyPage />
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
