alter table egocapture.session_markers
  add constraint session_markers_compact_jws_check
  check (
    char_length(marker_jws) between 80 and 10000
    and marker_jws ~ '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
  ),
  add constraint session_markers_payload_contract_check
  check (
    payload ->> 'v' = '1'
    and payload ->> 'session_public_id' ~ '^RS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$'
    and payload ->> 'assignment_public_id' ~ '^AS-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$'
    and payload ->> 'device_public_id' ~ '^DEV-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6,16}$'
    and payload ->> 'nonce' = nonce
    and (payload ->> 'issued_at')::timestamptz = issued_at
    and (payload ->> 'expires_at')::timestamptz = expires_at
  );

create index if not exists session_markers_session_created_idx
  on egocapture.session_markers (session_id, created_at desc);

notify pgrst, 'reload schema';
