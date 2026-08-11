export type FallbackDiscipline =
  | "rallyes"
  | "circuito"
  | "concentraciones"
  | "offroad"
  | "clasicos"
  | "karting"
  | "rutas"
  | "ferias";

export type FallbackVehicle = "moto" | "coche" | "mixto" | "karting";

export type V2FallbackImage = {
  id: string;
  discipline: FallbackDiscipline;
  vehicle: FallbackVehicle;
  tags: readonly string[];
  src: string;
};

const fallback = (
  id: string,
  discipline: FallbackDiscipline,
  vehicle: FallbackVehicle,
  tags: readonly string[],
  filename: string,
): V2FallbackImage => ({
  id,
  discipline,
  vehicle,
  tags,
  src: `/images/disciplines/fallbacks/${discipline}/${filename}`,
});

export const V2_DISCIPLINE_FALLBACKS = [
  fallback("rallyes-01", "rallyes", "coche", ["rally", "asfalto", "mojado", "montana"], "rallyes-01-asfalto-mojado-montana.webp"),
  fallback("rallyes-02", "rallyes", "coche", ["rally", "tierra", "polvo", "gravel"], "rallyes-02-tierra-polvo.webp"),
  fallback("rallyes-03", "rallyes", "coche", ["rally", "asfalto", "bosque"], "rallyes-03-asfalto-seco-bosque.webp"),
  fallback("rallyes-04", "rallyes", "coche", ["rally", "rasante", "salto", "paisaje-abierto"], "rallyes-04-cambio-rasante-paisaje-abierto.webp"),
  fallback("rallyes-05", "rallyes", "coche", ["rally", "horquilla", "asfalto", "lateral"], "rallyes-05-horquilla-accion-lateral.webp"),

  fallback("circuito-01", "circuito", "coche", ["circuito", "coche", "curva", "piano"], "circuito-01-coches-curva-rapida-piano.webp"),
  fallback("circuito-02", "circuito", "moto", ["circuito", "moto", "inclinacion", "apice"], "circuito-02-motos-inclinacion-apice.webp"),
  fallback("circuito-03", "circuito", "coche", ["circuito", "coche", "trackday", "frenada"], "circuito-03-trackday-frenada-coches.webp"),
  fallback("circuito-04", "circuito", "coche", ["circuito", "coche", "competicion", "carrera"], "circuito-04-competicion-grupo-compacto.webp"),
  fallback("circuito-05", "circuito", "moto", ["circuito", "moto", "frenada"], "circuito-05-motos-frenada-final-recta.webp"),
  fallback("circuito-06", "circuito", "moto", ["circuito", "moto", "aceleracion", "salida-curva"], "circuito-06-motos-salida-curva-aceleracion.webp"),
  fallback("circuito-07", "circuito", "mixto", ["circuito", "pit-lane", "boxes", "preparacion"], "circuito-07-pit-lane-boxes-preparacion.webp"),

  fallback("concentraciones-01", "concentraciones", "coche", ["concentracion", "coche", "encuentro", "exterior"], "concentraciones-01-coches-encuentro-exterior.webp"),
  fallback("concentraciones-02", "concentraciones", "moto", ["concentracion", "moto", "encuentro"], "concentraciones-02-motos-encuentro-paseo-maritimo.webp"),
  fallback("concentraciones-03", "concentraciones", "mixto", ["concentracion", "mixto", "coche", "moto", "social"], "concentraciones-03-mixta-coches-motos-ambiente-social.webp"),
  fallback("concentraciones-04", "concentraciones", "coche", ["concentracion", "coche", "club", "personalizado"], "concentraciones-04-club-coches-personalizados-tarde-noche.webp"),
  fallback("concentraciones-05", "concentraciones", "mixto", ["concentracion", "mixto", "comunidad", "evento-local"], "concentraciones-05-evento-local-mixto-comunidad.webp"),

  fallback("offroad-01", "offroad", "coche", ["offroad", "4x4", "trialera", "roca"], "offroad-01-4x4-trialera-roca.webp"),
  fallback("offroad-02", "offroad", "moto", ["offroad", "enduro", "moto", "bosque"], "offroad-02-enduro-sendero-tecnico-bosque.webp"),
  fallback("offroad-03", "offroad", "moto", ["offroad", "motocross", "moto", "salto"], "offroad-03-motocross-salto-circuito-tierra.webp"),
  fallback("offroad-04", "offroad", "coche", ["offroad", "raid", "buggy", "pista"], "offroad-04-raid-pista-rapida-paisaje-abierto.webp"),
  fallback("offroad-05", "offroad", "moto", ["offroad", "trial", "moto", "roca"], "offroad-05-trial-roca-obstaculo-tecnico.webp"),
  fallback("offroad-06", "offroad", "coche", ["offroad", "4x4", "barro", "agua"], "offroad-06-barro-agua-terreno-humedo.webp"),

  fallback("clasicos-01", "clasicos", "coche", ["clasicos", "coche", "carretera"], "clasicos-01-coche-clasico-carretera-secundaria.webp"),
  fallback("clasicos-02", "clasicos", "coche", ["clasicos", "concentracion", "coche"], "clasicos-02-concentracion-plaza-historica.webp"),
  fallback("clasicos-03", "clasicos", "moto", ["clasicos", "moto", "encuentro"], "clasicos-03-motos-clasicas-encuentro-historico.webp"),
  fallback("clasicos-04", "clasicos", "coche", ["clasicos", "youngtimers", "ruta", "club"], "clasicos-04-youngtimers-ruta-club-mirador.webp"),
  fallback("clasicos-05", "clasicos", "coche", ["clasicos", "regularidad", "rally-historico"], "clasicos-05-regularidad-rally-historico-carretera.webp"),

  fallback("karting-01", "karting", "karting", ["karting", "carrera", "outdoor"], "karting-01-carrera-grupo-curva-outdoor.webp"),
  fallback("karting-02", "karting", "karting", ["karting", "indoor", "tandas"], "karting-02-indoor-pista-cubierta-tandas.webp"),
  fallback("karting-03", "karting", "karting", ["karting", "alquiler", "amateur"], "karting-03-amateur-alquiler-preparacion.webp"),
  fallback("karting-04", "karting", "karting", ["karting", "junior", "parrilla"], "karting-04-junior-parrilla.webp"),
  fallback("karting-05", "karting", "karting", ["karting", "kartodromo", "outdoor"], "karting-05-kartodromo-outdoor-vista-amplia.webp"),

  fallback("rutas-01", "rutas", "moto", ["rutas", "moto", "touring", "montana"], "rutas-01-motos-touring-montana.webp"),
  fallback("rutas-02", "rutas", "coche", ["rutas", "coche", "club", "carretera"], "rutas-02-coches-salida-club-carretera-escenica.webp"),
  fallback("rutas-03", "rutas", "moto", ["rutas", "moto", "costa", "touring"], "rutas-03-motos-costa-touring.webp"),
  fallback("rutas-04", "rutas", "coche", ["rutas", "coche", "bosque", "norte"], "rutas-04-coches-norte-verde-bosque.webp"),
  fallback("rutas-05", "rutas", "moto", ["rutas", "moto", "montana", "norte"], "rutas-05-motos-norte-verde-montana.webp"),
  fallback("rutas-06", "rutas", "mixto", ["rutas", "mixto", "coche", "moto", "parada", "mirador"], "rutas-06-parada-ruta-coches-motos.webp"),

  fallback("ferias-01", "ferias", "coche", ["ferias", "salon-automovil", "coche"], "ferias-01-salon-automovil-coche-stand.webp"),
  fallback("ferias-02", "ferias", "moto", ["ferias", "salon-moto", "moto"], "ferias-02-salon-moto-stand-publico.webp"),
  fallback("ferias-03", "ferias", "coche", ["ferias", "clasicos", "coche"], "ferias-03-clasicos-pabellon-clubes.webp"),
  fallback("ferias-04", "ferias", "coche", ["ferias", "aftermarket", "preparacion"], "ferias-04-aftermarket-preparacion-componentes.webp"),
  fallback("ferias-05", "ferias", "mixto", ["ferias", "general", "coche", "moto", "pabellon"], "ferias-05-gran-pabellon-coches-motos.webp"),
] as const satisfies readonly V2FallbackImage[];
