create unique index if not exists devices_serial_hmac_unique_idx
  on egocapture.devices (serial_hmac)
  where serial_hmac is not null;

notify pgrst, 'reload schema';
