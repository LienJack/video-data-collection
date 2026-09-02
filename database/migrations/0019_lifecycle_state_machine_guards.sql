create table if not exists egocapture.state_machine_transitions (
  machine text not null,
  from_state text not null,
  to_state text not null,
  primary key (machine, from_state, to_state),
  check (from_state <> to_state)
);

comment on table egocapture.state_machine_transitions is
  'Immutable deployed snapshot of legal lifecycle edges. Application events remain defined by XState.';

insert into egocapture.state_machine_transitions (machine, from_state, to_state) values
  ('participant.status', 'draft', 'invited'),
  ('participant.status', 'expired', 'invited'),
  ('participant.status', 'invited', 'expired'),
  ('participant.status', 'invited', 'active'),
  ('participant.status', 'active', 'suspended'),
  ('participant.status', 'suspended', 'active'),
  ('participant.status', 'draft', 'withdrawn'),
  ('participant.status', 'invited', 'withdrawn'),
  ('participant.status', 'expired', 'withdrawn'),
  ('participant.status', 'active', 'withdrawn'),
  ('participant.status', 'suspended', 'withdrawn'),
  ('participant.consent_status', 'pending', 'valid'),
  ('participant.consent_status', 'expired', 'valid'),
  ('participant.consent_status', 'valid', 'expired'),
  ('participant.consent_status', 'pending', 'withdrawn'),
  ('participant.consent_status', 'valid', 'withdrawn'),
  ('participant.consent_status', 'expired', 'withdrawn'),
  ('participant_invitation.status', 'generated', 'opened'),
  ('participant_invitation.status', 'generated', 'accepted'),
  ('participant_invitation.status', 'opened', 'accepted'),
  ('participant_invitation.status', 'generated', 'revoked'),
  ('participant_invitation.status', 'opened', 'revoked'),
  ('participant_invitation.status', 'generated', 'expired'),
  ('participant_invitation.status', 'opened', 'expired'),
  ('device.status', 'active', 'lost'),
  ('device.status', 'shared', 'lost'),
  ('device.status', 'active', 'shared'),
  ('device.status', 'lost', 'shared'),
  ('device.status', 'lost', 'active'),
  ('device.status', 'shared', 'active'),
  ('device.status', 'active', 'retired'),
  ('device.status', 'lost', 'retired'),
  ('device.status', 'shared', 'retired'),
  ('task.lifecycle', 'draft', 'active'),
  ('task.lifecycle', 'draft', 'archived'),
  ('task.lifecycle', 'active', 'archived'),
  ('assignment.status', 'assigned', 'acknowledged'),
  ('assignment.status', 'assigned', 'session_created'),
  ('assignment.status', 'acknowledged', 'session_created'),
  ('assignment.status', 'rework_required', 'session_created'),
  ('assignment.status', 'acknowledged', 'uploading'),
  ('assignment.status', 'session_created', 'uploading'),
  ('assignment.status', 'rework_required', 'uploading'),
  ('assignment.status', 'uploading', 'submitted'),
  ('assignment.status', 'session_created', 'submitted'),
  ('assignment.status', 'submitted', 'needs_review'),
  ('assignment.status', 'uploading', 'needs_review'),
  ('assignment.status', 'submitted', 'rework_required'),
  ('assignment.status', 'needs_review', 'rework_required'),
  ('assignment.status', 'submitted', 'accepted'),
  ('assignment.status', 'needs_review', 'accepted'),
  ('assignment.status', 'assigned', 'expired'),
  ('assignment.status', 'acknowledged', 'expired'),
  ('assignment.status', 'session_created', 'expired'),
  ('assignment.status', 'rework_required', 'expired'),
  ('assignment.status', 'assigned', 'missing_upload'),
  ('assignment.status', 'acknowledged', 'missing_upload'),
  ('assignment.status', 'session_created', 'missing_upload'),
  ('assignment.status', 'uploading', 'missing_upload'),
  ('assignment.status', 'expired', 'assigned'),
  ('assignment.status', 'missing_upload', 'assigned'),
  ('assignment.status', 'expired', 'acknowledged'),
  ('assignment.status', 'missing_upload', 'acknowledged'),
  ('assignment.status', 'assigned', 'canceled'),
  ('assignment.status', 'acknowledged', 'canceled'),
  ('assignment.status', 'session_created', 'canceled'),
  ('assignment.status', 'uploading', 'canceled'),
  ('assignment.status', 'submitted', 'canceled'),
  ('assignment.status', 'needs_review', 'canceled'),
  ('assignment.status', 'rework_required', 'canceled'),
  ('assignment.status', 'expired', 'canceled'),
  ('assignment.status', 'missing_upload', 'canceled'),
  ('recording_session.status', 'open', 'closed'),
  ('upload_batch.status', 'open', 'completed'),
  ('upload_batch.status', 'open', 'aborted'),
  ('upload_batch.status', 'open', 'expired'),
  ('upload_intent.transfer_status', 'created', 'uploading'),
  ('upload_intent.transfer_status', 'failed', 'uploading'),
  ('upload_intent.transfer_status', 'uploading', 'reconciling'),
  ('upload_intent.transfer_status', 'reconciling', 'verified'),
  ('upload_intent.transfer_status', 'created', 'failed'),
  ('upload_intent.transfer_status', 'uploading', 'failed'),
  ('upload_intent.transfer_status', 'reconciling', 'failed'),
  ('upload_intent.transfer_status', 'created', 'aborted'),
  ('upload_intent.transfer_status', 'uploading', 'aborted'),
  ('upload_intent.transfer_status', 'reconciling', 'aborted'),
  ('upload_intent.transfer_status', 'failed', 'aborted'),
  ('upload_intent.transfer_status', 'created', 'expired'),
  ('upload_intent.transfer_status', 'uploading', 'expired'),
  ('upload_intent.transfer_status', 'failed', 'expired'),
  ('upload_intent.metadata_status', 'pending', 'processing'),
  ('upload_intent.metadata_status', 'failed', 'processing'),
  ('upload_intent.metadata_status', 'processing', 'extracted'),
  ('upload_intent.metadata_status', 'processing', 'partial'),
  ('upload_intent.metadata_status', 'processing', 'unsupported'),
  ('upload_intent.metadata_status', 'processing', 'failed'),
  ('upload_intent.metadata_status', 'failed', 'pending'),
  ('upload_intent.metadata_status', 'processing', 'pending'),
  ('upload_attempt.status', 'created', 'uploading'),
  ('upload_attempt.status', 'paused', 'uploading'),
  ('upload_attempt.status', 'uploading', 'paused'),
  ('upload_attempt.status', 'uploading', 'completed'),
  ('upload_attempt.status', 'created', 'failed'),
  ('upload_attempt.status', 'uploading', 'failed'),
  ('upload_attempt.status', 'paused', 'failed'),
  ('upload_attempt.status', 'created', 'aborted'),
  ('upload_attempt.status', 'uploading', 'aborted'),
  ('upload_attempt.status', 'paused', 'aborted'),
  ('upload_attempt.status', 'failed', 'aborted'),
  ('upload_attempt.status', 'created', 'expired'),
  ('upload_attempt.status', 'uploading', 'expired'),
  ('upload_attempt.status', 'paused', 'expired'),
  ('upload_attempt.status', 'failed', 'expired'),
  ('video_asset.status', 'active', 'rejected'),
  ('video_asset.status', 'active', 'deleted'),
  ('video_asset.status', 'rejected', 'deleted'),
  ('metadata_attempt.status', 'processing', 'extracted'),
  ('metadata_attempt.status', 'processing', 'partial'),
  ('metadata_attempt.status', 'processing', 'unsupported'),
  ('metadata_attempt.status', 'processing', 'failed'),
  ('review_case.status', 'open', 'in_review'),
  ('review_case.status', 'open', 'resolved'),
  ('review_case.status', 'in_review', 'resolved'),
  ('review_case.status', 'open', 'dismissed'),
  ('review_case.status', 'in_review', 'dismissed')
