create table organizations (
  id bigint unsigned auto_increment primary key,
  organization_code varchar(100) not null,
  organization_name varchar(150) not null,
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  unique key uk_organizations_code (organization_code),
  unique key uk_organizations_name (organization_name)
);

create table settings (
  id bigint unsigned auto_increment primary key,
  organization_id bigint unsigned not null,
  organization_name varchar(150) not null,
  gst varchar(50),
  address text,
  logo varchar(255),
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp,
  updated_at datetime null default null on update current_timestamp,
  key idx_settings_organization (organization_id),
  constraint fk_settings_organization
    foreign key (organization_id) references organizations(id)
);

create table users (
  id bigint unsigned auto_increment primary key,
  organization_id bigint unsigned not null,
  full_name varchar(150) not null,
  login_id varchar(120) not null,
  password varchar(255) not null,
  views longtext,
  email varchar(150) not null,
  mobile varchar(20),
  role_name varchar(50) not null,
  notes text,
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  unique key uk_users_org_login (organization_id, login_id),
  unique key uk_users_org_email (organization_id, email),
  key idx_users_organization (organization_id),
  constraint fk_users_organization
    foreign key (organization_id) references organizations(id)
);

create table customer_groups (
  id bigint unsigned auto_increment primary key,
  organization_id bigint unsigned not null,
  group_name varchar(150) not null,
  notes text,
  created_at datetime not null default current_timestamp,
  unique key uk_customer_groups_org_group_name (organization_id, group_name),
  key idx_customer_groups_organization (organization_id),
  constraint fk_customer_groups_organization
    foreign key (organization_id) references organizations(id)
);

create table customers (
  id bigint unsigned auto_increment primary key,
  organization_id bigint unsigned not null,
  customer_code varchar(30) not null,
  group_id bigint unsigned null,
  full_name varchar(150) not null,
  mobile varchar(20),
  alternate_mobile varchar(20),
  email varchar(150),
  date_of_birth date,
  anniversary_date date,
  pan varchar(20),
  aadhaar varchar(20),
  gstin varchar(20),
  father_name varchar(150),
  address_line_1 varchar(200),
  address_line_2 varchar(200),
  address_line_3 varchar(200),
  city varchar(100),
  state varchar(100),
  pincode varchar(20),
  is_active tinyint(1) not null default 1,
  notes text,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  unique key uk_customers_org_customer_code (organization_id, customer_code),
  key idx_customers_organization (organization_id),
  key idx_customers_group (group_id),
  constraint fk_customers_organization
    foreign key (organization_id) references organizations(id),
  constraint fk_customers_group
    foreign key (group_id) references customer_groups(id)
);

create table states (
  id bigint unsigned auto_increment primary key,
  organization_id bigint unsigned not null,
  state_name varchar(100) not null,
  state_code varchar(20),
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp,
  unique key uk_states_org_state_name (organization_id, state_name),
  key idx_states_organization (organization_id),
  constraint fk_states_organization
    foreign key (organization_id) references organizations(id)
);

create table cities (
  id bigint unsigned auto_increment primary key,
  organization_id bigint unsigned not null,
  state_id bigint unsigned not null,
  city_name varchar(100) not null,
  city_code varchar(20),
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp,
  unique key uk_cities_org_state_city (organization_id, state_id, city_name),
  key idx_cities_organization (organization_id),
  key idx_cities_state (state_id),
  constraint fk_cities_organization
    foreign key (organization_id) references organizations(id),
  constraint fk_cities_state
    foreign key (state_id) references states(id)
);

create table product_categories (
  id bigint unsigned auto_increment primary key,
  organization_id bigint unsigned not null,
  category_name varchar(100) not null,
  parent_category_id bigint unsigned null,
  is_active tinyint(1) not null default 1,
  created_at datetime not null default current_timestamp,
  unique key uk_product_categories_org_category_name (organization_id, category_name),
  key idx_product_categories_organization (organization_id),
  key idx_product_categories_parent (parent_category_id),
  constraint fk_product_categories_organization
    foreign key (organization_id) references organizations(id),
  constraint fk_product_categories_parent
    foreign key (parent_category_id) references product_categories(id)
);

