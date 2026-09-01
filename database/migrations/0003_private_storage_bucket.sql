do $$
declare
  existing_bucket storage.buckets%rowtype;
begin
  select * into existing_bucket
  from storage.buckets
  where id = 'egocapture-raw';

  if found then
    if existing_bucket.name <> 'egocapture-raw'
      or existing_bucket.public is distinct from false
      or existing_bucket.file_size_limit is distinct from 50000000
      or existing_bucket.allowed_mime_types is distinct from array[
        'video/mp4',
        'video/quicktime',
        'application/octet-stream'
      ]::text[] then
      raise exception using
        errcode = '55000',
        message = 'egocapture-raw bucket exists with incompatible ownership or limits';
    end if;
  else
    insert into storage.buckets (
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    ) values (
      'egocapture-raw',
      'egocapture-raw',
      false,
      50000000,
      array['video/mp4', 'video/quicktime', 'application/octet-stream']::text[]
    );
  end if;
end;
$$;
