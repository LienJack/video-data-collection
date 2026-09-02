create table if not exists egocapture.participant_login_credentials (
  participant_id uuid primary key references egocapture.participants(id) on delete restrict,
  password text not null check (char_length(password) between 12 and 128),
  version integer not null check (version > 0),
  updated_at timestamptz not null,
  synced_at timestamptz,
  check (synced_at is null or synced_at >= updated_at)
);

alter table egocapture.participant_login_credentials enable row level security;

-- Participant credentials are intentionally readable by the server-side Admin
-- API, but must not be selectable through PostgREST by any browser role.
revoke all on egocapture.participant_login_credentials from public, anon, authenticated;
grant select, insert, update, delete on egocapture.participant_login_credentials to service_role;

notify pgrst, 'reload schema';
