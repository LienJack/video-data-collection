create or replace view egocapture.assignment_progress
with (security_invoker = true)
as
select
  assignment.id,
  assignment.public_id,
  assignment.participant_id,
  assignment.task_version_id,
  assignment.status,
  assignment.due_at,
  count(distinct session.id) as session_count,
  count(distinct asset.id) filter (
    where asset.status = 'active'
      and decision.decision_type in ('admin_confirmed', 'admin_corrected')
  ) as accepted_asset_candidates,
  (
    assignment.due_at < now()
    and assignment.status <> 'canceled'
    and count(distinct asset.id) filter (
      where asset.status = 'active'
        and decision.decision_type in ('admin_confirmed', 'admin_corrected')
    ) = 0
  ) as is_missing
from egocapture.assignments assignment
left join egocapture.recording_sessions session on session.assignment_id = assignment.id
left join egocapture.current_match_decisions decision on decision.resolved_session_id = session.id
left join egocapture.video_assets asset on asset.id = decision.video_asset_id
group by assignment.id;

create or replace view egocapture.missing_assignments
with (security_invoker = true)
as
select * from egocapture.assignment_progress where is_missing;

notify pgrst, 'reload schema';
