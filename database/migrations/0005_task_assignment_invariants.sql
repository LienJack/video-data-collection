alter table egocapture.tasks
  add constraint tasks_instruction_schema_check
  check (
    jsonb_typeof(draft_instructions) = 'object'
    and draft_instructions ->> 'schemaVersion' = 'ego-task/1'
  );

alter table egocapture.task_versions
  add constraint task_versions_instruction_schema_check
  check (
    jsonb_typeof(instructions) = 'object'
    and instructions ->> 'schemaVersion' = 'ego-task/1'
  );

alter table egocapture.assignments
  add constraint assignments_due_after_creation_check
  check (due_at > created_at),
  add constraint assignments_cancellation_consistency_check
  check ((status = 'canceled') = (canceled_at is not null));

notify pgrst, 'reload schema';
