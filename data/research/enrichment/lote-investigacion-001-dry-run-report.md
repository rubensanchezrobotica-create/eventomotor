# Dry-run de enriquecimiento del Lote 001

- Generado: 2026-07-20T18:19:03.517Z
- Modo: SELECT de 20 IDs y generación local; cero escrituras en Supabase.

## Resumen

| Métrica | Total |
|---|---:|
| Eventos | 20 |
| Preparados | 0 |
| Preparados con advertencias | 20 |
| Bloqueados | 0 |
| Campos que cambiarían | 303 |
| Títulos modificados | 13 |
| Fechas modificadas | 2 |
| Disciplinas modificadas | 1 |
| Fuentes reemplazadas | 20 |
| Organizadores añadidos o corregidos | 19 |
| Programas añadidos | 18 |
| Direcciones añadidas | 9 |
| needs_review true → false | 9 |
| Pasarán a históricos | 1 |
| Slugs semánticamente antiguos | 5 |
| Eventos con deriva | 0 |

## Tabla completa

| Evento | Estado | Campos | Riesgo | Observaciones |
|---|---|---:|---|---|
| Tandas libres Ricardo Tormo Racing100 julio 2026 | ready_with_warnings | 13 | low | 3 campos o decisiones siguen sin resolver. |
| Baja España Aragón - FIA WBC | ready_with_warnings | 15 | low | 5 campos o decisiones siguen sin resolver. |
| Campeonato de España de Freestyle - Puerto de Santa María | ready_with_warnings | 18 | low | 3 campos o decisiones siguen sin resolver. |
| 6.º Karting Outeiro de Rei 2026 | ready_with_warnings | 14 | medium | 5 campos o decisiones siguen sin resolver. |
| V Rallymix Concello de Ribadumia 2026 | ready_with_warnings | 15 | medium | 5 campos o decisiones siguen sin resolver. |
| Boiromotos 2026 | ready_with_warnings | 12 | low | 5 campos o decisiones siguen sin resolver. |
| XVI Concentración Motera Ruedas Raras Toro 2026 | ready_with_warnings | 15 | medium | 4 campos o decisiones siguen sin resolver. |
| XV Pujada Alp 2500 2026 | ready_with_warnings | 18 | high | El slug conserva la fecha anterior 2026-07-25. 4 campos o decisiones siguen sin resolver. La corrección de fechas hará que el evento pase a histórico. |
| XIII Subida a Betancuria 2026 | ready_with_warnings | 19 | medium | El slug conserva la disciplina anterior Rallysprint. El slug conserva una identidad anterior del evento. 4 campos o decisiones siguen sin resolver. |
| X Subida de La Pizarra 2026 | ready_with_warnings | 14 | low | 5 campos o decisiones siguen sin resolver. |
| TT Cierru Los Pinos 2026 | ready_with_warnings | 13 | low | 5 campos o decisiones siguen sin resolver. |
| II Concentración Motera La Reconquista 2026 | ready_with_warnings | 15 | medium | 3 campos o decisiones siguen sin resolver. |
| XII Concentración de Coches y Motos Clásicos Ciudad de Sagunto 2026 | ready_with_warnings | 16 | medium | El slug conserva la edición anterior del título. 4 campos o decisiones siguen sin resolver. |
| XI Enduro Cueva del Oso – Sierra de Ibio 2026 | ready_with_warnings | 14 | medium | null_no_borra:organizer_name null_no_borra:organizer_url El slug conserva una identidad anterior del evento. 6 campos o decisiones siguen sin resolver. Contiene una limpieza explícita sujeta a precondición. |
| Tandas libres y curso Eventos Ceni – Circuito de Navarra 2026 | ready_with_warnings | 16 | medium | 3 campos o decisiones siguen sin resolver. |
| Tandas libres y curso EasyRace – Jarama 2026 | ready_with_warnings | 17 | medium | 5 campos o decisiones siguen sin resolver. |
| I Enduro Indoor Ciudad de Olvera 2026 | ready_with_warnings | 17 | medium | null_no_borra:organizer_url El slug conserva la fecha anterior 2026-07-26. 5 campos o decisiones siguen sin resolver. |
| Campionato Galego de Velocidade – A Madalena II 2026 | ready_with_warnings | 15 | medium | null_no_borra:organizer_url 6 campos o decisiones siguen sin resolver. |
| XIX Rallye Blendio Cristian López 2026 | ready_with_warnings | 14 | low | 4 campos o decisiones siguen sin resolver. |
| XIV Concentración de Coches y Motos Clásicas del Alto Asón 2026 | ready_with_warnings | 13 | medium | null_no_borra:official_url 8 campos o decisiones siguen sin resolver. |

## Títulos corregidos

- Karting Outeiro de Rei 2026 → 6.º Karting Outeiro de Rei 2026
- Rallymix Ribadumia 2026 → V Rallymix Concello de Ribadumia 2026
- XVI Concentracion Ruedas Raras Toro 2026 → XVI Concentración Motera Ruedas Raras Toro 2026
- Pujada ALP 2500 → XV Pujada Alp 2500 2026
- Rallysprint Betancuria 2026 → XIII Subida a Betancuria 2026
- La Reconquista Motera 2026 → II Concentración Motera La Reconquista 2026
- XIII Concentración de Vehículos Clásicos Ciudad de Sagunto 2026 → XII Concentración de Coches y Motos Clásicos Ciudad de Sagunto 2026
- Enduro Comunidad de Madrid Ibio 2026 → XI Enduro Cueva del Oso – Sierra de Ibio 2026
- Tandas libres y curso Circuito de Navarra Eventos Ceni 2026 → Tandas libres y curso Eventos Ceni – Circuito de Navarra 2026
- Tandas libres y curso Jarama Easyrace julio 2026 → Tandas libres y curso EasyRace – Jarama 2026
- Enduro Indoor Andalucia Olvera 2026 → I Enduro Indoor Ciudad de Olvera 2026
- Campionato Galego de Velocidade A Madalena julio 2026 → Campionato Galego de Velocidade – A Madalena II 2026
- XIV Concentración de Clásicos, Coches y Motos Alto Asón 2026 → XIV Concentración de Coches y Motos Clásicas del Alto Asón 2026

## Fechas corregidas

- Pujada ALP 2500: 2026-07-25/2026-07-26 → 2026-07-11/2026-07-12
- Enduro Indoor Andalucia Olvera 2026: 2026-07-26/2026-07-26 → 2026-07-25/2026-07-25

## Disciplinas corregidas

- Rallysprint Betancuria 2026: Rallysprint → Subida

## Impacto en disciplinas futuras

- Rallysprint: -1

## Eventos que pasarán a históricos

- XV Pujada Alp 2500 2026

## Slugs semánticamente antiguos

- pujada-alp-2500-2026-07-25: El slug conserva la fecha anterior 2026-07-25.
- rallysprint-betancuria-2026-07-25: El slug conserva la disciplina anterior Rallysprint. El slug conserva una identidad anterior del evento.
- xiii-concentracion-vehiculos-clasicos-ciudad-sagunto-2026-07-26: El slug conserva la edición anterior del título.
- enduro-comunidad-madrid-ibio-2026-07-26: El slug conserva una identidad anterior del evento.
- enduro-indoor-andalucia-olvera-2026-07-26: El slug conserva la fecha anterior 2026-07-26.

## Drift detectado

- Ninguno.

## Conflictos y decisiones pendientes

- Ninguno.

