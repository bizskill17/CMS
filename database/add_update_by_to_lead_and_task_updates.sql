ALTER TABLE lead_updates
  ADD COLUMN update_by_user_id BIGINT UNSIGNED NOT NULL AFTER update_date,
  ADD CONSTRAINT fk_lead_updates_user
    FOREIGN KEY (update_by_user_id) REFERENCES users(id);

ALTER TABLE task_updates
  ADD COLUMN update_by_user_id BIGINT UNSIGNED NOT NULL AFTER update_date,
  ADD CONSTRAINT fk_task_updates_user
    FOREIGN KEY (update_by_user_id) REFERENCES users(id);
