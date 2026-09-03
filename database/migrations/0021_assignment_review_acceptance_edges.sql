-- Review correction previously accepted the selected session's assignment from
-- every non-canceled lifecycle state. Keep that behavior explicit in the graph
-- without rewriting the already-applied 0019 migration snapshot.
insert into egocapture.state_machine_transitions (machine, from_state, to_state) values
  ('assignment.status', 'assigned', 'accepted'),
  ('assignment.status', 'acknowledged', 'accepted'),
  ('assignment.status', 'session_created', 'accepted'),
  ('assignment.status', 'uploading', 'accepted'),
  ('assignment.status', 'rework_required', 'accepted'),
  ('assignment.status', 'expired', 'accepted'),
  ('assignment.status', 'missing_upload', 'accepted')
on conflict do nothing;

notify pgrst, 'reload schema';
