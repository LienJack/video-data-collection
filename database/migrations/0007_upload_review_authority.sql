alter table egocapture.review_cases
  add column if not exists upload_intent_id uuid references egocapture.upload_intents(id) on delete restrict;

alter table egocapture.review_cases
  drop constraint if exists review_cases_check;

alter table egocapture.review_cases
  add constraint review_cases_subject_check
  check (video_asset_id is not null or assignment_id is not null or upload_intent_id is not null);

create index if not exists review_cases_upload_intent_idx
  on egocapture.review_cases (upload_intent_id)
  where upload_intent_id is not null;

create or replace function egocapture.prevent_upload_authority_rewrite()
returns trigger
language plpgsql
as $$
begin
  if new.study_id is distinct from old.study_id
    or new.participant_id is distinct from old.participant_id
    or new.batch_id is distinct from old.batch_id
    or new.object_key is distinct from old.object_key
    or new.size_bytes is distinct from old.size_bytes
    or new.fingerprint_v1 is distinct from old.fingerprint_v1
    or new.claimed_session_id is distinct from old.claimed_session_id
    or new.unable_to_determine is distinct from old.unable_to_determine then
    raise exception using errcode = '55000', message = 'upload intent authority fields are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists upload_intents_prevent_authority_rewrite on egocapture.upload_intents;
create trigger upload_intents_prevent_authority_rewrite
before update on egocapture.upload_intents
for each row execute function egocapture.prevent_upload_authority_rewrite();
