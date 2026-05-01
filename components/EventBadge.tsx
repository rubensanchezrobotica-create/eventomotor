import { cls, COLORS } from "@/lib/date-utils";

export default function EventBadge({ discipline }: { discipline: string }) {
  const color = COLORS[discipline] || COLORS.Motociclismo;

  return (
    <span className={cls("rounded-full border px-3 py-1 text-xs font-black", color)}>
      {discipline}
    </span>
  );
}
