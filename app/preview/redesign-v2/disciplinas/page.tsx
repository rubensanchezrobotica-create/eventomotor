import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import DisciplinesPage from "@/components/redesign-v2/disciplines/DisciplinesPage";
import { buildDisciplinesPageModel } from "@/components/redesign-v2/disciplines/disciplines-model";
import { isRedesignPreviewAvailable } from "@/components/redesign-v2/redesign-v2-model";
import V2PreviewShell from "@/components/redesign-v2/site/V2PreviewShell";
import { getVehicleType } from "@/lib/event-classification";
import { getVisibleEvents } from "@/lib/public-events";

export const metadata: Metadata = {
  title: "Disciplinas V2 Preview | EventoMotor",
  description: "Vista previa interna del hub de disciplinas V2 de EventoMotor.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default async function DisciplinesPreviewPage() {
  await connection();
  if (!isRedesignPreviewAvailable()) notFound();

  const now = new Date();
  const events = (await getVisibleEvents()).map((event) => ({
    ...event,
    vehicleType: getVehicleType(event),
  }));
  const model = buildDisciplinesPageModel(events, now);

  return (
    <V2PreviewShell
      breadcrumbs={[{ label: "Inicio", navigationId: "home" }, { label: "Disciplinas" }]}
      currentNavigationId="disciplines"
      description="Rallyes, circuito, concentraciones y otras formas de vivir el motor, reunidas en una agenda real y actualizada."
      eyebrow="Agenda por disciplina"
      title="Explora el motor por disciplina"
      upcomingCount={model.totalUpcomingEventCount}
    >
      <DisciplinesPage model={model} />
    </V2PreviewShell>
  );
}
