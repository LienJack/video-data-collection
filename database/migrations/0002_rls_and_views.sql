create or replace function egocapture.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, egocapture
as $$
  select id from egocapture.profiles where auth_user_id = auth.uid() limit 1
$$;

create or replace function egocapture.has_study_access(target_study_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, egocapture
as $$
  select exists (
    select 1
    from egocapture.study_memberships membership
    join egocapture.profiles profile on profile.id = membership.profile_id
    where membership.study_id = target_study_id
      and membership.status = 'active'
      and profile.auth_user_id = auth.uid()
  )
$$;

create or replace function egocapture.is_own_participant(target_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, egocapture
as $$
  select exists (
    select 1 from egocapture.participants participant
    where participant.id = target_participant_id
      and participant.auth_user_id = auth.uid()
  )
$$;

create or replace function egocapture.can_read_study(target_study_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, egocapture
as $$
  select egocapture.has_study_access(target_study_id) or exists (
    select 1 from egocapture.participants participant
    where participant.study_id = target_study_id
      and participant.auth_user_id = auth.uid()
  )
$$;

revoke all on function egocapture.current_profile_id() from public;
revoke all on function egocapture.has_study_access(uuid) from public;
revoke all on function egocapture.is_own_participant(uuid) from public;
revoke all on function egocapture.can_read_study(uuid) from public;
grant execute on function egocapture.current_profile_id() to authenticated, service_role;
grant execute on function egocapture.has_study_access(uuid) to authenticated, service_role;
grant execute on function egocapture.is_own_participant(uuid) to authenticated, service_role;
grant execute on function egocapture.can_read_study(uuid) to authenticated, service_role;

alter table egocapture.studies enable row level security;
alter table egocapture.profiles enable row level security;
alter table egocapture.study_memberships enable row level security;
alter table egocapture.participants enable row level security;
alter table egocapture.participant_invitations enable row level security;
alter table egocapture.consent_records enable row level security;
alter table egocapture.devices enable row level security;
alter table egocapture.device_assignments enable row level security;
alter table egocapture.tasks enable row level security;
alter table egocapture.task_versions enable row level security;
alter table egocapture.assignments enable row level security;
alter table egocapture.recording_sessions enable row level security;
alter table egocapture.session_markers enable row level security;
alter table egocapture.upload_batches enable row level security;
alter table egocapture.upload_intents enable row level security;
alter table egocapture.upload_attempts enable row level security;
alter table egocapture.stored_objects enable row level security;
alter table egocapture.video_assets enable row level security;
alter table egocapture.asset_files enable row level security;
alter table egocapture.video_file_metadata enable row level security;
alter table egocapture.metadata_evidence enable row level security;
alter table egocapture.metadata_attempts enable row level security;
alter table egocapture.match_decisions enable row level security;
alter table egocapture.review_cases enable row level security;
alter table egocapture.audit_events enable row level security;
alter table egocapture.command_receipts enable row level security;

drop policy if exists studies_select on egocapture.studies;
create policy studies_select on egocapture.studies for select to authenticated
using (egocapture.can_read_study(id));

drop policy if exists profiles_select_self on egocapture.profiles;
create policy profiles_select_self on egocapture.profiles for select to authenticated
using (auth_user_id = auth.uid());

drop policy if exists memberships_select on egocapture.study_memberships;
create policy memberships_select on egocapture.study_memberships for select to authenticated
using (profile_id = egocapture.current_profile_id() or egocapture.has_study_access(study_id));

drop policy if exists participants_select on egocapture.participants;
create policy participants_select on egocapture.participants for select to authenticated
using (auth_user_id = auth.uid() or egocapture.has_study_access(study_id));

drop policy if exists invitations_admin_select on egocapture.participant_invitations;
create policy invitations_admin_select on egocapture.participant_invitations for select to authenticated
using (
  exists (
    select 1 from egocapture.participants participant
    where participant.id = participant_id
      and egocapture.has_study_access(participant.study_id)
  )
);

drop policy if exists consent_select on egocapture.consent_records;
create policy consent_select on egocapture.consent_records for select to authenticated
using (
  egocapture.is_own_participant(participant_id)
  or exists (
    select 1 from egocapture.participants participant
    where participant.id = participant_id
      and egocapture.has_study_access(participant.study_id)
  )
);

drop policy if exists devices_select on egocapture.devices;
create policy devices_select on egocapture.devices for select to authenticated
using (
  egocapture.has_study_access(study_id)
  or exists (
    select 1 from egocapture.device_assignments assignment
    join egocapture.participants participant on participant.id = assignment.participant_id
    where assignment.device_id = devices.id
      and assignment.ended_at is null
      and participant.auth_user_id = auth.uid()
  )
);

drop policy if exists device_assignments_select on egocapture.device_assignments;
create policy device_assignments_select on egocapture.device_assignments for select to authenticated
using (
  egocapture.is_own_participant(participant_id)
  or exists (
    select 1 from egocapture.devices device
    where device.id = device_id and egocapture.has_study_access(device.study_id)
  )
);

drop policy if exists tasks_select on egocapture.tasks;
create policy tasks_select on egocapture.tasks for select to authenticated
using (
  egocapture.has_study_access(study_id)
  or exists (
    select 1
    from egocapture.task_versions version
    join egocapture.assignments assignment on assignment.task_version_id = version.id
    join egocapture.participants participant on participant.id = assignment.participant_id
    where version.task_id = tasks.id and participant.auth_user_id = auth.uid()
  )
);

drop policy if exists task_versions_select on egocapture.task_versions;
create policy task_versions_select on egocapture.task_versions for select to authenticated
using (
  egocapture.has_study_access(study_id)
  or exists (
    select 1
    from egocapture.assignments assignment
    join egocapture.participants participant on participant.id = assignment.participant_id
    where assignment.task_version_id = task_versions.id and participant.auth_user_id = auth.uid()
  )
);

drop policy if exists assignments_select on egocapture.assignments;
create policy assignments_select on egocapture.assignments for select to authenticated
using (egocapture.has_study_access(study_id) or egocapture.is_own_participant(participant_id));

drop policy if exists sessions_select on egocapture.recording_sessions;
create policy sessions_select on egocapture.recording_sessions for select to authenticated
using (egocapture.has_study_access(study_id) or egocapture.is_own_participant(participant_id));

drop policy if exists markers_select on egocapture.session_markers;
create policy markers_select on egocapture.session_markers for select to authenticated
using (
  exists (
    select 1 from egocapture.recording_sessions session
    where session.id = session_id
      and (
        egocapture.has_study_access(session.study_id)
        or egocapture.is_own_participant(session.participant_id)
      )
  )
);

drop policy if exists upload_batches_select on egocapture.upload_batches;
create policy upload_batches_select on egocapture.upload_batches for select to authenticated
using (egocapture.has_study_access(study_id) or egocapture.is_own_participant(participant_id));

drop policy if exists upload_intents_select on egocapture.upload_intents;
create policy upload_intents_select on egocapture.upload_intents for select to authenticated
using (egocapture.has_study_access(study_id) or egocapture.is_own_participant(participant_id));

drop policy if exists upload_attempts_select on egocapture.upload_attempts;
create policy upload_attempts_select on egocapture.upload_attempts for select to authenticated
using (
  exists (
    select 1 from egocapture.upload_intents intent
    where intent.id = upload_intent_id
      and (
        egocapture.has_study_access(intent.study_id)
        or egocapture.is_own_participant(intent.participant_id)
      )
  )
);

drop policy if exists stored_objects_select on egocapture.stored_objects;
create policy stored_objects_select on egocapture.stored_objects for select to authenticated
using (
  exists (
    select 1 from egocapture.upload_intents intent
    where intent.id = upload_intent_id
      and (
        egocapture.has_study_access(intent.study_id)
        or egocapture.is_own_participant(intent.participant_id)
      )
  )
);

drop policy if exists video_assets_select on egocapture.video_assets;
create policy video_assets_select on egocapture.video_assets for select to authenticated
using (egocapture.has_study_access(study_id) or egocapture.is_own_participant(participant_id));

drop policy if exists asset_files_select on egocapture.asset_files;
create policy asset_files_select on egocapture.asset_files for select to authenticated
using (
  exists (
    select 1 from egocapture.video_assets asset
    where asset.id = video_asset_id
      and (
        egocapture.has_study_access(asset.study_id)
        or egocapture.is_own_participant(asset.participant_id)
      )
  )
);

drop policy if exists file_metadata_select on egocapture.video_file_metadata;
create policy file_metadata_select on egocapture.video_file_metadata for select to authenticated
using (
  exists (
    select 1 from egocapture.video_assets asset
    where asset.id = video_asset_id
      and (
        egocapture.has_study_access(asset.study_id)
        or egocapture.is_own_participant(asset.participant_id)
      )
  )
);

drop policy if exists metadata_evidence_admin_select on egocapture.metadata_evidence;
create policy metadata_evidence_admin_select on egocapture.metadata_evidence for select to authenticated
using (
  exists (
    select 1 from egocapture.video_assets asset
    where asset.id = video_asset_id and egocapture.has_study_access(asset.study_id)
  )
);

drop policy if exists metadata_attempts_admin_select on egocapture.metadata_attempts;
create policy metadata_attempts_admin_select on egocapture.metadata_attempts for select to authenticated
using (
  exists (
    select 1 from egocapture.video_assets asset
    where asset.id = video_asset_id and egocapture.has_study_access(asset.study_id)
  )
);

drop policy if exists match_decisions_select on egocapture.match_decisions;
create policy match_decisions_select on egocapture.match_decisions for select to authenticated
using (
  exists (
    select 1 from egocapture.video_assets asset
    where asset.id = video_asset_id
      and (
        egocapture.has_study_access(asset.study_id)
        or egocapture.is_own_participant(asset.participant_id)
      )
  )
);

drop policy if exists review_cases_admin_select on egocapture.review_cases;
create policy review_cases_admin_select on egocapture.review_cases for select to authenticated
using (egocapture.has_study_access(study_id));

drop policy if exists audit_events_admin_select on egocapture.audit_events;
create policy audit_events_admin_select on egocapture.audit_events for select to authenticated
using (study_id is not null and egocapture.has_study_access(study_id));

create or replace view egocapture.current_match_decisions
with (security_invoker = true)
as
select decision.*
from egocapture.match_decisions decision
where decision.superseded_by is null;

create or replace view egocapture.assignment_progress
with (security_invoker = true)
as
select
  assignment.id,
  assignment.public_id,
  assignment.study_id,
  assignment.participant_id,
  assignment.task_version_id,
  assignment.status,
  assignment.due_at,
  count(distinct session.id) as session_count,
  count(distinct asset.id) filter (where asset.status = 'active') as accepted_asset_candidates,
  (
    assignment.due_at < now()
    and assignment.status <> 'canceled'
    and count(distinct asset.id) filter (where asset.status = 'active') = 0
  ) as is_missing
from egocapture.assignments assignment
left join egocapture.recording_sessions session on session.assignment_id = assignment.id
left join egocapture.current_match_decisions decision on decision.resolved_session_id = session.id
left join egocapture.video_assets asset on asset.id = decision.video_asset_id
group by assignment.id;

create or replace view egocapture.missing_assignments
with (security_invoker = true)
as
select * from egocapture.assignment_progress where is_missing;

create or replace view egocapture.device_consistency_results
with (security_invoker = true)
as
select
  asset.id as video_asset_id,
  asset.public_id as video_asset_public_id,
  session.id as recording_session_id,
  declared.id as declared_device_id,
  declared.public_id as declared_device_public_id,
  decision.resolved_device_id,
  metadata.device_consistency,
  metadata.camera_manufacturer,
  metadata.camera_model,
  metadata.camera_serial_hash
from egocapture.video_assets asset
left join egocapture.current_match_decisions decision on decision.video_asset_id = asset.id
left join egocapture.recording_sessions session on session.id = decision.resolved_session_id
left join egocapture.devices declared on declared.id = session.declared_device_id
left join egocapture.video_file_metadata metadata on metadata.video_asset_id = asset.id;

create or replace view egocapture.open_review_queue
with (security_invoker = true)
as
select review.*
from egocapture.review_cases review
where review.status in ('open', 'in_review');

grant usage on schema egocapture to authenticated, service_role;
grant select on all tables in schema egocapture to authenticated;
grant select, insert, update, delete on all tables in schema egocapture to service_role;
grant usage, select on all sequences in schema egocapture to service_role;
revoke all on egocapture.schema_migrations, egocapture.command_receipts from authenticated;

alter default privileges for role postgres in schema egocapture
  grant select on tables to authenticated;
alter default privileges for role postgres in schema egocapture
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema egocapture
  grant usage, select on sequences to service_role;
