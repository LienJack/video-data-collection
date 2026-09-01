alter table egocapture.participants
  drop constraint if exists participants_status_check;

alter table egocapture.participants
  add constraint participants_status_check
  check (status in ('draft', 'invited', 'expired', 'active', 'suspended', 'withdrawn'));

alter table egocapture.participants
  add column if not exists default_device_id uuid
  references egocapture.devices(id) on delete restrict;

alter table egocapture.participants
  add column if not exists consent_version text not null default 'demo-consent-v1'
  check (char_length(consent_version) between 1 and 40);

notify pgrst, 'reload schema';
