begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(12);

select throws_ok(
  $$
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
        true,
        1,
        array['application/octet-stream']
      ),
      (
        'story-media',
        'story-media',
        false,
        1,
        array['application/octet-stream']
      )
  $$,
  '23505', null,
  'pre-existing story media buckets fail closed instead of being reconfigured'
);

select is(
  (select public from storage.buckets where id = 'story-media-drafts'),
  false,
  'draft originals bucket is private'
);

select is(
  (select public from storage.buckets where id = 'story-media'),
  true,
  'sanitized story media bucket is public'
);

select ok(
  (
    select pg_catalog.bool_and(file_size_limit = 26214400)
    from storage.buckets
    where id in ('story-media-drafts', 'story-media')
  ),
  'both buckets enforce the 25 MiB limit'
);

select set_eq(
  $$
    select mime_type
    from storage.buckets as bucket,
      lateral pg_catalog.unnest(bucket.allowed_mime_types) as allowed(mime_type)
    where bucket.id = 'story-media-drafts'
  $$,
  array['image/jpeg', 'image/png', 'image/webp'],
  'draft bucket accepts only JPEG, PNG, and WebP'
);

select set_eq(
  $$
    select mime_type
    from storage.buckets as bucket,
      lateral pg_catalog.unnest(bucket.allowed_mime_types) as allowed(mime_type)
    where bucket.id = 'story-media'
  $$,
  array['image/jpeg', 'image/png', 'image/webp'],
  'public bucket accepts only JPEG, PNG, and WebP'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policy
    where polrelid = 'storage.objects'::regclass
      and (
        coalesce(pg_catalog.pg_get_expr(polqual, polrelid), '') || ' ' ||
        coalesce(pg_catalog.pg_get_expr(polwithcheck, polrelid), '')
      ) ~ 'story-media(-drafts)?'
  ),
  0,
  'neither story media bucket is referenced by any Storage policy condition'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policy
    where polrelid = 'storage.objects'::regclass
      and polcmd = 'r'
      and (
        0::oid = any(polroles)
        or pg_catalog.to_regrole('anon')::oid = any(polroles)
        or pg_catalog.to_regrole('authenticated')::oid = any(polroles)
      )
  ),
  0,
  'public, anon, and authenticated have no Storage SELECT policy'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policy
    where polrelid = 'storage.objects'::regclass
      and polcmd = 'a'
      and (
        0::oid = any(polroles)
        or pg_catalog.to_regrole('anon')::oid = any(polroles)
        or pg_catalog.to_regrole('authenticated')::oid = any(polroles)
      )
  ),
  0,
  'public, anon, and authenticated have no Storage INSERT policy'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policy
    where polrelid = 'storage.objects'::regclass
      and polcmd = 'w'
      and (
        0::oid = any(polroles)
        or pg_catalog.to_regrole('anon')::oid = any(polroles)
        or pg_catalog.to_regrole('authenticated')::oid = any(polroles)
      )
  ),
  0,
  'public, anon, and authenticated have no Storage UPDATE policy'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_policy
    where polrelid = 'storage.objects'::regclass
      and polcmd = 'd'
      and (
        0::oid = any(polroles)
        or pg_catalog.to_regrole('anon')::oid = any(polroles)
        or pg_catalog.to_regrole('authenticated')::oid = any(polroles)
      )
  ),
  0,
  'public, anon, and authenticated have no Storage DELETE policy'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc
    where pronamespace = 'public'::regnamespace
      and proname like '%story_media%upload%'
  ),
  0,
  'A16B1 creates no public upload RPC'
);

select * from finish();
rollback;
