const MAX_SLUG_LENGTH = 96;

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

export function createEventSlug(title: string, start: string) {
  const titleSlug = slugify(title);
  const dateSlug = slugify(start);

  return [titleSlug, dateSlug].filter(Boolean).join("-");
}
