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
      { label: "Agent Accounts", path: "/masters/agent-accounts", countKey: "agent-accounts" }
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
      { label: "Pending Payments from Clients", path: "/payments/pending", countKey: "pending-payments" }
    ]
  },
  {
    label: "Reports",
    path: "/reports",
    icon: "reports",
    items: [
      { label: "Policies Added", path: "/reports/policies-added" },
      { label: "Policies This Week", path: "/reports/policies-this-week" },
      { label: "Policies This Month", path: "/reports/policies-this-month" },
      { label: "Pending Payments from Clients", path: "/reports/pending-payments", countKey: "pending-payments" },
      { label: "Pending Document Uploads", path: "/reports/pending-document-uploads", countKey: "attach-documents" },
      { label: "Payments Received", path: "/reports/payments-received" }
    ]
  }
];
