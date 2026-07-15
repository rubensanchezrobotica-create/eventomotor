# Informe de deduplicación del Lote 034

Fecha de análisis: 2026-07-15  
Export local: `data/exports/events-current-2026-07-15.json` (947 eventos; 707 futuros)  
Lote: `data/imports/lote-034-events.json`

## Resumen

| Métrica del dry-run | Resultado |
|---|---:|
| Candidatos recibidos | 37 |
| Válidos | 37 |
| Insertables | 37 |
| Insertables revisados | 0 |
| Duplicados exactos | 0 |
| Posibles duplicados contra Supabase | 0 |
| Inválidos | 0 |
| Enrichment candidates | 0 |

El importador clasificó los 37 candidatos como `insertable`. La auditoría local contra el export tampoco encontró un evento existente equivalente. Como control adicional del propio lote, se detectó una pareja interna que requiere revisión manual: EasyRace Albacete del 26 y 27 de septiembre. Esta alerta no modifica el JSON ni la clasificación real del dry-run.

## Tabla individual

| # | Candidato | Fecha | Ciudad / provincia | Dry-run | Auditoría | Coincidencia existente (ID / slug) | Similitud y motivo | V2 completados | Campos V2 ausentes | Fuente genérica | Recomendación |
|---:|---|---|---|---|---|---|---|---|---|---|---|
| 1 | LXV Gran Premio de La Bañeza 2026 | 2026-08-07–2026-08-09 | La Bañeza / León | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | venue, organizer, organizer_url, official_url | registration_url, schedule, address | no | Mantener como insertable. |
| 2 | Semana Grande Biker Friendly y III Motoasado BF 2026 | 2026-08-12–2026-08-16 | Villanueva de Oscos / Asturias | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | organizer, organizer_url, official_url | venue, registration_url, schedule, address | no | Mantener como insertable. |
| 3 | X Concentración Motera Alovera 2026 | 2026-08-15 | Alovera / Guadalajara | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | venue, organizer, official_url, schedule | organizer_url, registration_url, address | no | Mantener como insertable. |
| 4 | I Quedada de Vehículos Clásicos de Sayago 2026 | 2026-08-16 | Bermillo de Sayago / Zamora | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | organizer, organizer_url, official_url | venue, registration_url, schedule, address | sí | Mantener como insertable. |
| 5 | I Concentración Motos por Béjar 2026 | 2026-08-21–2026-08-23 | Béjar / Salamanca | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | venue, organizer, official_url, schedule, address | organizer_url, registration_url | no | Mantener como insertable. |
| 6 | XII Xuntanza Motera Vila dos Viaductos 2026 | 2026-08-29 | Redondela / Pontevedra | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | venue, official_url | organizer, organizer_url, registration_url, schedule, address | no | Mantener como insertable. |
| 7 | II Prueba Minimotos Los Lanzaos 2026 | 2026-08-29 | Hospital de Órbigo / León | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | official_url, registration_url, schedule | venue, organizer, organizer_url, address | no | Mantener como insertable. |
| 8 | Ducati Riding Camp Albacete 2026 | 2026-10-17 | Albacete / Albacete | insertable | insertable | CEF InterOpen Velocidad Albacete 2026 (`batch-cef-interopen-velocidad-albacete-2026-10-10` / `cef-interopen-velocidad-albacete-2026-10-10`) | baja: Mismo circuito; siete días de diferencia y distinta actividad. | venue, organizer, organizer_url, official_url, schedule | registration_url, address | no | Mantener como insertable. |
| 9 | Tandas Privadas Circuito de Albacete noviembre I 2026 | 2026-11-14 | Albacete / Albacete | insertable | insertable | Tandas libres y curso Circuito de Albacete JMR Racing 2026 (`batch-tandas-libres-curso-circuito-albacete-jmr-racing-2026-10-31` / `tandas-libres-curso-circuito-albacete-jmr-racing-2026-10-31`) | baja: Mismo circuito; 14 días de diferencia, organizador y URL distintos. | venue, organizer, organizer_url, official_url, schedule | registration_url, address | no | Mantener separada provisionalmente; fecha y URL específica distintas de la cita del 22/11. |
| 10 | BKC Motorsports Circuito de Albacete noviembre 2026 | 2026-11-15 | Albacete / Albacete | insertable | insertable | Tandas libres y curso Circuito de Albacete JMR Racing 2026 (`batch-tandas-libres-curso-circuito-albacete-jmr-racing-2026-10-31` / `tandas-libres-curso-circuito-albacete-jmr-racing-2026-10-31`) | baja: Mismo circuito; 15 días de diferencia y organizador distinto. | venue, organizer, organizer_url, official_url, schedule | registration_url, address | no | Mantener como insertable. |
| 11 | Tandas Privadas Circuito de Albacete noviembre II 2026 | 2026-11-22 | Albacete / Albacete | insertable | insertable | Tandas libres y curso Circuito de Albacete JMR Racing 2026 (`batch-tandas-libres-curso-circuito-albacete-jmr-racing-2026-10-31` / `tandas-libres-curso-circuito-albacete-jmr-racing-2026-10-31`) | baja: Mismo circuito; 22 días de diferencia, organizador y URL distintos. | venue, organizer, organizer_url, official_url, schedule | registration_url, address | no | Mantener separada provisionalmente; fecha y URL específica distintas de la cita del 14/11. |
| 12 | EasyRace Circuito de Albacete septiembre I 2026 | 2026-09-26 | Albacete / Albacete | insertable | possible_duplicate interno | Tandas libres y curso Circuito de Albacete AB Riders 2026 (`batch-tandas-libres-curso-circuito-albacete-ab-riders-2026-09-20` / `tandas-libres-curso-circuito-albacete-ab-riders-2026-09-20`) | baja: Mismo circuito; seis días de diferencia y organizador distinto. | venue, organizer, organizer_url, official_url, schedule | registration_url, address | no | Revisar junto con EasyRace 27/09: posible evento de dos días dividido en dos fichas oficiales. |
| 13 | EasyRace Circuito de Albacete septiembre II 2026 | 2026-09-27 | Albacete / Albacete | insertable | possible_duplicate interno | Tandas libres y curso Circuito de Albacete AB Riders 2026 (`batch-tandas-libres-curso-circuito-albacete-ab-riders-2026-09-20` / `tandas-libres-curso-circuito-albacete-ab-riders-2026-09-20`) | baja: Mismo circuito; siete días de diferencia y organizador distinto. | venue, organizer, organizer_url, official_url, schedule | registration_url, address | no | Revisar junto con EasyRace 26/09: posible evento de dos días dividido en dos fichas oficiales. |
| 14 | Motorbikes Racing Circuito de Albacete octubre 2026 | 2026-10-25 | Albacete / Albacete | insertable | insertable | Tandas libres y curso Circuito de Albacete JMR Racing 2026 (`batch-tandas-libres-curso-circuito-albacete-jmr-racing-2026-10-31` / `tandas-libres-curso-circuito-albacete-jmr-racing-2026-10-31`) | media-baja: Mismo circuito y seis días de diferencia; organizador, fecha y URL específicos distintos. | venue, organizer, organizer_url, official_url, schedule | registration_url, address | no | Mantener como insertable. |
| 15 | 2 Fast 2 Events Circuito de Albacete noviembre 2026 | 2026-11-07 | Albacete / Albacete | insertable | insertable | Tandas libres y curso Circuito de Albacete JMR Racing 2026 (`batch-tandas-libres-curso-circuito-albacete-jmr-racing-2026-10-31` / `tandas-libres-curso-circuito-albacete-jmr-racing-2026-10-31`) | baja: Mismo circuito y siete días de diferencia; organizador y URL distintos. | venue, organizer, organizer_url, official_url, schedule | registration_url, address | no | Mantener como insertable. |
| 16 | XVII Concentración de Vehículos Clásicos Villa de Alhama 2026 | 2026-09-19 | Alhama de Murcia / Murcia | insertable | insertable | Copa de España de Motocross Clásico - Alhama (`rfme-copa-de-espana-de-motocross-clasico-alhama-2026-10-18` / `copa-de-espana-de-motocross-clasico-alhama-2026-10-18`) | baja: Misma ciudad, pero 29 días después y disciplina completamente distinta. | official_url | venue, organizer, organizer_url, registration_url, schedule, address | no | Mantener como insertable. |
| 17 | II Concentración de Vehículos Clásicos de Cártama 2026 | 2026-09-19 | Cártama / Málaga | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | venue, official_url | organizer, organizer_url, registration_url, schedule, address | no | Mantener como insertable. |
| 18 | Expoclàssic Mollerussa 2026 | 2026-09-19–2026-09-20 | Mollerussa / Lleida | insertable | insertable | CEAX Mollerussa 2026 (`batch-ceax-mollerussa-2026-10-03` / `ceax-mollerussa-2026-10-03`) | baja: Misma ciudad; 14 días de diferencia y naturaleza distinta. | venue, organizer, organizer_url, official_url | registration_url, schedule, address | sí | Mantener como insertable. |
| 19 | Autotardor Mollerussa 2026 | 2026-10-23–2026-10-25 | Mollerussa / Lleida | insertable | insertable | CEAX Mollerussa 2026 (`batch-ceax-mollerussa-2026-10-03` / `ceax-mollerussa-2026-10-03`) | baja: Misma ciudad; 20 días de diferencia y naturaleza distinta. | venue, organizer, organizer_url, official_url | registration_url, schedule, address | no | Mantener como insertable. |
| 20 | Salón del Automóvil de Lleida 2026 | 2026-09-25–2026-09-27 | Lleida / Lleida | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | venue, organizer, official_url, schedule | organizer_url, registration_url, address | no | Mantener como insertable. |
| 21 | Lleida Retro 2026 | 2026-11-21–2026-11-22 | Lleida / Lleida | insertable | insertable | 4 Hores Lleida 2026 (`batch-4-hores-lleida-2026-12-05` / `4-hores-lleida-2026-12-05`) | baja: Misma ciudad; 14 días de diferencia y disciplina distinta. | venue, organizer, official_url, schedule | organizer_url, registration_url, address | no | Mantener como insertable. |
| 22 | Concentración de Motos y Coches Clásicos Alcublas 2026 | 2026-08-16 | Alcublas / Valencia | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | — | venue, organizer, organizer_url, official_url, registration_url, schedule, address | no | Mantener como candidato; verificar la fuente antes de crear el lote limpio. |
| 23 | XVI Encuentro Motero Los Otros Topares 2026 | 2026-08-08 | Topares / Almería | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | venue | organizer, organizer_url, official_url, registration_url, schedule, address | sí | Mantener como candidato; verificar la fuente antes de crear el lote limpio. |
| 24 | XVII Concentración Motera Piratas de Adra 2026 | 2026-08-14–2026-08-16 | Adra / Almería | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | — | venue, organizer, organizer_url, official_url, registration_url, schedule, address | sí | Confirmar cartel definitivo antes del lote limpio. |
| 25 | V Concentración Motera Arboleanos por el Mundo 2026 | 2026-08-15–2026-08-16 | Arboleas / Almería | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | — | venue, organizer, organizer_url, official_url, registration_url, schedule, address | sí | Confirmar cartel definitivo antes del lote limpio. |
| 26 | 2.º Evento Motero Campos del Río 2026 | 2026-09-05 | Campos del Río / Murcia | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | — | venue, organizer, organizer_url, official_url, registration_url, schedule, address | sí | Mantener como candidato; verificar la fuente antes de crear el lote limpio. |
| 27 | V Concentración Motera Ciudad de Ceuta 2026 | 2026-09-11–2026-09-13 | Ceuta / Ceuta | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | official_url | venue, organizer, organizer_url, registration_url, schedule, address | sí | Aclarar si el 12 de septiembre forma parte del evento. |
| 28 | XIII Concentración Motera Porcuna 2026 | 2026-09-12–2026-09-13 | Porcuna / Jaén | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | — | venue, organizer, organizer_url, official_url, registration_url, schedule, address | no | Confirmar organizador y datos de la edición antes del lote limpio. |
| 29 | IV Concentración del Coche Clásico e Histórico Villa de Badolatosa 2026 | 2026-10-25 | Badolatosa / Sevilla | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | — | venue, organizer, organizer_url, official_url, registration_url, schedule, address | no | No pasar al lote limpio sin una fuente específica de 2026; la fuente actual es de la edición anterior. |
| 30 | XIII Concentración de Vehículos Clásicos Ciudad de Sagunto 2026 | 2026-07-26 | Sagunto / Valencia | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | venue, schedule | organizer, organizer_url, official_url, registration_url, address | sí | Mantener como candidato; verificar la fuente antes de crear el lote limpio. |
| 31 | XIV Concentración de Clásicos, Coches y Motos Alto Asón 2026 | 2026-08-01–2026-08-02 | Ramales de la Victoria / Cantabria | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | — | venue, organizer, organizer_url, official_url, registration_url, schedule, address | sí | Confirmar la edición 2026 con fuente específica; la URL aportada corresponde a un calendario de 2025. |
| 32 | V Concentración de Vehículos Clásicos Las Regueras 2026 | 2026-08-02 | Las Regueras / Asturias | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | — | venue, organizer, organizer_url, official_url, registration_url, schedule, address | sí | Mantener como candidato; verificar la fuente antes de crear el lote limpio. |
| 33 | Concentración Anual de Clásicos Toranzo 2026 | 2026-08-09 | Puente Viesgo / Cantabria | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | — | venue, organizer, organizer_url, official_url, registration_url, schedule, address | sí | Mantener como candidato; verificar la fuente antes de crear el lote limpio. |
| 34 | IV Concentración de Clásicos, Coches y Motos El Regato 2026 | 2026-08-16 | Barakaldo / Bizkaia | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | venue | organizer, organizer_url, official_url, registration_url, schedule, address | sí | Mantener como candidato; verificar la fuente antes de crear el lote limpio. |
| 35 | XIX Motoabuelada 2026 | 2026-08-22–2026-08-23 | Castrillo de la Vega / Burgos | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | organizer | venue, organizer_url, official_url, registration_url, schedule, address | no | Mantener como candidato; verificar la fuente antes de crear el lote limpio. |
| 36 | Concentración de Coches Clásicos Espinosa de los Monteros 2026 | 2026-08-29 | Espinosa de los Monteros / Burgos | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | — | venue, organizer, organizer_url, official_url, registration_url, schedule, address | sí | Mantener como candidato; verificar la fuente antes de crear el lote limpio. |
| 37 | XIV Concentración de Vehículos Clásicos Udondo 2026 | 2026-09-12 | Leioa / Bizkaia | insertable | insertable | — | ninguna: sin coincidencia relevante en 947 eventos | venue | organizer, organizer_url, official_url, registration_url, schedule, address | sí | Mantener como candidato; verificar la fuente antes de crear el lote limpio. |

