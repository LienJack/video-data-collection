-- Migration 0020 was already applied on the NAS development database, so its
-- history must remain immutable. Remove the temporary fixture-only bypass and
-- restore the strict transition guard additively for every environment.
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

drop function if exists egocapture.refresh_demo_fixture_lifecycles();

notify pgrst, 'reload schema';
