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
      <section className="relative isolate flex min-h-screen items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-20 bg-[#0D0D0F]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_18%,rgba(225,6,0,0.24),transparent_30%),radial-gradient(circle_at_86%_72%,rgba(225,6,0,0.16),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent_34%)]" />
        <div className="absolute inset-0 -z-10 opacity-[0.08] bg-[linear-gradient(90deg,rgba(255,255,255,0.75)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.75)_1px,transparent_1px)] bg-[size:72px_72px]" />
        <div className="absolute -right-24 top-20 -z-10 h-72 w-72 rounded-full border border-[#E10600]/30 opacity-60 sm:h-96 sm:w-96">
          <div className="absolute inset-10 rounded-full border border-white/10" />
          <div className="absolute left-1/2 top-1/2 h-1 w-40 origin-left -rotate-45 bg-gradient-to-r from-[#E10600] to-transparent" />
        </div>
        <div className="absolute bottom-10 left-0 -z-10 h-28 w-full skew-y-[-4deg] border-y border-white/10 bg-[repeating-linear-gradient(90deg,rgba(225,6,0,0.28)_0,rgba(225,6,0,0.28)_2px,transparent_2px,transparent_42px)] opacity-40" />

        <div className="relative mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div>
            <EventomotorLogo />

            <div className="mt-10 flex flex-wrap gap-2">
              <Chip>Motor España</Chip>
              <Chip className="border-[#E10600]/30 text-white">Modo construcción</Chip>
            </div>

            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              EventoMotor está calentando motores
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/82 sm:text-xl">
              Estamos preparando el calendario definitivo para descubrir eventos del motor en
              España.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#A6A6A6]">
              Trackdays, motocross, concentraciones, ferias, competiciones y mucho más. Muy
              pronto, todos los eventos en un solo sitio.
            </p>
            <div className="mt-8">
              <Button type="button">Vuelve pronto</Button>
            </div>
          </div>

          <Card className="relative overflow-hidden p-6 sm:p-7">
            <div className="absolute right-0 top-0 h-32 w-32 bg-[radial-gradient(circle,rgba(225,6,0,0.24),transparent_66%)]" />
            <div className="relative flex items-center justify-between border-b border-white/10 pb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#A6A6A6]">
                  Estado
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">En boxes</h2>
              </div>
              <span className="h-3 w-3 rounded-full bg-[#E10600] shadow-[0_0_24px_rgba(225,6,0,0.8)]" />
            </div>

            <div className="relative mt-6 space-y-3">
              {STATUS_ITEMS.map((item, index) => (
                <div
                  className="flex items-center gap-4 rounded-md border border-white/10 bg-[#0D0D0F]/80 px-4 py-4"
                  key={item}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#E10600] text-sm font-black text-white">
                    0{index + 1}
                  </span>
                  <p className="font-bold text-zinc-100">{item}</p>
                </div>
              ))}
            </div>

            <div className="relative mt-7">
              <div className="flex items-end justify-between gap-4">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#A6A6A6]">
                  Preparación
                </p>
                <p className="text-sm font-black text-white">68%</p>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div className="h-full w-[68%] rounded-full bg-[#E10600] shadow-[0_0_22px_rgba(225,6,0,0.55)]" />
              </div>
            </div>

            <div className="relative mt-7 rounded-md border border-white/10 bg-white/[0.03] p-4">
              <div className="h-20 rounded-[50%] border-t-2 border-[#E10600]/70 border-l-transparent border-r-transparent border-b-transparent" />
              <div className="-mt-12 flex items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-white" />
                <span className="h-1 w-24 origin-left -rotate-12 rounded-full bg-gradient-to-r from-[#FFD000] to-transparent" />
              </div>
              <p className="mt-5 text-center text-xs font-bold uppercase tracking-[0.22em] text-[#A6A6A6]">
                Próxima salida: muy pronto
              </p>
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}
