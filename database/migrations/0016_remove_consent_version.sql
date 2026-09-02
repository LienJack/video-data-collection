alter table egocapture.participants
  drop column if exists consent_version;

alter table egocapture.consent_records
  drop column if exists version;

notify pgrst, 'reload schema';
