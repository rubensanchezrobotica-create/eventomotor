const EVENT_IMAGE_MUTABLE_FIELDS = new Set([
  "image_url",
  "image_source_url",
  "updated_at",
]);

export function assertOnlyEventImageFieldsChanged(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    if (EVENT_IMAGE_MUTABLE_FIELDS.has(key)) continue;
    if (!isDeepStrictEqual(before[key], after[key])) {
      throw new Error(`La actualización de imagen modificó el campo protegido ${key}.`);
    }
  }
}
import { isDeepStrictEqual } from "node:util";
