-- Run this after organization_id columns have been added and populated.
-- It changes old global duplicate checks into organization-wise duplicate checks.

ALTER TABLE customer_groups
  DROP INDEX group_name,
  ADD UNIQUE KEY uk_customer_groups_org_group_name (organization_id, group_name);

ALTER TABLE customers
  DROP INDEX customer_code,
  ADD UNIQUE KEY uk_customers_org_customer_code (organization_id, customer_code);

ALTER TABLE insurance_companies
  DROP INDEX company_name,
  ADD UNIQUE KEY uk_insurance_companies_org_company_name (organization_id, company_name);

ALTER TABLE states
  DROP INDEX state_name,
  ADD UNIQUE KEY uk_states_org_state_name (organization_id, state_name);

ALTER TABLE cities
  DROP INDEX uk_state_city,
  ADD UNIQUE KEY uk_cities_org_state_city (organization_id, state_id, city_name);

ALTER TABLE product_categories
  DROP INDEX category_name,
  ADD UNIQUE KEY uk_product_categories_org_category_name (organization_id, category_name);

ALTER TABLE document_types
  DROP INDEX code,
  ADD UNIQUE KEY uk_document_types_org_code (organization_id, code),
  ADD UNIQUE KEY uk_document_types_org_name (organization_id, name);

ALTER TABLE users
  DROP INDEX email,
  ADD UNIQUE KEY uk_users_org_email (organization_id, email);

ALTER TABLE agents
  DROP INDEX employee_code,
  ADD UNIQUE KEY uk_agents_org_employee_code (organization_id, employee_code);
