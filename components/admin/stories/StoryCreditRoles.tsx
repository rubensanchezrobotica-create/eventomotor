import type { EditorialPersonRow, StoryCreditRow } from "@/lib/supabase";
import { STORY_CREDIT_ROLES } from "@/lib/stories/story-types";

const ROLE_LABELS = {
  TEXT: "Texto",
  PHOTO: "Fotografía",
  VIDEO: "Vídeo",
  CONTRIBUTOR: "Colaboración",
} as const;

const CREDIT_ROLE_FIELD_PREFIX = "creditRole:";

type Person = Pick<EditorialPersonRow, "id" | "display_name">;
type Credit = Pick<StoryCreditRow, "person_id" | "role">;

export function hasUnlistedStoryCredits(people: readonly Person[], credits: readonly Credit[]) {
  const visiblePersonIds = new Set(people.map(({ id }) => id));
  return credits.some(({ person_id }) => !visiblePersonIds.has(person_id));
}

export function parseStoryCreditRoles(formData: FormData) {
  const credits: { personId: string; role: string; sortOrder: number }[] = [];
  for (const [name, value] of formData.entries()) {
    if (!name.startsWith(CREDIT_ROLE_FIELD_PREFIX)) continue;
    credits.push({
      personId: name.slice(CREDIT_ROLE_FIELD_PREFIX.length),
      role: String(value),
      sortOrder: credits.length,
    });
  }
  return credits;
}

export default function StoryCreditRoles({
  person,
  credits,
  roleGridClassName,
  checkRowClassName,
}: {
  person: Person;
  credits: readonly Credit[];
  roleGridClassName: string;
  checkRowClassName: string;
}) {
  const selectedRoles = new Set(
    credits.filter(({ person_id }) => person_id === person.id).map(({ role }) => role),
  );

  return (
    <fieldset>
      <legend>{person.display_name}</legend>
      <div className={roleGridClassName}>
        {STORY_CREDIT_ROLES.map((role) => (
          <label className={checkRowClassName} key={role}>
            <input
              defaultChecked={selectedRoles.has(role)}
              name={`${CREDIT_ROLE_FIELD_PREFIX}${person.id}`}
              type="checkbox"
              value={role}
            />
            {ROLE_LABELS[role]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
