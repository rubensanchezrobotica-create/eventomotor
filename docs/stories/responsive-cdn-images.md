# Verified responsive public images

Public loaders may attach `publicImage` to their minimal image projection. Private
admin loaders do not: the signed-image Preview, its auth/cache boundary and its
original image attributes are unchanged. No CSS, publication RPC, SEO image,
content or Storage permission is changed.

`story-responsive-registry.json` is a versioned **server-only** inventory of
already verified public variants. It contains only public original locators,
dimensions, bytes, SHA-256 and candidate dimensions/bytes/hashes. It contains no
private locators, notes, credentials, local paths or signed URLs. Its provenance
is the SHA-256 of the verified upload manifest. The renderer never opens that
workstation manifest and never derives candidate existence just from a filename.

For a future Story, use its original public image until an independently
authorized generation/upload/verification process supplies an inventory. Verify
every candidate's HTTP status, MIME, dimensions and SHA-256, preserve its original
aspect ratio, then add that inventory to the versioned registry and run the image
tests. A registry update requires a normal code review/deployment; publication
does not depend on that update. No generation/upload is performed by this code.

The resolver accepts only canonical, query-free HTTPS public `story-media`
locators. It matches original dimensions and, when available, byte size, requires
ordered unique widths up to native width and validates the full candidate set.
Missing, invalid or stale entries return the public original without a `srcset`.
If an original is replaced without changing dimensions/bytes, the verification
inventory must be reviewed; originals and registered variants must be treated as
immutable. There is no per-visit remote hash request.

`img` uses direct CDN `srcset` width descriptors and context-specific `sizes`.
Hero is eager/high priority; body, index and Home images are lazy. Intrinsic
dimensions and all existing CSS remain unchanged. No `/_next/image`, Next image
loader, request-time transformation, custom proxy or global image config exists.
Native resolution remains the upper limit; DPR 3 cannot add detail above the
approved original. Existing Home thumbnail framing is intentionally preserved.

The source PNG remains the stable SEO/OG/JSON-LD image. Public derivative URLs
are stable CDN assets with their existing cache headers. No runtime request is
made to Storage except the browser's normal public GETs.