## Alertas internas

### EasyRace Albacete 26–27 de septiembre

- Mismo organizador, recinto, disciplina y horario; fechas consecutivas.
- Cada jornada tiene URL oficial específica distinta: `/easyrace/` y `/easyrace-2/`.
- El importador no compara similitud fuzzy entre objetos nuevos del mismo lote y devuelve ambos como `insertable`.
- Recomendación: comprobar manualmente si son dos jornadas contratables por separado o un único evento de dos días. No aprobar ni fusionar automáticamente.

### Tandas Privadas Albacete 14 y 22 de noviembre

- Mismo organizador y recinto, pero ocho días de diferencia.
- URLs oficiales específicas distintas: `/tandas-privadas/` y `/tandas-privadas-3/`.
- Recomendación: mantener separadas provisionalmente; una comprobación manual del calendario limpio sería suficiente antes de aplicar.

### Eventos de Almería

- Topares (08/08), Adra (14–16/08) y Arboleas (15–16/08) son títulos y localidades distintas.
- Adra y Arboleas se solapan, pero no comparten municipio ni denominación. No hay señal de duplicado.
- Los dos carteles provisionales deben verificarse por calidad de fuente, no por deduplicación.

### Clásicos y ferias

- Alhama, Cártama y Expoclàssic comparten fecha de inicio, pero están en provincias y sedes distintas.
- Expoclàssic y Autotardor comparten Fira de Mollerussa, pero tienen fechas y naturaleza distintas.
- Lleida Retro es una actividad concreta y no se creó un segundo candidato para Lleidantic.
- Sagunto, Alto Asón, Las Regueras, Toranzo, El Regato, Espinosa y Udondo no presentan coincidencia territorial-temporal suficiente entre sí ni contra el export.

