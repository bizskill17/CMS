create table organizations (
  id bigint unsigned auto_increment primary key,
  organization_name varchar(150) not null,
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp
);

alter table users
  add column organization_id bigint unsigned not null after id,
  add constraint fk_users_organization foreign key (organization_id) references organizations(id),
  drop index login_id,
  add unique key uk_users_org_login (organization_id, login_id);

alter table customer_groups add column organization_id bigint unsigned not null after id;
alter table customers add column organization_id bigint unsigned not null after id;
alter table insurance_companies add column organization_id bigint unsigned not null after id;
alter table states add column organization_id bigint unsigned not null after id;
alter table cities add column organization_id bigint unsigned not null after id;
alter table product_categories add column organization_id bigint unsigned not null after id;
alter table insurance_products add column organization_id bigint unsigned not null after id;
alter table policy_families add column organization_id bigint unsigned not null after id;
alter table policies add column organization_id bigint unsigned not null after id;
alter table follow_ups add column organization_id bigint unsigned not null after id;
alter table leads add column organization_id bigint unsigned not null after id;
alter table lead_updates add column organization_id bigint unsigned not null after id;
alter table tasks add column organization_id bigint unsigned not null after id;
alter table task_updates add column organization_id bigint unsigned not null after id;
alter table client_payments add column organization_id bigint unsigned not null after id;
alter table document_types add column organization_id bigint unsigned not null after id;
alter table settings add column organization_id bigint unsigned not null after id;
alter table documents add column organization_id bigint unsigned not null after id;
alter table policy_status_history add column organization_id bigint unsigned not null after id;

alter table customer_groups add constraint fk_customer_groups_organization foreign key (organization_id) references organizations(id);
alter table customers add constraint fk_customers_organization foreign key (organization_id) references organizations(id);
alter table insurance_companies add constraint fk_insurance_companies_organization foreign key (organization_id) references organizations(id);
alter table states add constraint fk_states_organization foreign key (organization_id) references organizations(id);
alter table cities add constraint fk_cities_organization foreign key (organization_id) references organizations(id);
alter table product_categories add constraint fk_product_categories_organization foreign key (organization_id) references organizations(id);
alter table insurance_products add constraint fk_insurance_products_organization foreign key (organization_id) references organizations(id);
alter table policy_families add constraint fk_policy_families_organization foreign key (organization_id) references organizations(id);
alter table policies add constraint fk_policies_organization foreign key (organization_id) references organizations(id);
alter table follow_ups add constraint fk_follow_ups_organization foreign key (organization_id) references organizations(id);
alter table leads add constraint fk_leads_organization foreign key (organization_id) references organizations(id);
alter table lead_updates add constraint fk_lead_updates_organization foreign key (organization_id) references organizations(id);
alter table tasks add constraint fk_tasks_organization foreign key (organization_id) references organizations(id);
alter table task_updates add constraint fk_task_updates_organization foreign key (organization_id) references organizations(id);
alter table client_payments add constraint fk_client_payments_organization foreign key (organization_id) references organizations(id);
alter table document_types add constraint fk_document_types_organization foreign key (organization_id) references organizations(id);
alter table settings add constraint fk_settings_organization foreign key (organization_id) references organizations(id);
alter table documents add constraint fk_documents_organization foreign key (organization_id) references organizations(id);
alter table policy_status_history add constraint fk_policy_status_history_organization foreign key (organization_id) references organizations(id);