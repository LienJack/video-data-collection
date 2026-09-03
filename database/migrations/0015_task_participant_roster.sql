alter table egocapture.task_versions
  add constraint task_versions_id_task_unique unique (id, task_id);

alter table egocapture.assignments
  add column if not exists task_id uuid references egocapture.tasks(id) on delete restrict,
  add column if not exists replaces_assignment_id uuid unique references egocapture.assignments(id) on delete restrict;

update egocapture.assignments assignment
set task_id = version.task_id
from egocapture.task_versions version
where version.id = assignment.task_version_id
  and assignment.task_id is null;

alter table egocapture.assignments
  alter column task_id set not null,
  add constraint assignments_task_version_authority_fkey
    foreign key (task_version_id, task_id)
    references egocapture.task_versions(id, task_id)
    on delete restrict,
  add constraint assignments_replacement_not_self_check
    check (replaces_assignment_id is null or replaces_assignment_id <> id);

create or replace function egocapture.set_assignment_task_authority()
returns trigger
language plpgsql
set search_path = pg_catalog, egocapture
as $$
declare
  derived_task_id uuid;
begin
  select version.task_id
  into derived_task_id
  from egocapture.task_versions version
  where version.id = new.task_version_id;

  if derived_task_id is null then
    raise exception using errcode = '23503', message = 'assignment task version does not exist';
  end if;

  if new.task_id is not null and new.task_id is distinct from derived_task_id then
    raise exception using errcode = '23514', message = 'assignment task does not match task version';
  end if;

  new.task_id = derived_task_id;
  return new;
end;
$$;

drop trigger if exists assignments_set_task_authority on egocapture.assignments;
create trigger assignments_set_task_authority
before insert or update of task_id, task_version_id on egocapture.assignments
for each row execute function egocapture.set_assignment_task_authority();

drop index if exists egocapture.assignment_one_active_task_version_idx;
create unique index assignment_one_current_task_idx
  on egocapture.assignments (participant_id, task_id)
  where status <> 'canceled';

create index assignments_task_status_created_idx
  on egocapture.assignments (task_id, status, created_at desc);

notify pgrst, 'reload schema';
