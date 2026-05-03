const STATUS_ITEMS = [
  "Diseno en progreso",
  "Carga de eventos en marcha",
  "Lanzamiento proximamente",
];

export default function UnderConstruction() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0D0D0F] text-white">
      <section className="relative flex min-h-screen items-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(225,6,0,0.24),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.07),transparent_28%)]" />
        <div className="absolute inset-x-0 bottom-0 h-28 border-t border-[#E10600]/30 bg-[repeating-linear-gradient(135deg,rgba(225,6,0,0.36)_0,rgba(225,6,0,0.36)_18px,transparent_18px,transparent_38px)] opacity-35" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.34em] text-[#E10600]">
              EventoMotor
            </p>
            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-none tracking-tight sm:text-7xl">
              EventoMotor esta calentando motores
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-zinc-200">
              Estamos preparando el calendario definitivo para descubrir eventos del motor en
              Espana.
            </p>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">
              Trackdays, motocross, concentraciones, ferias, competiciones y mucho mas. Muy
              pronto, todos los eventos en un solo sitio.
            </p>
            <div className="mt-8 inline-flex rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-black text-[#0D0D0F]">
              Vuelve pronto
            </div>
          </div>

          <aside className="border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-zinc-500">
                Estado
              </p>
              <span className="h-3 w-3 rounded-full bg-[#E10600] shadow-[0_0_24px_rgba(225,6,0,0.8)]" />
            </div>
            <div className="mt-5 space-y-3">
              {STATUS_ITEMS.map((item, index) => (
                <div
                  className="flex items-center gap-3 border border-white/10 bg-[#0D0D0F] px-4 py-3"
                  key={item}
                >
                  <span className="flex h-8 w-8 items-center justify-center bg-[#E10600] text-sm font-black">
                    {index + 1}
                  </span>
                  <p className="font-bold text-zinc-100">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 h-2 bg-zinc-800">
              <div className="h-full w-2/3 bg-[#E10600]" />
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.24em] text-zinc-500">
              Pit lane abierto pronto
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
