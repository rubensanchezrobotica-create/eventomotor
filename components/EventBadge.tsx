import { getDisciplineColor } from "@/lib/date-utils";

export default function EventBadge({ discipline }: { discipline: string }) {
  const color = getDisciplineColor(discipline);

  return (
    <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${color.badge}`}>
      {discipline}
    </span>
  );
}
