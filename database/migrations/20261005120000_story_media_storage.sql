begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'story-media-drafts',
    'story-media-drafts',
    false,
    26214400,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'story-media',
    'story-media',
    true,
    26214400,
    array['image/jpeg', 'image/png', 'image/webp']
  );

-- No storage.objects policies are created for either bucket. Public object GET
-- for story-media is provided exclusively by the bucket's public=true flag;
-- listing and all browser-side mutations remain unavailable. Trusted server
-- code uses service_role for private reads and controlled promotion.

commit;
