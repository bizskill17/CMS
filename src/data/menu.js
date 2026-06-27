export const menuSections = [
  {
    label: "Masters",
    path: "/masters",
    icon: "masters",
    items: [
      { label: "Organizations", path: "/masters/organizations", countKey: "organizations" },
      { label: "Customers", path: "/masters/customers", countKey: "customers" },
      { label: "Customer Groups", path: "/masters/customer-groups", countKey: "customer-groups" },
      { label: "States", path: "/masters/states", countKey: "states" },
      { label: "Cities", path: "/masters/cities", countKey: "cities" },
      { label: "Categories", path: "/masters/product-categories", countKey: "product-categories" },
      { label: "Users", path: "/masters/users", countKey: "users" },
    ]
  },
  {
    label: "Leads",
    path: "/leads",
    icon: "leads",
    items: [
      { label: "All Leads", path: "/leads/all", countKey: "leads-all" },
      { label: "Add Lead", path: "/leads/add" },
      { label: "Pending Assigning", path: "/leads/pending-assigning", countKey: "leads-pending-assigning" },
      {
        label: "Pending First Follow Up",
        path: "/leads/pending-first-follow-up",
        countKey: "leads-pending-first-follow-up"
      },
      {
        label: "Pending Repeat Follow Up",
        path: "/leads/pending-repeat-follow-up",
        countKey: "leads-pending-repeat-follow-up"
      },
      { label: "Converted", path: "/leads/converted", countKey: "leads-converted" },
      { label: "Lost", path: "/leads/lost", countKey: "leads-lost" },
      { label: "Canceled", path: "/leads/canceled", countKey: "leads-canceled" },
      { label: "Activity Log", path: "/leads/activity-log", countKey: "leads-activity-log" }
    ]
  },
  {
    label: "Tasks",
    path: "/tasks",
    icon: "tasks",
    items: [
      { label: "All Tasks", path: "/tasks/all", countKey: "tasks-all" },
      { label: "Add Task", path: "/tasks/add" },
      { label: "Pending Tasks", path: "/tasks/pending", countKey: "tasks-pending" },
      { label: "Completed", path: "/tasks/completed", countKey: "tasks-completed" },
      { label: "Canceled", path: "/tasks/canceled", countKey: "tasks-canceled" },
      { label: "Action Log", path: "/tasks/action-log", countKey: "tasks-activity-log" }
    ]
  }
];

export function getMenuRouteEntries(sections = menuSections) {
  return sections.flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      section: section.label,
      resourceKey: section.label === "Masters" ? item.path.replace("/masters/", "") : undefined
    }))
  );
}

export function filterMenuSectionsByViews(allowedViews = [], sections = menuSections) {
  const allowedSet = new Set(allowedViews);

  return sections
    .map((section) => {
      const filteredItems = (section.items || []).filter(
        (item) => allowedSet.has(item.path) || (item.fallbackView && allowedSet.has(item.fallbackView))
      );

      if (!filteredItems.length) {
        return null;
      }

      return {
        ...section,
        items: filteredItems
      };
    })
    .filter(Boolean);
}

export const menuViewOptions = menuSections.flatMap((section) =>
  (section.items || []).map((item) => ({
    value: item.path,
    label: section.label + " / " + item.label
  }))
);

export const menuViewGroups = menuSections.map((section) => ({
  label: section.label,
  options: (section.items || []).map((item) => ({
    value: item.path,
    label: item.label
  }))
}));

export function formatMenuViews(value) {
  if (!value) {
    return "";
  }

  let selectedViews = value;

  if (typeof value === "string") {
    try {
      selectedViews = JSON.parse(value);
    } catch {
      selectedViews = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  if (!Array.isArray(selectedViews)) {
    return String(value);
  }

  const labelMap = new Map(menuViewOptions.map((option) => [option.value, option.label]));

  return selectedViews
    .map((item) => labelMap.get(item) || item)
    .join(", ");
}