on conflict do nothing;

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

create or replace function egocapture.install_state_machine_trigger(
  target_table regclass,
  target_column text,
  machine_name text
) returns void
language plpgsql
set search_path = ''
as $$
declare
  trigger_name text := replace(target_table::text, '.', '_') || '_' || target_column || '_state_machine';
begin
  execute format('drop trigger if exists %I on %s', trigger_name, target_table);
  execute format(
    'create trigger %I before update of %I on %s for each row execute function egocapture.enforce_state_machine_transition(%L, %L)',
    trigger_name, target_column, target_table, machine_name, target_column
  );
end;
$$;

select egocapture.install_state_machine_trigger('egocapture.participants', 'status', 'participant.status');
select egocapture.install_state_machine_trigger('egocapture.participants', 'consent_status', 'participant.consent_status');
select egocapture.install_state_machine_trigger('egocapture.participant_invitations', 'status', 'participant_invitation.status');
select egocapture.install_state_machine_trigger('egocapture.consent_records', 'status', 'consent_record.status');
select egocapture.install_state_machine_trigger('egocapture.devices', 'status', 'device.status');
select egocapture.install_state_machine_trigger('egocapture.tasks', 'lifecycle', 'task.lifecycle');
select egocapture.install_state_machine_trigger('egocapture.assignments', 'status', 'assignment.status');
select egocapture.install_state_machine_trigger('egocapture.recording_sessions', 'status', 'recording_session.status');
select egocapture.install_state_machine_trigger('egocapture.upload_batches', 'status', 'upload_batch.status');
select egocapture.install_state_machine_trigger('egocapture.upload_intents', 'transfer_status', 'upload_intent.transfer_status');
select egocapture.install_state_machine_trigger('egocapture.upload_intents', 'metadata_status', 'upload_intent.metadata_status');
select egocapture.install_state_machine_trigger('egocapture.upload_attempts', 'status', 'upload_attempt.status');
select egocapture.install_state_machine_trigger('egocapture.video_assets', 'status', 'video_asset.status');
select egocapture.install_state_machine_trigger('egocapture.metadata_attempts', 'status', 'metadata_attempt.status');
select egocapture.install_state_machine_trigger('egocapture.review_cases', 'status', 'review_case.status');

drop function egocapture.install_state_machine_trigger(regclass, text, text);

revoke all on egocapture.state_machine_transitions from anon, authenticated;

notify pgrst, 'reload schema';
