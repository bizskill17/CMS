alter table organizations
  add column organization_code varchar(100) null after id;

update organizations
set organization_code = cast(id as char)
where organization_code is null or trim(organization_code) = '';

alter table organizations
  modify organization_code varchar(100) not null,
  add unique key uk_organizations_code (organization_code);