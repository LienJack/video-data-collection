create schema if not exists egocapture authorization postgres;

create or replace function egocapture.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function egocapture.reject_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception using
    errcode = '55000',
    message = format('%I.%I is append-only', tg_table_schema, tg_table_name);
end;
$$;

create table if not exists egocapture.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  role text not null check (role in ('admin', 'participant')),
  display_name text not null check (char_length(display_name) between 1 and 120),
  is_demo_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists egocapture.participants (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^PT-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$'),
  auth_user_id uuid unique references auth.users(id) on delete restrict,
  display_alias text not null check (char_length(display_alias) between 1 and 120),
  management_email text,
  locale text not null default 'zh-CN' check (char_length(locale) between 2 and 20),
  timezone text not null default 'Asia/Shanghai' check (char_length(timezone) between 3 and 64),
  country_region text check (country_region is null or char_length(country_region) <= 80),
  status text not null default 'draft' check (status in ('draft', 'invited', 'active', 'suspended', 'withdrawn', 'expired')),
  consent_status text not null default 'pending' check (consent_status in ('pending', 'valid', 'expired', 'withdrawn')),
  notes text check (notes is null or char_length(notes) <= 500),
  is_fixture boolean not null default false,
  created_by uuid references egocapture.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  check ((status = 'withdrawn') = (withdrawn_at is not null))
);

create index if not exists participants_status_idx
  on egocapture.participants (status, public_id);

