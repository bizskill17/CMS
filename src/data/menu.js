export const menuSections = [
  {
    label: "Dashboard",
    path: "/dashboard",
    standalone: true,
    icon: "dashboard",
    items: [{ label: "Overview", path: "/dashboard" }]
  },
  {
    label: "Masters",
    path: "/masters",
    icon: "masters",
    items: [
      { label: "Customers", path: "/masters/customers", countKey: "customers" },
      { label: "Customer Groups", path: "/masters/customer-groups", countKey: "customer-groups" },
      { label: "Insurance Companies", path: "/masters/insurance-companies", countKey: "insurance-companies" },
      { label: "States", path: "/masters/states", countKey: "states" },
      { label: "Cities", path: "/masters/cities", countKey: "cities" },
      { label: "Product Categories", path: "/masters/product-categories", countKey: "product-categories" },
      { label: "Insurance Products", path: "/masters/insurance-products", countKey: "insurance-products" },
      { label: "Document Types", path: "/masters/document-types", countKey: "document-types" },
      { label: "Users", path: "/masters/users", countKey: "users" },
      { label: "Agents", path: "/masters/agents", countKey: "agents" },
      { label: "Agent Accounts", path: "/masters/agent-accounts", countKey: "agent-accounts" },
      { label: "Settings", path: "/masters/settings", countKey: "settings" }
    ]
  },
  {
    label: "Leads",
    path: "/leads",
    icon: "leads",
    items: [
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
    label: "Policies",
    path: "/policies",
    icon: "policies",
    items: [
      { label: "All Policies", path: "/policies/all", countKey: "all-policies" },
      { label: "Issue Policy", path: "/policies/issue" },
      { label: "Renew Policy", path: "/policies/renew", countKey: "renew-policy" },
      { label: "Attach Documents", path: "/policies/attach-documents", countKey: "attach-documents" }
    ]
  },
  {
    label: "Payments",
    path: "/payments",
    icon: "payments",
    items: [
      { label: "Pending Payments from Clients", path: "/payments/pending", countKey: "pending-payments" },
      { label: "Payments Received", path: "/payments/received" }
    ]
  },
  {
    label: "Reports",
    path: "/reports",
    icon: "reports",
    items: [
      { label: "Policies Added Today", path: "/reports/policies-added", countKey: "policies-added" },
      { label: "Policies This Week", path: "/reports/policies-this-week", countKey: "policies-this-week" },
      { label: "Policies This Month", path: "/reports/policies-this-month", countKey: "policies-this-month" },
      { label: "Pending Payments from Clients", path: "/reports/pending-payments", countKey: "pending-payments" },
      { label: "Pending Document Uploads", path: "/reports/pending-document-uploads", countKey: "attach-documents" }
    ]
  },
  {
    label: "Expiry Reports",
    path: "/reports/expiry-reports",
    icon: "reports",
    items: [
      {
        label: "Monthly Expiry Reports",
        path: "/reports/expiry-reports/section/monthly",
        matchPrefixes: ["/reports/expiry-reports/month/"]
      },
      {
        label: "Daily Expiry Reports",
        path: "/reports/expiry-reports/section/daily",
        matchPrefixes: ["/reports/expiry-reports/day/"]
      },
      {
        label: "Weekly Expiry Reports",
        path: "/reports/expiry-reports/section/weekly",
        matchPrefixes: ["/reports/expiry-reports/week/"]
      },
      {
        label: "Yearly Expiry Reports",
        path: "/reports/expiry-reports/section/yearly",
        matchPrefixes: ["/reports/expiry-reports/year/"]
      }
    ]
  }
];
