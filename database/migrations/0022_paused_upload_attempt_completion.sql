-- Storage reconciliation is authoritative for byte completion. A participant
-- can pause while the final TUS response is in flight, so a fully reconciled
-- object may legitimately complete the latest paused attempt.
insert into egocapture.state_machine_transitions (machine, from_state, to_state) values
  ('upload_attempt.status', 'paused', 'completed')
on conflict do nothing;

notify pgrst, 'reload schema';
