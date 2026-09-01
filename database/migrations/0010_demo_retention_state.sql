alter table egocapture.stored_objects
  add column if not exists deleted_at timestamptz,
  add column if not exists delete_reason text;

alter table egocapture.stored_objects
  drop constraint if exists stored_objects_delete_consistency_check;

alter table egocapture.stored_objects
  add constraint stored_objects_delete_consistency_check
  check ((deleted_at is null) = (delete_reason is null));

create index if not exists stored_objects_demo_retention_idx
  on egocapture.stored_objects (created_at, id)
  where deleted_at is null;
