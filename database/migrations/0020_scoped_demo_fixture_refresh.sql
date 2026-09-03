create or replace function egocapture.enforce_state_machine_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  machine_name text := TG_ARGV[0];
  column_name text := TG_ARGV[1];
  old_state text;
  new_state text;
begin
  old_state := to_jsonb(OLD) ->> column_name;
  new_state := to_jsonb(NEW) ->> column_name;
  if old_state is not distinct from new_state then
    return NEW;
  end if;
  if current_setting('egocapture.scoped_fixture_refresh', true) = 'on' then
    return NEW;
  end if;
  if exists (
    select 1
    from egocapture.state_machine_transitions transition
    where transition.machine = machine_name
      and transition.from_state = old_state
      and transition.to_state = new_state
  ) then
    return NEW;
  end if;
  raise exception using
    errcode = '23514',
    message = format('INVALID_STATE_TRANSITION:%s:%s->%s', machine_name, old_state, new_state),
    constraint = 'state_machine_transition_guard';
end;
$$;

create or replace function egocapture.refresh_demo_fixture_lifecycles()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from egocapture.participants
    where id = '30000000-0000-4000-8000-000000000001'::uuid and is_fixture
  ) then
    return false;
  end if;
  if exists (
    select 1
    from egocapture.assignments assignment
    join egocapture.participants participant on participant.id = assignment.participant_id
    where assignment.id = any(array[
      '60000000-0000-4000-8000-000000000001'::uuid,
      '60000000-0000-4000-8000-000000000002'::uuid,
      '60000000-0000-4000-8000-000000000003'::uuid,
      '60000000-0000-4000-8000-000000000004'::uuid
    ]) and not participant.is_fixture
  ) then
    raise exception 'FIXTURE_REFRESH_SCOPE_VIOLATION';
  end if;

  perform set_config('egocapture.scoped_fixture_refresh', 'on', true);
  update egocapture.participants
  set status = 'active', consent_status = 'valid', withdrawn_at = null
  where id = '30000000-0000-4000-8000-000000000001'::uuid and is_fixture;
  update egocapture.assignments assignment
  set status = expected.status, acknowledged_at = null,
    acknowledged_content_hash = null, canceled_at = null
  from (values
    ('60000000-0000-4000-8000-000000000001'::uuid, 'assigned'::text),
    ('60000000-0000-4000-8000-000000000002'::uuid, 'assigned'::text),
    ('60000000-0000-4000-8000-000000000003'::uuid, 'needs_review'::text),
    ('60000000-0000-4000-8000-000000000004'::uuid, 'assigned'::text)
  ) expected(id, status)
  where assignment.id = expected.id;
  update egocapture.recording_sessions
  set status = 'open', closed_at = null, close_reason = null
  where id = '61000000-0000-4000-8000-000000000001'::uuid;
  update egocapture.video_assets set status = 'active'
  where id = '74000000-0000-4000-8000-000000000001'::uuid and is_fixture;
  update egocapture.review_cases
  set status = 'open', resolution_reason = null, resolved_at = null
  where public_id = any(array[
    'RV-23456782', 'RV-23456783', 'RV-23456784', 'RV-23456785',
    'RV-23456786', 'RV-23456787', 'RV-23456788'
  ]) and is_fixture;
  perform set_config('egocapture.scoped_fixture_refresh', 'off', true);
  return true;
end;
$$;

revoke all on function egocapture.refresh_demo_fixture_lifecycles() from public, anon, authenticated;
grant execute on function egocapture.refresh_demo_fixture_lifecycles() to service_role;

notify pgrst, 'reload schema';
