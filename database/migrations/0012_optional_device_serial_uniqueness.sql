alter table egocapture.devices
  drop constraint if exists devices_study_id_serial_hmac_key;

create unique index if not exists devices_study_serial_hmac_unique_idx
  on egocapture.devices (study_id, serial_hmac)
  where serial_hmac is not null;

notify pgrst, 'reload schema';
