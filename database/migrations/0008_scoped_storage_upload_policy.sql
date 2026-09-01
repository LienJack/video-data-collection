drop policy if exists egocapture_scoped_upload_insert on storage.objects;
create policy egocapture_scoped_upload_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'egocapture-raw'
  and name = (select auth.jwt() ->> 'egocapture_object_key')
  and exists (
    select 1
    from egocapture.upload_intents intent
    join egocapture.participants participant on participant.id = intent.participant_id
    where intent.public_id = (select auth.jwt() ->> 'egocapture_upload_public_id')
      and intent.object_key = storage.objects.name
      and intent.transfer_status in ('created', 'uploading', 'reconciling', 'failed')
      and participant.auth_user_id = auth.uid()
      and participant.status = 'active'
      and participant.consent_status = 'valid'
  )
);