## Fuentes genéricas o débiles

Se han marcado 14 candidatos con URL general, agenda, timeline o calendario no específico. Los casos de mayor riesgo son:

- Badolatosa: la fuente corresponde a la edición anterior; confianza 55.
- Alto Asón: la URL aportada corresponde a un calendario de 2025; confianza 58.
- Piratas de Adra y Arboleanos: cartel provisional.
- Moteros Almería, AVCT Agenda, ICD Ceuta, Canal Difusión y varias fichas de Briefing Sport: requieren comprobación específica antes del lote limpio.

La URL genérica no ha producido duplicados exactos en este dry-run.

## Eventos con needs_review

| Evento | Confianza | Motivo principal |
|---|---:|---|
| Concentración de Motos y Coches Clásicos Alcublas 2026 | 70 | Fuente secundaria o general; verificación pendiente. |
| XVI Encuentro Motero Los Otros Topares 2026 | 68 | Fuente secundaria o general; verificación pendiente. |
| XVII Concentración Motera Piratas de Adra 2026 | 68 | La fuente aportada indica cartel provisional. |
| V Concentración Motera Arboleanos por el Mundo 2026 | 68 | La fuente aportada indica cartel provisional. |
| 2.º Evento Motero Campos del Río 2026 | 70 | Fuente secundaria o general; verificación pendiente. |
| V Concentración Motera Ciudad de Ceuta 2026 | 72 | La fuente muestra los días 11 y 13 de septiembre sin aclarar expresamente si el día 12 forma parte del programa. |
| XIII Concentración Motera Porcuna 2026 | 66 | Información limitada en la fuente aportada; no se confirma programa ni organizador. |
| IV Concentración del Coche Clásico e Histórico Villa de Badolatosa 2026 | 55 | La fuente corresponde a la edición anterior y anuncia continuidad; la fecha de 2026 requiere confirmación específica. |
| XIII Concentración de Vehículos Clásicos Ciudad de Sagunto 2026 | 70 | La fuente aportada no identifica al club organizador. |
| XIV Concentración de Clásicos, Coches y Motos Alto Asón 2026 | 58 | La fuente aportada es un calendario general y requiere confirmación específica de la edición 2026. |
| V Concentración de Vehículos Clásicos Las Regueras 2026 | 62 | Fuente secundaria o general; verificación pendiente. |
| Concentración Anual de Clásicos Toranzo 2026 | 62 | Fuente secundaria o general; verificación pendiente. |
| IV Concentración de Clásicos, Coches y Motos El Regato 2026 | 62 | Fuente secundaria o general; verificación pendiente. |
| XIX Motoabuelada 2026 | 72 | Fuente secundaria o general; verificación pendiente. |
| Concentración de Coches Clásicos Espinosa de los Monteros 2026 | 62 | Fuente secundaria o general; verificación pendiente. |
| XIV Concentración de Vehículos Clásicos Udondo 2026 | 62 | Fuente secundaria o general; verificación pendiente. |

