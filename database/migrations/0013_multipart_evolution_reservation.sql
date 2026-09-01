alter table egocapture.upload_attempts
  add column if not exists storage_region text,
  add column if not exists part_manifest jsonb,
  add column if not exists completion_receipt jsonb;

alter table egocapture.upload_attempts
  drop constraint if exists upload_attempts_storage_region_length,
  add constraint upload_attempts_storage_region_length
    check (storage_region is null or char_length(storage_region) between 1 and 80),
  drop constraint if exists upload_attempts_part_manifest_array,
  add constraint upload_attempts_part_manifest_array
    check (part_manifest is null or jsonb_typeof(part_manifest) = 'array'),
  drop constraint if exists upload_attempts_completion_receipt_object,
  add constraint upload_attempts_completion_receipt_object
    check (completion_receipt is null or jsonb_typeof(completion_receipt) = 'object');

create table if not exists egocapture.multipart_upload_parts (
  id uuid primary key default gen_random_uuid(),
  upload_attempt_id uuid not null references egocapture.upload_attempts(id) on delete restrict,
  part_number integer not null check (part_number > 0),
  size_bytes bigint not null check (size_bytes > 0),
  etag text,
  checksum text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (upload_attempt_id, part_number)
);

alter table egocapture.multipart_upload_parts enable row level security;
revoke all on egocapture.multipart_upload_parts from public, anon, authenticated;

notify pgrst, 'reload schema';
