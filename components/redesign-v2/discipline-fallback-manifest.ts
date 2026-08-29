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
  fallback("rallyes-06", "rallyes", "coche", ["rally", "subida", "montana", "hillclimb", "asfalto", "seco", "mediterraneo", "horquilla"], "rallyes-06-subida-asfalto-seco-montana-mediterranea.webp"),
  fallback("rallyes-07", "rallyes", "coche", ["rally", "subida", "montana", "hillclimb", "asfalto", "humedo", "atlantico", "ascenso"], "rallyes-07-subida-asfalto-humedo-paisaje-atlantico.webp"),
  fallback("rallyes-08", "rallyes", "coche", ["rally", "subida", "montana", "hillclimb", "asfalto", "tramo-rapido", "roca", "ascenso"], "rallyes-08-subida-asfalto-rapida-montana-rocosa.webp"),
  fallback("rallyes-09", "rallyes", "coche", ["rally", "asfalto", "mojado", "bosque", "tramo-rapido", "accion-trasera"], "rallyes-09-rally-asfalto-mojado-bosque-accion-trasera.webp"),
  fallback("rallyes-10", "rallyes", "coche", ["rally", "asfalto", "seco", "paisaje-abierto", "tramo-rapido", "lateral"], "rallyes-10-rally-asfalto-seco-tramo-rapido-paisaje-abierto.webp"),
  fallback("rallyes-11", "rallyes", "coche", ["rally", "rallysprint", "asfalto", "tramo-corto", "curva", "accion-proxima"], "rallyes-11-rallysprint-asfalto-tramo-corto-curva.webp"),

  fallback("circuito-01", "circuito", "coche", ["circuito", "coche", "curva", "piano"], "circuito-01-coches-curva-rapida-piano.webp"),
  fallback("circuito-02", "circuito", "moto", ["circuito", "moto", "inclinacion", "apice"], "circuito-02-motos-inclinacion-apice.webp"),
  fallback("circuito-03", "circuito", "coche", ["circuito", "coche", "trackday", "frenada"], "circuito-03-trackday-frenada-coches.webp"),
  fallback("circuito-04", "circuito", "coche", ["circuito", "coche", "competicion", "carrera"], "circuito-04-competicion-grupo-compacto.webp"),
  fallback("circuito-05", "circuito", "moto", ["circuito", "moto", "frenada"], "circuito-05-motos-frenada-final-recta.webp"),
  fallback("circuito-06", "circuito", "moto", ["circuito", "moto", "aceleracion", "salida-curva"], "circuito-06-motos-salida-curva-aceleracion.webp"),
  fallback("circuito-07", "circuito", "mixto", ["circuito", "pit-lane", "boxes", "preparacion"], "circuito-07-pit-lane-boxes-preparacion.webp"),
  fallback("circuito-08", "circuito", "moto", ["circuito", "moto", "trackday", "tandas", "rodada", "rodadas", "amateur", "grupo", "motos"], "circuito-08-trackday-motos-tandas-amateur-grupo-pista.webp"),
  fallback("circuito-09", "circuito", "moto", ["circuito", "moto", "pitbike", "minivelocidad", "mini-velocidad", "drpit", "ciclomotores", "minibike", "kartodromo"], "circuito-09-pitbike-minivelocidad-circuito-pequeno.webp"),
  fallback("circuito-10", "circuito", "moto", ["circuito", "moto", "supermotard", "supermoto", "minimotard", "trazado-mixto", "asfalto", "tierra"], "circuito-10-supermotard-trazado-mixto-asfalto-tierra.webp"),
  fallback("circuito-11", "circuito", "coche", ["circuito", "coche", "slalom", "conos", "trazado-amplio", "cambio-direccion"], "circuito-11-slalom-trazado-amplio-conos-cambio-direccion.webp"),
  fallback("circuito-12", "circuito", "coche", ["circuito", "coche", "slalom", "conos", "cambio-apoyo", "atardecer"], "circuito-12-slalom-atardecer-cambio-apoyo.webp"),
  fallback("circuito-13", "circuito", "moto", ["pitbike", "pit-bike", "minivelocidad", "kartodromo", "horquilla", "frenada", "accion-proxima"], "circuito-13-pitbike-horquilla-accion-proxima-kartodromo.webp"),
  fallback("circuito-14", "circuito", "coche", ["circuito", "coche", "drift"], "circuito-14-drift-curva-circuito-humo-controlado.webp"),
  fallback("circuito-15", "circuito", "coche", ["circuito", "coche", "resistencia", "endurance"], "circuito-15-competicion-coches-resistencia-atardecer.webp"),
  fallback("circuito-16", "circuito", "coche", ["circuito", "coche", "trackday", "tandas", "rodada", "rodadas", "curso-de-conduccion", "experiencia-de-conduccion", "entrenamiento-amateur"], "circuito-16-trackday-coches-amateur-pit-lane-instructor.webp"),
  fallback("circuito-17", "circuito", "moto", ["circuito", "moto", "motogp", "juniorgp", "superbike", "worldsbk", "esbk", "velocidad", "competicion"], "circuito-17-competicion-motos-grupo-parrilla-curva.webp"),
  fallback("circuito-18", "circuito", "moto", ["circuito", "moto", "resistencia", "endurance"], "circuito-18-resistencia-motos-atardecer-faros.webp"),
  fallback("circuito-19", "circuito", "coche", ["circuito", "coche", "gt", "turismos"], "circuito-19-gt-turismos-carrera-grupo-curva.webp"),

  fallback("concentraciones-01", "concentraciones", "coche", ["concentracion", "coche", "encuentro", "exterior"], "concentraciones-01-coches-encuentro-exterior.webp"),
  fallback("concentraciones-02", "concentraciones", "moto", ["concentracion", "moto", "encuentro"], "concentraciones-02-motos-encuentro-paseo-maritimo.webp"),
  fallback("concentraciones-03", "concentraciones", "mixto", ["concentracion", "mixto", "coche", "moto", "social"], "concentraciones-03-mixta-coches-motos-ambiente-social.webp"),
  fallback("concentraciones-04", "concentraciones", "coche", ["concentracion", "coche", "club", "personalizado"], "concentraciones-04-club-coches-personalizados-tarde-noche.webp"),
  fallback("concentraciones-05", "concentraciones", "mixto", ["concentracion", "mixto", "comunidad", "evento-local"], "concentraciones-05-evento-local-mixto-comunidad.webp"),
  fallback("concentraciones-06", "concentraciones", "moto", ["concentracion-motera", "gran-concentracion", "alta-participacion", "diurna"], "concentraciones-06-gran-concentracion-motera-diurna-alta-participacion.webp"),
  fallback("concentraciones-07", "concentraciones", "moto", ["motoalmuerzo", "almuerzo-motero", "matinal", "matinal-motera", "encuentro-matinal", "terraza", "local"], "concentraciones-07-motoalmuerzo-encuentro-matinal-terraza-motos.webp"),
  fallback("concentraciones-08", "concentraciones", "moto", ["nocturna", "custom", "biker", "concentracion-motera", "social"], "concentraciones-08-motera-nocturna-custom-ambiente-social.webp"),
  fallback("concentraciones-09", "concentraciones", "moto", ["motoalmuerzo", "almuerzo-motero", "matinal", "zona-rural", "encuentro-matinal", "motos", "social"], "concentraciones-09-motoalmuerzo-zona-rural-encuentro-matinal-motos.webp"),

  fallback("offroad-01", "offroad", "coche", ["offroad", "4x4", "trialera", "roca"], "offroad-01-4x4-trialera-roca.webp"),
  fallback("offroad-02", "offroad", "moto", ["offroad", "enduro", "moto", "bosque"], "offroad-02-enduro-sendero-tecnico-bosque.webp"),
  fallback("offroad-03", "offroad", "moto", ["offroad", "motocross", "moto", "salto"], "offroad-03-motocross-salto-circuito-tierra.webp"),
  fallback("offroad-04", "offroad", "coche", ["offroad", "raid", "buggy", "pista"], "offroad-04-raid-pista-rapida-paisaje-abierto.webp"),
  fallback("offroad-05", "offroad", "moto", ["offroad", "trial", "moto", "roca"], "offroad-05-trial-roca-obstaculo-tecnico.webp"),
  fallback("offroad-06", "offroad", "coche", ["offroad", "4x4", "barro", "agua"], "offroad-06-barro-agua-terreno-humedo.webp"),
  fallback("offroad-07", "offroad", "moto", ["offroad", "moto", "enduro", "exterior", "seco", "sendero", "paisaje-abierto"], "offroad-07-enduro-exterior-sendero-seco-paisaje-abierto.webp"),
  fallback("offroad-08", "offroad", "moto", ["offroad", "moto", "enduro", "enduro-indoor", "superenduro", "obstaculos", "indoor"], "offroad-08-enduro-indoor-obstaculos-artificiales-recinto-deportivo.webp"),
  fallback("offroad-09", "offroad", "moto", ["offroad", "moto", "motocross", "curva", "roost", "accion-individual"], "offroad-09-motocross-curva-baja-roost-outdoor.webp"),
  fallback("offroad-10", "offroad", "moto", ["offroad", "moto", "motocross", "salida", "grupo", "competicion"], "offroad-10-motocross-salida-grupo-compacto-outdoor.webp"),
  fallback("offroad-11", "offroad", "moto", ["offroad", "moto", "trial", "natural", "ladera", "exterior"], "offroad-11-trial-natural-ladera-seccion-tecnica-paisaje-abierto.webp"),
  fallback("offroad-12", "offroad", "moto", ["offroad", "moto", "trial", "trial-indoor", "indoor", "artificial", "modulos"], "offroad-12-trial-indoor-modulos-artificiales-recinto-deportivo.webp"),
  fallback("offroad-13", "offroad", "coche", ["offroad", "coche", "autocross", "tierra", "grupo", "carrera", "compacto"], "offroad-13-autocross-grupo-compacto-circuito-tierra-polvo.webp"),
  fallback("offroad-14", "offroad", "coche", ["offroad", "coche", "autocross", "tierra", "individual", "curva", "polvo"], "offroad-14-autocross-coche-individual-curva-tierra-polvo.webp"),
  fallback("offroad-15", "offroad", "moto", ["offroad", "moto", "cross-country", "crosscountry", "xc", "rapido", "terreno-abierto", "resistencia"], "offroad-15-cross-country-moto-pista-rapida-terreno-abierto.webp"),
  fallback("offroad-16", "offroad", "moto", ["cross-country", "crosscountry", "xc", "terreno-verde", "dos-motos", "pista-rapida", "resistencia", "campo-abierto"], "offroad-16-cross-country-moto-terreno-verde-dos-motos-pista-rapida.webp"),
  fallback("offroad-17", "offroad", "moto", ["enduro", "enduro-indoor", "superenduro", "indoor", "neumaticos", "escalones", "obstaculos", "recinto-luminoso"], "offroad-17-enduro-indoor-neumaticos-escalones-recinto-luminoso.webp"),

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