create table leads (
  id bigint unsigned auto_increment primary key,
  organization_id bigint unsigned not null,
  lead_date date not null,
  description text,
  due_date date,
  client_name varchar(150) not null,
  priority varchar(20) not null default 'Medium',
  assigned_to_user_id bigint unsigned null,
  category_id bigint unsigned null,
  sub_category_id bigint unsigned null,
  notes text,
  lead_status varchar(40) not null default 'Pending Assigning',
  latest_update_date date,
  next_follow_up_date date,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  key idx_leads_organization (organization_id),
  key idx_leads_status (lead_status),
  key idx_leads_due_date (due_date),
  key idx_leads_assigned_user (assigned_to_user_id),
  key idx_leads_category (category_id),
  key idx_leads_sub_category (sub_category_id),
  constraint fk_leads_organization
    foreign key (organization_id) references organizations(id),
  constraint fk_leads_assigned_user
    foreign key (assigned_to_user_id) references users(id),
  constraint fk_leads_category
    foreign key (category_id) references product_categories(id),
  constraint fk_leads_sub_category
    foreign key (sub_category_id) references product_categories(id)
);

create table lead_updates (
  id bigint unsigned auto_increment primary key,
  organization_id bigint unsigned not null,
  lead_id bigint unsigned not null,
  status varchar(20) not null,
  update_date date not null,
  update_by_user_id bigint unsigned not null,
  next_follow_up_date date,
  remarks text,
  created_at datetime not null default current_timestamp,
  key idx_lead_updates_organization (organization_id),
  key idx_lead_updates_lead (lead_id),
  key idx_lead_updates_user (update_by_user_id),
  key idx_lead_updates_date (update_date),
  constraint fk_lead_updates_organization
    foreign key (organization_id) references organizations(id),
  constraint fk_lead_updates_lead
    foreign key (lead_id) references leads(id),
  constraint fk_lead_updates_user
    foreign key (update_by_user_id) references users(id)
);

create table tasks (
  id bigint unsigned auto_increment primary key,
  organization_id bigint unsigned not null,
  task_date date not null,
  description text,
  due_date date,
  client_name varchar(150) not null,
  priority varchar(20) not null default 'Medium',
  assigned_to_user_id bigint unsigned null,
  category_id bigint unsigned null,
  sub_category_id bigint unsigned null,
  notes text,
  task_status varchar(40) not null default 'Pending',
  latest_update_date date,
  next_follow_up_date date,
  created_at datetime not null default current_timestamp,
  updated_at datetime not null default current_timestamp on update current_timestamp,
  key idx_tasks_organization (organization_id),
  key idx_tasks_status (task_status),
  key idx_tasks_due_date (due_date),
  key idx_tasks_assigned_user (assigned_to_user_id),
  key idx_tasks_category (category_id),
  key idx_tasks_sub_category (sub_category_id),
  constraint fk_tasks_organization
    foreign key (organization_id) references organizations(id),
  constraint fk_tasks_assigned_user
    foreign key (assigned_to_user_id) references users(id),
  constraint fk_tasks_category
    foreign key (category_id) references product_categories(id),
  constraint fk_tasks_sub_category
    foreign key (sub_category_id) references product_categories(id)
);

create table task_updates (
  id bigint unsigned auto_increment primary key,
  organization_id bigint unsigned not null,
  task_id bigint unsigned not null,
  status varchar(20) not null,
  update_date date not null,
  update_by_user_id bigint unsigned not null,
  next_follow_up_date date,
  remarks text,
  created_at datetime not null default current_timestamp,
  key idx_task_updates_organization (organization_id),
  key idx_task_updates_task (task_id),
  key idx_task_updates_user (update_by_user_id),
  key idx_task_updates_date (update_date),
  constraint fk_task_updates_organization
    foreign key (organization_id) references organizations(id),
  constraint fk_task_updates_task
    foreign key (task_id) references tasks(id),
  constraint fk_task_updates_user
    foreign key (update_by_user_id) references users(id)
);
