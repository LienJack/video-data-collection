create table egocapture.task_participant_plans (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references egocapture.tasks(id) on delete restrict,
  participant_id uuid not null references egocapture.participants(id) on delete restrict,
  preferred_device_id uuid references egocapture.devices(id) on delete restrict,
  due_at timestamptz not null,
  locale text not null check (char_length(locale) between 2 and 20),
  note text check (note is null or char_length(note) <= 500),
  assignment_id uuid unique references egocapture.assignments(id) on delete restrict,
  created_by uuid not null references egocapture.profiles(id) on delete restrict,
  removed_by uuid references egocapture.profiles(id) on delete restrict,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_at > created_at),
  check ((removed_at is null) = (removed_by is null)),
  check (assignment_id is null or removed_at is null)
);

create unique index task_participant_plan_one_current_idx
  on egocapture.task_participant_plans (task_id, participant_id)
  where removed_at is null;

create index task_participant_plans_task_current_idx
  on egocapture.task_participant_plans (task_id, created_at desc)
  where removed_at is null;

alter table egocapture.task_participant_plans enable row level security;
revoke all on egocapture.task_participant_plans from public, anon, authenticated;

notify pgrst, 'reload schema';
