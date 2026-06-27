import { menuViewGroups } from "./menu";
const mobileFieldValidation = {
  pattern: "^\\d{10}$",
  message: "Mobile number must be exactly 10 digits."
};
export const masterConfigs = {
  organizations: {
    title: 'Organizations',
    resource: 'organizations',
    tableColumns: [
      { key: 'organization_code', label: 'Organization Code' },
      { key: 'organization_name', label: 'Organization Name' },
      { key: 'gst', label: 'GST' },
      { key: 'address', label: 'Address' },
      { key: 'logo', label: 'Logo', type: 'image' },
      { key: 'is_active', label: 'Active', type: 'boolean' }
    ],
    hideDataTools: true,
    fields: [
      { name: 'organization_code', label: 'Organization Code', type: 'text', required: true },
      { name: 'organization_name', label: 'Organization Name', type: 'text', required: true },
      { name: 'gst', label: 'GST', type: 'text' },
      { name: 'address', label: 'Address', type: 'textarea' },
      { name: 'logo', label: 'Logo Upload', type: 'file' },
      { name: 'is_active', label: 'Active', type: 'checkbox' }
    ]
  },
  customers: {
    title: "Customers",
    resource: "customers",
    tableColumns: [
      { key: "full_name", label: "Customer Name" },
      { key: "mobile", label: "Mobile" },
      { key: "address_line_1", label: "Address" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "full_name", label: "Customer Name", type: "text", required: true },
      { name: "mobile", label: "Mobile", type: "text", validation: mobileFieldValidation },
      {
        name: "alternate_mobile",
        label: "Alternate Mobile",
        type: "text",
        validation: mobileFieldValidation
      },
      { name: "email", label: "Email", type: "email" },
      { name: "address_line_1", label: "Address", type: "textarea" },
      { name: "gstin", label: "GSTIN", type: "text" },
      {
        name: "state",
        label: "State",
        type: "select",
        optionsFrom: "states",
        optionValueKey: "state_name",
        optionLabelKey: "state_name",
        resetsFields: ["city"]
      },
      {
        name: "city",
        label: "City",
        type: "select",
        optionsFrom: "cities",
        optionValueKey: "city_name",
        optionLabelKey: "city_name",
        dependsOn: "state",
        dependsOnKey: "state_name"
      },
      { name: "notes", label: "Notes", type: "textarea" },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
  states: {
    title: "States",
    resource: "states",
    tableColumns: [
      { key: "state_name", label: "State Name" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "state_name", label: "State Name", type: "text", required: true },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
  cities: {
    title: "Cities",
    resource: "cities",
    tableColumns: [
      { key: "city_name", label: "City Name" },
      { key: "state_name", label: "State" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "state_id", label: "State", type: "select", optionsFrom: "states", required: true },
      { name: "city_name", label: "City Name", type: "text", required: true },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
  "product-categories": {
    title: "Categories",
    resource: "product-categories",
    tableColumns: [
      { key: "category_name", label: "Category" },
      { key: "parent_category_name", label: "Parent Category" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "category_name", label: "Category Name", type: "text", required: true },
      { name: "parent_category_id", label: "Parent Category", type: "select", optionsFrom: "product-categories" },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
  users: {
    title: "Users",
    resource: "users",
    tableColumns: [
      { key: "full_name", label: "User Name" },
      { key: "login_id", label: "Log In Id" },
      { key: "password", label: "Password" },
      { key: "email", label: "Email" },
      { key: "mobile", label: "Mobile" },
      { key: "role_name", label: "Role" },
      { key: "is_active", label: "Active", type: "boolean" }
    ],
    fields: [
      { name: "full_name", label: "Full Name", type: "text", required: true },
      { name: "login_id", label: "Log In Id", type: "text", required: true },
      { name: "password", label: "Password", type: "password", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "mobile", label: "Mobile", type: "text", validation: mobileFieldValidation },
      {
        name: "role_name",
        label: "Role",
        type: "select",
        required: true,
        staticOptions: [
          { value: "", label: "Select Role" },
          { value: "Admin", label: "Admin" },
          { value: "Manager", label: "Manager" },
          { value: "Executive", label: "Executive" }
        ]
      },
      {
        name: "views",
        label: "View",
        type: "checklist",
        required: true,
        optionGroups: menuViewGroups
      },
      { name: "notes", label: "Notes", type: "textarea" },
      { name: "is_active", label: "Active", type: "checkbox" }
    ]
  },
};
