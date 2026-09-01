-- A MatchDecision supersede changes two rows atomically: the current row gains
-- superseded_by and the new immutable row points back through supersedes_decision_id.
-- Deferring only this self-reference lets the transaction free the partial unique
-- "current decision" slot before inserting the replacement without weakening it.
alter table egocapture.match_decisions
  drop constraint if exists match_decisions_superseded_by_fkey;

alter table egocapture.match_decisions
  add constraint match_decisions_superseded_by_fkey
  foreign key (superseded_by)
  references egocapture.match_decisions(id)
  on delete restrict
  deferrable initially deferred;
