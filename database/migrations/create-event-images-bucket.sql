-- Apply before deploying the admin event image uploader.
-- This bucket is public for reads only. Uploads require a server-generated signed URL.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'event-images',
  'event-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No INSERT, UPDATE or DELETE policy is intentionally created for anon or
-- authenticated. The server service role creates one-use signed upload URLs
-- only after the existing admin authorization has succeeded.

-- Manual rollback (only after confirming the bucket has no required objects):
-- delete from storage.buckets where id = 'event-images';
