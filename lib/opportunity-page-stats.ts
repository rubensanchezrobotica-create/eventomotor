export function buildOpportunityEventCountStat({
  totalCount,
  upcomingCount,
}: {
  totalCount: number;
  upcomingCount: number;
}) {
  if (upcomingCount > totalCount) {
    throw new RangeError("Upcoming event count cannot exceed total event count");
  }

  return {
    label: "Próximos",
    value: upcomingCount.toString(),
  };
}