create table if not exists egocapture.participant_invitations (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references egocapture.participants(id) on delete restrict,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  status text not null default 'generated' check (status in ('generated', 'opened', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null,
  opened_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references egocapture.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create unique index if not exists participant_one_live_invitation_idx
  on egocapture.participant_invitations (participant_id)
  where status in ('generated', 'opened');

create table if not exists egocapture.consent_records (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references egocapture.participants(id) on delete restrict,
  version text not null check (char_length(version) between 1 and 40),
  status text not null check (status in ('accepted', 'withdrawn', 'expired')),
  recorded_by uuid references egocapture.profiles(id) on delete restrict,
  accepted_at timestamptz,
  effective_until timestamptz,
  reason text check (reason is null or char_length(reason) between 10 and 500),
  created_at timestamptz not null default now(),
  check ((status = 'accepted') = (accepted_at is not null))
);

create index if not exists consent_participant_created_idx
  on egocapture.consent_records (participant_id, created_at desc);

create table if not exists egocapture.devices (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^DEV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$'),
  manufacturer text not null check (char_length(manufacturer) between 1 and 80),
  model text not null check (char_length(model) between 1 and 120),
  device_type text not null check (device_type in ('phone', 'action_camera', 'camera', 'other')),
  serial_hmac text check (serial_hmac is null or serial_hmac ~ '^[a-f0-9]{64}$'),
  firmware_version text check (firmware_version is null or char_length(firmware_version) <= 80),
  status text not null default 'active' check (status in ('active', 'lost', 'retired', 'shared')),
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz
);

create table if not exists egocapture.device_assignments (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references egocapture.devices(id) on delete restrict,
  participant_id uuid not null references egocapture.participants(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  assigned_by uuid not null references egocapture.profiles(id) on delete restrict,
  reason text check (reason is null or char_length(reason) between 10 and 500),
  check (ended_at is null or ended_at > assigned_at)
);

create unique index if not exists device_one_current_assignment_idx
  on egocapture.device_assignments (device_id)
  where ended_at is null;

create table if not exists egocapture.tasks (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^TSK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$'),
  title text not null check (char_length(title) between 2 and 160),
  lifecycle text not null default 'draft' check (lifecycle in ('draft', 'active', 'archived')),
  draft_instructions jsonb not null,
  is_fixture boolean not null default false,
  created_by uuid not null references egocapture.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists egocapture.task_versions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references egocapture.tasks(id) on delete restrict,
  version integer not null check (version > 0),
  instructions jsonb not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  published_by uuid not null references egocapture.profiles(id) on delete restrict,
  published_at timestamptz not null default now(),
  unique (task_id, version)
);

create table if not exists egocapture.assignments (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^AS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$'),
  participant_id uuid not null references egocapture.participants(id) on delete restrict,
  task_version_id uuid not null references egocapture.task_versions(id) on delete restrict,
  preferred_device_id uuid references egocapture.devices(id) on delete restrict,
  due_at timestamptz not null,
  locale text not null check (char_length(locale) between 2 and 20),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'assigned' check (status in (
    'assigned', 'acknowledged', 'session_created', 'uploading', 'submitted',
    'needs_review', 'rework_required', 'accepted', 'expired', 'missing_upload',
    'canceled'
  )),
  acknowledged_at timestamptz,
  acknowledged_content_hash text check (acknowledged_content_hash is null or acknowledged_content_hash ~ '^[a-f0-9]{64}$'),
  canceled_at timestamptz,
  created_by uuid not null references egocapture.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((acknowledged_at is null) = (acknowledged_content_hash is null))
);

create unique index if not exists assignment_one_active_task_version_idx
  on egocapture.assignments (participant_id, task_version_id)
  where status not in ('accepted', 'expired', 'canceled');

create index if not exists assignments_status_due_idx
  on egocapture.assignments (status, due_at, public_id);

create table if not exists egocapture.recording_sessions (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^RS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$'),
  assignment_id uuid not null references egocapture.assignments(id) on delete restrict,
  participant_id uuid not null references egocapture.participants(id) on delete restrict,
  task_version_id uuid not null references egocapture.task_versions(id) on delete restrict,
  declared_device_id uuid not null references egocapture.devices(id) on delete restrict,
  timezone text not null check (char_length(timezone) between 3 and 64),
  status text not null default 'open' check (status in ('open', 'closed')),
  marker_acknowledged_at timestamptz,
  closed_at timestamptz,
  close_reason text check (close_reason is null or char_length(close_reason) between 10 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'closed') = (closed_at is not null))
);

create index if not exists sessions_participant_status_idx
  on egocapture.recording_sessions (participant_id, status, created_at desc);

create table if not exists egocapture.session_markers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references egocapture.recording_sessions(id) on delete restrict,
  marker_jws text not null unique,
  payload jsonb not null,
  key_id text not null check (char_length(key_id) between 1 and 80),
  nonce text not null unique,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > issued_at)
);

create table if not exists egocapture.upload_batches (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^UB-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$'),
  participant_id uuid not null references egocapture.participants(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'completed', 'aborted', 'expired')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists egocapture.upload_intents (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^UP-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$'),
  batch_id uuid not null references egocapture.upload_batches(id) on delete restrict,
  participant_id uuid not null references egocapture.participants(id) on delete restrict,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  size_bytes bigint not null check (size_bytes between 1 and 50000000),
  content_type text not null check (content_type in ('video/mp4', 'video/quicktime', 'application/octet-stream')),
  extension text not null check (extension in ('mp4', 'mov', 'insv')),
  local_modified_at timestamptz,
  object_key text not null unique check (object_key ~ '^participant/[0-9a-f-]+/upload/[0-9a-f-]+/[0-9a-f-]+\.(mp4|mov|insv)$'),
  claimed_session_id uuid references egocapture.recording_sessions(id) on delete restrict,
  unable_to_determine boolean not null default false,
  participant_note text check (participant_note is null or char_length(participant_note) <= 500),
  fingerprint_v1 text not null check (fingerprint_v1 ~ '^[a-f0-9]{64}$'),
  transfer_status text not null default 'created' check (transfer_status in ('created', 'uploading', 'reconciling', 'verified', 'failed', 'aborted', 'expired')),
  metadata_status text not null default 'pending' check (metadata_status in ('pending', 'processing', 'extracted', 'partial', 'unsupported', 'failed')),
  expected_expires_at timestamptz not null,
  verified_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (claimed_session_id is not null or unable_to_determine),
  check (not (claimed_session_id is not null and unable_to_determine))
);

create index if not exists upload_intents_participant_created_idx
  on egocapture.upload_intents (participant_id, created_at desc);
create index if not exists upload_duplicate_candidate_idx
  on egocapture.upload_intents (participant_id, size_bytes, fingerprint_v1);

create table if not exists egocapture.upload_attempts (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^UA-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$'),
  upload_intent_id uuid not null references egocapture.upload_intents(id) on delete restrict,
  attempt_number integer not null check (attempt_number > 0),
  provider text not null default 'supabase_tus' check (provider in ('supabase_tus', 's3_multipart')),
  provider_upload_id text,
  tus_resource_url text,
  status text not null default 'created' check (status in ('created', 'uploading', 'paused', 'completed', 'failed', 'aborted', 'expired')),
  bytes_uploaded bigint not null default 0 check (bytes_uploaded >= 0),
  expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (upload_intent_id, attempt_number)
);

create table if not exists egocapture.stored_objects (
  id uuid primary key default gen_random_uuid(),
  upload_intent_id uuid not null unique references egocapture.upload_intents(id) on delete restrict,
  provider text not null check (provider in ('supabase', 's3')),
  bucket text not null,
  object_key text not null unique,
  size_bytes bigint not null check (size_bytes > 0),
  etag text,
  verified_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists egocapture.video_assets (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^VA-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$'),
  upload_intent_id uuid not null unique references egocapture.upload_intents(id) on delete restrict,
  participant_id uuid not null references egocapture.participants(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'rejected', 'deleted')),
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists egocapture.asset_files (
  id uuid primary key default gen_random_uuid(),
  video_asset_id uuid not null references egocapture.video_assets(id) on delete restrict,
  stored_object_id uuid not null references egocapture.stored_objects(id) on delete restrict,
  file_role text not null default 'source' check (file_role in ('source', 'companion', 'future_proxy')),
  created_at timestamptz not null default now(),
  unique (video_asset_id, stored_object_id)
);

create table if not exists egocapture.video_file_metadata (
  id uuid primary key default gen_random_uuid(),
  video_asset_id uuid not null unique references egocapture.video_assets(id) on delete restrict,
  parser_name text not null,
  parser_version text not null,
  container_format text,
  duration_ms bigint check (duration_ms is null or duration_ms >= 0),
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes > 0),
  video_codec text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  frame_rate numeric check (frame_rate is null or frame_rate > 0),
  bitrate bigint check (bitrate is null or bitrate >= 0),
  audio_codec text,
  audio_channels integer check (audio_channels is null or audio_channels >= 0),
  normalized_capture_time timestamptz,
  capture_time_source text check (capture_time_source is null or capture_time_source in ('quicktime_with_timezone', 'container', 'track', 'local_modified', 'unknown')),
  capture_time_confidence text not null default 'unknown' check (capture_time_confidence in ('high', 'medium', 'low', 'unknown')),
  timezone_offset text,
  camera_manufacturer text,
  camera_model text,
  camera_serial_hash text check (camera_serial_hash is null or camera_serial_hash ~ '^[a-f0-9]{64}$'),
  gps_metadata_present boolean not null default false,
  projection_type text,
  is_360 boolean,
  device_consistency text not null default 'metadata_unavailable' check (device_consistency in ('matched', 'partial_match', 'metadata_unavailable', 'model_mismatch', 'serial_mismatch', 'metadata_conflict')),
  extracted_at timestamptz not null default now()
);

create table if not exists egocapture.metadata_evidence (
  id uuid primary key default gen_random_uuid(),
  video_asset_id uuid not null references egocapture.video_assets(id) on delete restrict,
  field_name text not null check (field_name ~ '^[a-z0-9_]{1,80}$'),
  normalized_value jsonb not null,
  parser_name text not null,
  source text not null check (char_length(source) between 1 and 160),
  created_at timestamptz not null default now()
);

create table if not exists egocapture.metadata_attempts (
  id uuid primary key default gen_random_uuid(),
  video_asset_id uuid not null references egocapture.video_assets(id) on delete restrict,
  attempt_number integer not null check (attempt_number between 1 and 99),
  parser_name text not null,
  parser_version text not null,
  status text not null check (status in ('processing', 'extracted', 'partial', 'unsupported', 'failed')),
  range_request_count integer not null default 0 check (range_request_count between 0 and 24),
  bytes_read bigint not null default 0 check (bytes_read between 0 and 16777216),
  started_at timestamptz not null,
  completed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  unique (video_asset_id, attempt_number)
);

create table if not exists egocapture.match_decisions (
  id uuid primary key default gen_random_uuid(),
  video_asset_id uuid not null references egocapture.video_assets(id) on delete restrict,
  claimed_session_id uuid references egocapture.recording_sessions(id) on delete restrict,
  resolved_session_id uuid references egocapture.recording_sessions(id) on delete restrict,
  resolved_device_id uuid references egocapture.devices(id) on delete restrict,
  decision_type text not null check (decision_type in ('participant_claim', 'admin_confirmed', 'admin_corrected', 'unmatched', 'rejected')),
  reason text check (reason is null or char_length(reason) between 10 and 500),
  supersedes_decision_id uuid unique references egocapture.match_decisions(id) on delete restrict,
  superseded_by uuid unique references egocapture.match_decisions(id) on delete restrict,
  decided_by uuid references egocapture.profiles(id) on delete restrict,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check ((decision_type in ('admin_confirmed', 'admin_corrected', 'rejected')) = (reason is not null))
);

create unique index if not exists match_one_current_decision_idx
  on egocapture.match_decisions (video_asset_id)
  where superseded_by is null;

create table if not exists egocapture.review_cases (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique check (public_id ~ '^RV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$'),
  video_asset_id uuid references egocapture.video_assets(id) on delete restrict,
  assignment_id uuid references egocapture.assignments(id) on delete restrict,
  case_type text not null check (case_type in ('missing', 'upload_failed', 'metadata_failed', 'duplicate_candidate', 'unmatched', 'device_mismatch', 'needs_review')),
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  reason text,
  resolution_reason text check (resolution_reason is null or char_length(resolution_reason) between 10 and 500),
  is_fixture boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (video_asset_id is not null or assignment_id is not null)
);

create index if not exists review_queue_idx
  on egocapture.review_cases (status, case_type, created_at);

create table if not exists egocapture.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references egocapture.profiles(id) on delete restrict,
  actor_auth_user_id uuid references auth.users(id) on delete restrict,
  action text not null check (action ~ '^[a-z][a-z0-9_.]{2,120}$'),
  entity_type text not null check (entity_type ~ '^[a-z][a-z0-9_]{1,80}$'),
  entity_public_id text,
  reason text check (reason is null or char_length(reason) between 10 and 500),
  request_id uuid not null,
  before_values jsonb,
  after_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_created_idx
  on egocapture.audit_events (created_at desc);

create table if not exists egocapture.command_receipts (
  id uuid primary key default gen_random_uuid(),
  actor_auth_user_id uuid references auth.users(id) on delete restrict,
  command_name text not null check (command_name ~ '^[a-z][a-z0-9_.]{2,120}$'),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 200),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  response_status integer not null check (response_status between 200 and 599),
  response_body jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique nulls not distinct (actor_auth_user_id, command_name, idempotency_key),
  check (expires_at > created_at)
);

create or replace function egocapture.guard_match_decision_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.superseded_by is not null
    or new.superseded_by is null
    or (to_jsonb(new) - 'superseded_by') is distinct from (to_jsonb(old) - 'superseded_by') then
    raise exception using errcode = '55000', message = 'match_decisions are immutable except one-time superseded_by linkage';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on egocapture.profiles;
create trigger profiles_touch_updated_at before update on egocapture.profiles
for each row execute function egocapture.touch_updated_at();
drop trigger if exists participants_touch_updated_at on egocapture.participants;
create trigger participants_touch_updated_at before update on egocapture.participants
for each row execute function egocapture.touch_updated_at();
drop trigger if exists devices_touch_updated_at on egocapture.devices;
create trigger devices_touch_updated_at before update on egocapture.devices
for each row execute function egocapture.touch_updated_at();
drop trigger if exists tasks_touch_updated_at on egocapture.tasks;
create trigger tasks_touch_updated_at before update on egocapture.tasks
for each row execute function egocapture.touch_updated_at();
drop trigger if exists assignments_touch_updated_at on egocapture.assignments;
create trigger assignments_touch_updated_at before update on egocapture.assignments
for each row execute function egocapture.touch_updated_at();
drop trigger if exists sessions_touch_updated_at on egocapture.recording_sessions;
create trigger sessions_touch_updated_at before update on egocapture.recording_sessions
for each row execute function egocapture.touch_updated_at();
drop trigger if exists upload_intents_touch_updated_at on egocapture.upload_intents;
create trigger upload_intents_touch_updated_at before update on egocapture.upload_intents
for each row execute function egocapture.touch_updated_at();
drop trigger if exists upload_attempts_touch_updated_at on egocapture.upload_attempts;
create trigger upload_attempts_touch_updated_at before update on egocapture.upload_attempts
for each row execute function egocapture.touch_updated_at();
drop trigger if exists assets_touch_updated_at on egocapture.video_assets;
create trigger assets_touch_updated_at before update on egocapture.video_assets
for each row execute function egocapture.touch_updated_at();
drop trigger if exists review_cases_touch_updated_at on egocapture.review_cases;
create trigger review_cases_touch_updated_at before update on egocapture.review_cases
for each row execute function egocapture.touch_updated_at();

drop trigger if exists task_versions_reject_update on egocapture.task_versions;
create trigger task_versions_reject_update before update or delete on egocapture.task_versions
for each row execute function egocapture.reject_mutation();
drop trigger if exists consent_records_reject_update on egocapture.consent_records;
create trigger consent_records_reject_update before update or delete on egocapture.consent_records
for each row execute function egocapture.reject_mutation();
drop trigger if exists session_markers_reject_update on egocapture.session_markers;
create trigger session_markers_reject_update before update or delete on egocapture.session_markers
for each row execute function egocapture.reject_mutation();
drop trigger if exists metadata_evidence_reject_update on egocapture.metadata_evidence;
create trigger metadata_evidence_reject_update before update or delete on egocapture.metadata_evidence
for each row execute function egocapture.reject_mutation();
drop trigger if exists audit_events_reject_update on egocapture.audit_events;
create trigger audit_events_reject_update before update or delete on egocapture.audit_events
for each row execute function egocapture.reject_mutation();
drop trigger if exists match_decisions_guard_update on egocapture.match_decisions;
create trigger match_decisions_guard_update before update on egocapture.match_decisions
for each row execute function egocapture.guard_match_decision_update();
drop trigger if exists match_decisions_reject_delete on egocapture.match_decisions;
create trigger match_decisions_reject_delete before delete on egocapture.match_decisions
for each row execute function egocapture.reject_mutation();
