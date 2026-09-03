alter table egocapture.state_machine_transitions enable row level security;

notify pgrst, 'reload schema';
