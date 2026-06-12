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
      { label: "Customers", path: "/masters/customers" },
      { label: "Customer Groups", path: "/masters/customer-groups" },
      { label: "Insurance Companies", path: "/masters/insurance-companies" },
      { label: "States", path: "/masters/states" },
      { label: "Cities", path: "/masters/cities" },
      { label: "Product Categories", path: "/masters/product-categories" },
      { label: "Insurance Products", path: "/masters/insurance-products" },
      { label: "Document Types", path: "/masters/document-types" },
      { label: "Users", path: "/masters/users" },
      { label: "Agents", path: "/masters/agents" },
      { label: "Agent Accounts", path: "/masters/agent-accounts" }
    ]
  },
  {
    label: "Policies",
    path: "/policies",
    icon: "policies",
    items: [
      { label: "All Policies", path: "/policies/all" },
      { label: "Issue Policy", path: "/policies/issue" },
      { label: "Renew Policy", path: "/policies/renew" },
      { label: "Attach Documents", path: "/policies/attach-documents" }
    ]
  },
  {
    label: "Payments",
    path: "/payments",
    icon: "payments",
    items: [
      { label: "Pending Payments from Clients", path: "/payments/pending" }
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
      { label: "Pending Payments from Clients", path: "/reports/pending-payments" },
      { label: "Pending Document Uploads", path: "/reports/pending-document-uploads" },
      { label: "Payments Received", path: "/reports/payments-received" }
    ]
  }
];
