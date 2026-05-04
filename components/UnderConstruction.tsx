import EventomotorLogo from "@/components/brand/EventomotorLogo";
import { Button, Card, Chip } from "@/components/ui/primitives";

const STATUS_ITEMS = [
  "Diseño en progreso",
  "Carga de eventos en marcha",
  "Lanzamiento próximamente",
];

export default function UnderConstruction() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0D0D0F] text-white">
      <section className="relative isolate flex min-h-screen items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-20 bg-[#0D0D0F]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_24%_22%,rgba(225,6,0,0.18),transparent_28%),radial-gradient(circle_at_86%_62%,rgba(225,6,0,0.12),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.045),transparent_38%)]" />
        <div className="absolute inset-0 -z-10 opacity-[0.045] bg-[linear-gradient(90deg,rgba(255,255,255,0.82)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.82)_1px,transparent_1px)] bg-[size:76px_76px]" />
        <div className="absolute left-[6%] top-[14%] -z-10 hidden h-px w-64 bg-gradient-to-r from-transparent via-[#E10600]/45 to-transparent lg:block" />
        <div className="absolute right-[8%] top-[22%] -z-10 hidden h-px w-48 bg-gradient-to-r from-transparent via-white/20 to-transparent lg:block" />
        <div className="absolute bottom-0 left-0 -z-10 h-40 w-full bg-gradient-to-t from-black/45 to-transparent" />

        <div className="relative mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-3xl">
            <EventomotorLogo />

            <div className="mt-12 flex flex-wrap gap-2.5">
              <Chip>Motor España</Chip>
              <Chip className="border-[#E10600]/25 bg-[#E10600]/[0.06] text-white">
                Modo construcción
              </Chip>
            </div>

            <h1 className="mt-7 max-w-4xl text-4xl font-black leading-[0.97] tracking-tight text-white sm:text-6xl lg:text-[4.7rem]">
              EventoMotor está calentando motores
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/85 sm:text-xl">
              Estamos preparando el calendario definitivo para descubrir eventos del motor en
              España.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#A6A6A6]">
              Trackdays, motocross, concentraciones, ferias, competiciones y mucho más. Muy
              pronto, todos los eventos en un solo sitio.
            </p>
            <div className="mt-9">
              <Button type="button">Vuelve pronto</Button>
            </div>
          </div>

          <Card className="relative overflow-hidden p-6 sm:p-8">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E10600]/70 to-transparent" />
            <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#E10600]/10 blur-3xl" />
            <div className="relative flex items-center justify-between border-b border-white/10 pb-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-[#A6A6A6]">
                  Estado
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-white">En boxes</h2>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E10600]/30 bg-[#E10600]/10">
                <span className="h-2.5 w-2.5 rounded-full bg-[#E10600] shadow-[0_0_22px_rgba(225,6,0,0.75)]" />
              </span>
            </div>

            <div className="relative mt-6 space-y-3">
              {STATUS_ITEMS.map((item, index) => (
                <div
                  className="flex items-center gap-4 rounded-md border border-white/[0.08] bg-[#0D0D0F]/70 px-4 py-4 transition hover:border-white/15"
                  key={item}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#E10600]/30 bg-[#E10600]/10 text-xs font-black text-[#E10600]">
                    0{index + 1}
                  </span>
                  <p className="font-bold text-zinc-100">{item}</p>
                </div>
              ))}
            </div>

            <div className="relative mt-8">
              <div className="flex items-end justify-between gap-4">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-[#A6A6A6]">
                  Preparación
                </p>
                <p className="text-sm font-black text-white">68%</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-[#E10600] to-[#ff3b34] shadow-[0_0_20px_rgba(225,6,0,0.42)]" />
              </div>
            </div>

            <div className="relative mt-8 border-t border-white/10 pt-5">
              <div className="absolute right-0 top-5 h-px w-24 bg-gradient-to-r from-[#E10600]/70 to-transparent" />
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#A6A6A6]">
                Próxima salida: muy pronto
              </p>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
