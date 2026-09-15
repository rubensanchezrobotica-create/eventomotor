import type { Metadata } from "next";
import { connection } from "next/server";
import DisciplinesPage from "@/components/redesign-v2/disciplines/DisciplinesPage";
import { buildDisciplinesPageModel } from "@/components/redesign-v2/disciplines/disciplines-model";
import V2InteriorShell from "@/components/redesign-v2/site/V2InteriorShell";
import { getVehicleType } from "@/lib/event-classification";
import { getVisibleEvents } from "@/lib/public-events";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Disciplinas",
  description:
    "Explora eventos de motor por disciplina: rallyes, circuito, concentraciones, offroad, clásicos, karting, rutas y ferias.",
  alternates: {
    canonical: `${SITE_URL}/disciplinas`,
  },
};

export default async function DisciplinasPage() {
  await connection();
  const now = new Date();
  const events = (await getVisibleEvents()).map((event) => ({
    ...event,
    vehicleType: getVehicleType(event),
  }));
  const model = buildDisciplinesPageModel(events, now, { routeMode: "public" });

  return (
    <V2InteriorShell
      breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "Disciplinas" }]}
      currentNavigationId="disciplines"
      description="Rallyes, circuito, concentraciones y otras formas de vivir el motor, reunidas en una agenda real y actualizada."
      eyebrow="Agenda por disciplina"
      navigationMode="public"
      title="Explora el motor por disciplina"
      upcomingCount={model.totalUpcomingEventCount}
    >
      <DisciplinesPage model={model} />
    </V2InteriorShell>
  );
}
