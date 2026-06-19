ALTER TABLE users
  ADD COLUMN login_id VARCHAR(120) NULL AFTER full_name,
  ADD COLUMN password VARCHAR(255) NULL AFTER login_id,
  ADD COLUMN views LONGTEXT NULL AFTER password,
  ADD UNIQUE KEY uq_users_login_id (login_id);
