alter table egocapture.tasks
  drop constraint tasks_instruction_schema_check,
  add constraint tasks_instruction_schema_check
  check (
    jsonb_typeof(draft_instructions) = 'object'
    and draft_instructions ->> 'schemaVersion' = 'ego-task/2'
  );

alter table egocapture.task_versions
  drop constraint task_versions_instruction_schema_check,
  add constraint task_versions_instruction_schema_check
  check (
    jsonb_typeof(instructions) = 'object'
    and instructions ->> 'schemaVersion' = 'ego-task/2'
  );

notify pgrst, 'reload schema';