## Campos Event v2

- Todos los candidatos incluyen título, slug, fechas, territorio, disciplina, categoría, vehicle_type, fuente, descripciones, tags, estado, confianza y needs_review.
- `organizer_name`, `organizer_url`, `official_url`, `registration_url`, `schedule_text` y `address` solo se completaron cuando el encargo aportaba el dato.
- `registration_url` solo está informado para II Prueba Minimotos Los Lanzaos.
- `address` solo está informado para I Concentración Motos por Béjar.
- `schedule_text` está informado para Alovera, Béjar, Los Lanzaos, los ocho eventos de Albacete, Salón del Automóvil de Lleida, Lleida Retro y Sagunto.
- `image_url`, `image_source_url`, `verified_at`, coordenadas y `ticket_url` permanecen vacíos en los 37 porque no fueron aportados o no correspondía inventarlos.
- Los precios confirmados se documentan en descripción/notas porque el esquema actual del importador no contiene campos específicos de precio.

## Duplicados, inválidos y enriquecimientos

- Duplicados exactos: ninguno.
- Posibles duplicados contra Supabase: ninguno.
- Posible duplicado interno: pareja EasyRace 26–27/09, pendiente de revisión manual.
- Inválidos: ninguno.
- Enrichment candidates: ninguno; no se encontró una ficha existente equivalente que deba enriquecerse en vez de insertar.
- Discarded: ninguno; los 37 permanecen en el JSON por instrucción.

## Conclusión

El lote es técnicamente válido y el dry-run permite los 37 candidatos. Antes de crear un lote limpio se recomienda resolver la pareja EasyRace y verificar las fuentes débiles señaladas, especialmente Badolatosa y Alto Asón. No se ha aplicado ninguna inserción ni corrección.
