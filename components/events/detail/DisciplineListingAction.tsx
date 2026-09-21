import Link from "next/link";
import { getCanonicalDisciplineHref } from "@/lib/event-listing-slugs";

type DisciplineListingActionProps = {
  className: string;
  discipline: string;
  vehicleType?: string | null;
};

export default function DisciplineListingAction({
  className,
  discipline,
  vehicleType,
}: DisciplineListingActionProps) {
  const href = getCanonicalDisciplineHref({ discipline, vehicleType });
  const label = <>Ver más de {discipline}</>;

  return href ? (
    <Link className={className} href={href}>{label}</Link>
  ) : (
    <span className={className}>{label}</span>
  );
}
