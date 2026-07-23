# Newsletter reintegration R3A.1 — Ephemeral SQL validation in CI

## Objetivo

R3A.1 crea una validación PostgreSQL real para la migración newsletter de R1 dentro de un runner
efímero de GitHub Actions. La migración productiva permanece en
`database/migrations/20260721133000_newsletter_core_foundation.sql` y sigue siendo la única fuente
de verdad.

El checkpoint no inicia R3B, no crea endpoints, no conecta formularios y no configura ningún
proveedor de correo o proyecto Supabase remoto.

## Por qué se usa CI

El entorno local del equipo no dispone de Docker, Supabase CLI ni `psql`. Las pruebas TypeScript y
el preparador continúan siendo ejecutables localmente, mientras GitHub Actions aporta un runner
Linux con Docker para validar la migración contra PostgreSQL real.

No se afirma que la migración haya pasado PostgreSQL hasta que el workflow termine en verde. Los
tests SQL versionados son expectativas ejecutables, no resultados anticipados.

## Aislamiento

El workflow:

- Usa `ubuntu-latest` y permisos globales `contents: read`.
- No usa environments, secrets, project refs o credenciales de producción.
- No ejecuta login, link, push ni operaciones linked.
- No lee `.env.local`.
- Desactiva telemetría de la CLI.
- No persiste claves, dumps, variables de estado o artifacts.
- Ejecuta cleanup con `if: always()` y `stop --no-backup`.
- Elimina el workspace generado al finalizar.

El trigger es `pull_request`, no `pull_request_target`, por lo que los forks no reciben un contexto
privilegiado. Como el job no recibe secrets y el token sólo tiene lectura, ejecutar los tests del PR
no concede acceso de escritura o despliegue.

## Versiones fijadas

- `actions/checkout@v7`.
- `actions/setup-node@v7` con Node.js 24 y caché desactivada.
- `supabase/setup-cli@v3`.
- Supabase CLI `2.101.0`.

La CLI se fija a `2.101.0` porque es una release estable concreta y verificable; no se utiliza
`latest` ni una beta. El workflow comprueba `supabase --version` antes de crear la base. Cualquier
actualización de CLI debe pasar por revisión del config, comandos y comportamiento de imágenes.
El runtime TypeScript del test del preparador se instala desde el lockfile con
`npm ci --ignore-scripts --no-audit --no-fund`; no se descargan herramientas globales ni se ejecutan
scripts de instalación de dependencias.

## Workspace temporal

`scripts/prepare-newsletter-supabase-ci.mjs` genera exclusivamente:

```text
.tmp/newsletter-supabase-ci/
  newsletter-ci-manifest.json
  supabase/
    config.toml
    migrations/
      20260721133000_newsletter_core_foundation.sql
    tests/
      newsletter_schema.test.sql
      newsletter_permissions.test.sql
      newsletter_subscription.test.sql
      newsletter_confirmation.test.sql
      newsletter_unsubscribe.test.sql
      newsletter_provider_events.test.sql
      newsletter_rollback.test.sql
```

El workspace está ignorado por Git. No contiene seeds, otras migraciones, `.env.local`, dumps o
configuración remota. `project_id` es `eventomotor-newsletter-ci`.

Antes de copiar, el preparador elimina sólo la ruta exacta
`.tmp/newsletter-supabase-ci`. Verifica que la ruta resuelta permanece dentro del repositorio para
evitar borrados amplios o dependientes de variables.

## Verificación de la fuente productiva

El preparador calcula SHA-256 del archivo productivo y de su copia. Si no coinciden, falla antes de
iniciar Supabase. También exige que el directorio temporal contenga exactamente una migración.

El manifest generado registra rutas relativas, hash y nombres de tests, pero no credenciales.

Comandos locales sin Docker:

```powershell
npm run test:newsletter-r3a1
npm run prepare:newsletter-db-ci
node scripts/prepare-newsletter-supabase-ci.mjs --clean
```

## Configuración Supabase local

El config temporal habilita exclusivamente la Data API y Auth local, además de PostgreSQL. Storage,
Realtime, Studio, Inbucket, Edge Runtime y Analytics permanecen deshabilitados, igual que los seeds.
Auth permite email/password, desactiva la confirmación de email, usa una `site_url` local y no
configura OAuth ni SMTP.

El workflow prioriza:

```text
supabase --workdir .tmp/newsletter-supabase-ci start
```

`start` crea el stack local aislado y aplica la única migración copiada. No se ejecuta `db push`.

## Workflow y filtros

Workflow: `.github/workflows/newsletter-database-tests.yml`.

Se ejecuta en `pull_request`, `push` y manualmente mediante `workflow_dispatch`. Los filtros `paths`
incluyen:

- La migración newsletter.
- Workflow y preparador.
- Tests SQL y del preparador.
- Contratos R3A de repositorio y servicio que dependen de las RPC.
- `package.json`.
- `package-lock.json`.

`concurrency` cancela ejecuciones anteriores del mismo workflow y ref. El timeout del job es de 25
minutos.

## Hallazgos de la primera ejecución real

La ejecución `Newsletter database tests #1` aplicó correctamente la migración y descubrió dos
defectos de validación antes de llegar a concurrencia o DB lint:

- `confirm_newsletter_subscription` declaraba `subscriber_id` como columna de retorno y utilizaba
  `ON CONFLICT (subscriber_id)` al activar la preferencia. PostgreSQL no podía decidir si el nombre
  era la variable PL/pgSQL de retorno o la columna de `newsletter_preferences`. La función usa ahora
  `ON CONFLICT ON CONSTRAINT newsletter_preferences_pkey`, cuya identidad se valida también contra
  el catálogo real.
- `request_newsletter_subscription` tenía la misma clase de riesgo en un `WHERE subscriber_id` no
  cualificado. La tabla de tokens usa ahora un alias explícito, sin cambiar el comportamiento.
- Las comprobaciones de permisos sí recibieron SQLSTATE `42501`; los grants y RLS funcionaron como
  estaban diseñados. El fallo TAP procedía de usar la sobrecarga de dos argumentos de `throws_ok`,
  que interpretaba la descripción humana como mensaje esperado. Las operaciones de tabla fijan los
  cuatro argumentos y el mensaje observado; las RPC fijan `42501` y usan `NULL` como mensaje para no
  depender de texto no observado o localizado.

PostgreSQL se reinició durante la suite de permisos. La primera ejecución no capturó los logs del
servidor, por lo que la causa continúa sin explicar y no se atribuye todavía a RLS, grants o una RPC.

## Hallazgos de la segunda ejecución real y corrección R3A.1.2

La ejecución `Newsletter database tests #2` (`29862643710`) volvió a aplicar correctamente la
migración. `newsletter_confirmation.test.sql` completó sus 16 aserciones y las primeras ocho
aserciones de permisos de tabla también pasaron. En total, las 24 aserciones emitidas fueron
correctas; no hubo ninguna aserción SQL fallida.

PostgreSQL terminó el backend que ejecutaba la novena aserción con `signal 11: Segmentation fault`.
El proceso estaba dentro de `throws_ok`, después de `SET ROLE anon`, intentando ejecutar la RPC
revocada `request_newsletter_subscription`. El contenedor no sufrió OOM, recuperó health
automáticamente y no hay evidencia de un defecto en la migración, RLS, grants, revocaciones o RPC.

R3A.1.2 elimina únicamente esa interacción inestable. Mantiene las ocho operaciones reales de tabla
y sustituye las ocho ejecuciones RPC dentro de pgTAP por ocho consultas seguras al catálogo. Cada
consulta usa `has_function_privilege` con la firma exacta convertida a `regprocedure` y comprueba que
`anon` o `authenticated` no tiene `EXECUTE`.

La segunda capa es `tests/newsletter/sql/newsletter-rpc-permissions.mjs`. Abre un proceso
`docker exec ... psql` independiente para cada combinación de los dos roles y las cuatro RPC. Cada
sesión ejecuta `SET ROLE`, exige que la llamada real falle y acepta exclusivamente SQLSTATE `42501`.
Los argumentos son fixtures reservados `.invalid`; el script no muestra SQL, credenciales, variables
ni contenido del contenedor.

Antes de cada llamada, el script verifica mediante un `docker inspect` limitado que el contenedor
exacto `supabase_db_eventomotor-newsletter-ci` está `running|healthy`. Una pérdida de conexión se
clasifica como `postgres-process-crash`, espera health durante un tiempo limitado, no reintenta la
RPC que produjo el crash y termina con código distinto de cero. La reproducción mínima consiste en
una sesión `psql` nueva con `SET ROLE`, una única llamada RPC y `ON_ERROR_STOP`, sin pgTAP.

El orden del workflow queda fijado así:

1. Preparar el workspace aislado.
2. Levantar PostgreSQL y aplicar la migración.
3. Ejecutar las siete suites pgTAP.
4. Ejecutar concurrencia real.
5. Ejecutar DB lint.
6. Ejecutar al final las ocho llamadas RPC externas.
7. Recoger diagnóstico seguro si algo falla.
8. Destruir siempre PostgreSQL y el workspace temporal.

La prueba susceptible de reproducir el crash se ejecuta al final para conservar, incluso ante otra
caída, los resultados completos de pgTAP, rollback, concurrencia y DB lint. Los planes versionados
actuales suman 116 aserciones pgTAP, no 115: R3A.1.2 conserva exactamente esa línea base al sustituir
ocho comprobaciones por otras ocho, sin reducir cobertura.

## Hallazgos de la tercera ejecución real y corrección R3A.1.3

La ejecución `Newsletter database tests #3` (`29864679880`) aplicó correctamente la migración y
ejecutó las 116 aserciones planificadas: 108 pasaron y 8 fallaron. PostgreSQL permaneció healthy,
sin OOM, pérdida de conexión ni segmentation fault; el diagnóstico seguro y el cleanup también
terminaron correctamente. Esto confirma que el aislamiento de permisos de R3A.1.2 eliminó la
interacción inestable observada en la ejecución anterior.

Los ocho fallos se clasificaron en dos defectos funcionales y seis defectos de tests:

- La RPC de eventos permitía que un bounce degradase `complained` a `bounced` y que una complaint
  degradase `suppressed` a `complained`.
- Cinco llamadas a `throws_ok` usaban la sobrecarga de dos argumentos. Las RPC lanzaron realmente
  los SQLSTATE esperados (`P0001` o `23503`), pero pgTAP comparó la descripción humana como si fuese
  el mensaje de error.
- El test de baja de un suscriptor `pending` invocaba la RPC y leía el estado persistido dentro de
  la misma sentencia. El outcome fue `unsubscribed`, pero la subconsulta conservó el snapshot previo.

R3A.1.3 hace explícita y monotónica la precedencia operativa:

```text
bounced < complained < suppressed
```

Un evento puede escalar a un estado más restrictivo, pero nunca degradarlo. Los eventos antiguos se
siguen registrando y deduplicando. Los timestamps agregados `bounced_at`, `complained_at`,
`suppressed_at`, `last_sent_at`, `last_delivered_at`, `last_opened_at` y `last_clicked_at` conservan
el valor más reciente mediante una comparación `greatest` que trata correctamente `NULL`. Estado y
timestamps continúan actualizándose dentro de la misma RPC transaccional.

Las cinco comprobaciones de excepciones usan ahora la firma de cuatro argumentos y exigen SQLSTATE:
los tres fallos forzados de consentimiento validan `P0001` y su mensaje exacto; los dos errores de
foreign key validan `23503` sin depender del nombre de la constraint. Las comprobaciones posteriores
de rollback permanecen intactas.

La baja `pending` materializa primero el outcome en una tabla temporal y, en una sentencia posterior,
compara conjuntamente outcome y estado persistido. La RPC de baja no cambia. También se añade la
cobertura PostgreSQL que faltaba para demostrar que `suppressed` permanece `suppressed` ante un
bounce. Por ello el nuevo total esperado es **117 aserciones pgTAP**.

## Cuarta ejecución real y corrección R3A.1.4

La ejecución `Newsletter database tests #4` (`29941195995`) aplicó correctamente la migración y
terminó las siete suites pgTAP con **117/117 aserciones correctas**, sin `Bad plan`. La concurrencia
real y `db lint --local --schema public --level error --fail-on error` también pasaron.

El único fallo apareció al alcanzar por primera vez el validador RPC externo de R3A.1.2. La primera
sesión `psql`, después de `SET ROLE anon`, invocó `request_newsletter_subscription` y el backend de
PostgreSQL terminó por `signal 11: Segmentation fault` antes de devolver un SQLSTATE. El contenedor
seguía `running`, con `ExitCode=0`, `OOMKilled=false` y health `healthy`, mientras PostgreSQL iniciaba
su reinitialización. El cleanup detuvo el stack y eliminó correctamente el workspace efímero.

R3A.1.4 conserva ese crash como anomalía conocida del runtime local, pero deja de ejecutarlo como
gate de CI. No se presenta como corregido y no se modifica la migración, las RPC, RLS, grants o
revocaciones. La validación operativa pasa a la ruta pública real: la Data API/PostgREST local de
Supabase.

El workflow habilita la API únicamente en el `config.toml` generado dentro del workspace temporal y
levanta el stack efímero sin imprimir la salida completa de arranque. El validador obtiene `API_URL`,
la clave local pública/anon y `JWT_SECRET` mediante `supabase status -o json`, captura la salida en
memoria y registra `::add-mask::` antes de utilizar cualquiera de esos valores. No lee `.env.local`,
no conserva `service_role`, no usa un project ref y no contacta con Supabase remoto.

Se realizan ocho `POST application/json` contra `/rest/v1/rpc/<rpc_name>` con los nombres exactos de
los parámetros y fixtures `.invalid`. Los cuatro casos anon deben devolver HTTP `401` y JSON con
`code: "42501"`. Los cuatro casos authenticated usan la misma clave pública y un JWT HS256 local de
cinco minutos, no persistido, con `role: "authenticated"`; deben devolver HTTP `403` y el mismo
SQLSTATE `42501`. Un 2xx, cualquier otro 4xx, `PGRST202`, `PGRST203`, 5xx, JSON inválido, timeout o
desconexión hace fallar la validación.

Antes y después de las llamadas se comparan, mediante una sesión administrativa que no cambia de
rol ni invoca RPC, los recuentos de subscribers, tokens, consent events y email events. Después de
cada petición se exige además que el contenedor continúe `running|healthy`, que una consulta
administrativa responda y que `pg_is_in_recovery()` sea falso. Los fallos de transporte, 5xx,
recovery o pérdida de health se clasifican como `data-api-runtime-failure` y la RPC afectada no se
reintenta.

## Quinta ejecución real y corrección R3A.1.5

La ejecución `Newsletter database tests #5` (`30011397028`) volvió a aplicar correctamente la
migración. Las 117 aserciones pgTAP, la concurrencia real y DB lint pasaron. PostgreSQL permaneció
`running|healthy`, con `ExitCode=0`, `OOMKilled=false`, sin segmentation fault, recovery ni pérdida
de conexión. El diagnóstico seguro y el cleanup terminaron correctamente.

El validador falló en unos 415 ms, antes de ejecutar health, recuentos o cualquier petición RPC, con
`Required local Data API credentials are unavailable.`. R3A.1.4 exigía conjuntamente URL, clave
pública y `JWT_SECRET`; la salida disponible de `supabase status -o json` no proporcionó ese último
campo en la configuración efímera usada. Por tanto, la ejecución #5 no demuestra ningún defecto de
Data API, PostgREST, PostgreSQL, las RPC o sus permisos.

R3A.1.5 elimina por completo la dependencia de `JWT_SECRET`: no busca material de firma, no fabrica
JWT HS256 y no usa `service_role`. El parser acepta sólo aliases explícitos y auditables para la URL
(`API_URL`, `api_url`, `SUPABASE_URL`) y para la clave pública (`ANON_KEY`, `anon_key`,
`PUBLISHABLE_KEY`, `publishable_key`). La URL debe seguir siendo local. Si la preparación falla, el
diagnóstico muestra únicamente los nombres saneados de las propiedades y los booleanos
`api_url_present`, `public_key_present` y `auth_service_reachable`, nunca valores.

El `config.toml` temporal habilita Data API y Auth local. Email/password está habilitado,
`enable_confirmations` está desactivado, la `site_url` es local, Inbucket permanece deshabilitado y
no se configura SMTP ni proveedor OAuth. El validador comprueba `/auth/v1/health`, crea un usuario
único `example.invalid` mediante `/auth/v1/signup` y, si signup no devuelve sesión, usa
`/auth/v1/token?grant_type=password`. La contraseña aleatoria y el `access_token` sólo existen en
memoria, se enmascaran antes de usarse y se limpian en `finally`; no se conserva el refresh token.
El usuario desaparece al destruir el stack.

Las cuatro llamadas anon siguen usando sólo `apikey` y exigen HTTP `401` con `code: "42501"`. Las
cuatro authenticated usan la misma clave pública y `Authorization: Bearer` con el token real emitido
por Auth local; exigen HTTP `403` con `code: "42501"`. Los recuentos de las cuatro tablas newsletter
y las comprobaciones de estabilidad PostgreSQL permanecen sin cambios. R3B continúa bloqueado hasta
obtener las ocho denegaciones correctas en una ejecución real.

## Tests pgTAP

Todos los archivos permanentes bajo `tests/newsletter/sql/`:

- Empiezan con `begin`.
- Crean o reutilizan pgTAP en el esquema de extensiones.
- Declaran un plan fijo.
- Llaman `finish()`.
- Terminan con `rollback`.
- Sólo usan direcciones reservadas `example.invalid`.
- No dependen de datos externos.

La CLI copia estos archivos a `supabase/tests/` y ejecuta:

```text
supabase --workdir .tmp/newsletter-supabase-ci test db --local
```

### Esquema

Comprueba las cinco tablas, columnas y tipos críticos, primary/foreign keys, uniques, checks,
triggers, índices, RLS, firmas exactas, tipos de retorno, `security definer`, `search_path` vacío y
ausencia de `EXECUTE` dinámico.

### RLS y grants

Los tests cambian a los roles reales `anon`, `authenticated` y `service_role`:

- Los roles cliente intentan seleccionar y mutar tablas; deben recibir SQLSTATE `42501`.
- El catálogo confirma con firmas `regprocedure` exactas que los roles cliente no pueden ejecutar
  ninguna RPC, y la Data API local verifica después las ocho denegaciones reales mediante HTTP.
- `service_role` debe leer las cinco tablas y ejecutar las RPC.
- Se verifican grants reales y contratos de retorno sin email, token raw, estado interno o eventos
  de consentimiento.

### Solicitud, confirmación y baja

Se validan solicitudes nuevas, normalización, pending, hash, consentimientos, cooldown, límite
diario, active sin duplicado, resuscripción, bloqueos e invalidación de tokens.

Confirmación cubre subscribe, resubscribe, expirado, usado, invalidado, propósito incorrecto,
inexistente y estados bloqueados. También comprueba la coherencia atómica entre activación, consumo
del token, preferencia y consentimiento confirmado.

Baja cubre active, pending, repetición idempotente, preferencia, invalidación, consentimiento y
preservación de bounced, complained y suppressed.

### Eventos de proveedor

Se comprueban inserción, deduplicación, timestamps, fallos temporales, rebote permanente, queja,
supresión, estados bloqueados y eventos fuera de orden. Un evento cuyo agregado falla no debe quedar
marcado como procesado y un reintento posterior debe poder insertarlo.

Los estados de bloqueo siguen la precedencia monotónica `bounced < complained < suppressed`. Un
evento fuera de orden no puede degradar un estado más restrictivo ni sustituir un timestamp agregado
más reciente.

Estas expectativas pueden descubrir defectos de la migración actual. No se modificará SQL hasta
tener un fallo reproducible del workflow y revisar su diagnóstico.

## Rollback real

`newsletter_rollback.test.sql` instala dentro de su transacción un trigger temporal controlado que
fuerza errores al final de solicitud, confirmación y baja. Demuestra que PostgreSQL revierte:

- Suscriptor, hash y consentimiento parcial de una solicitud.
- Activación, consumo, preferencia y consentimiento de una confirmación.
- Estado, preferencia, invalidación y consentimiento de una baja.
- Inserción del evento cuando falla la actualización agregada.

El trigger y todos los datos desaparecen con el rollback del test.

## Concurrencia real

`newsletter-concurrency.mjs` usa únicamente módulos Node y el `psql` incluido en el contenedor
PostgreSQL. Cada `docker exec ... psql` abre una sesión independiente. No obtiene ni imprime claves.

Con `Promise.allSettled`, timeouts y datos `example.invalid` únicos, comprueba:

- Dos solicitudes simultáneas crean un subscriber y un hash.
- Dos confirmaciones del mismo hash producen una confirmación y un token usado.
- Dos eventos con la misma identidad producen un registro y un duplicado.
- Dos bajas simultáneas terminan de forma idempotente.

El script limpia sus filas al terminar; todo el contenedor se destruye después de todos modos.

## DB lint y tipos

El workflow ejecuta:

```text
supabase --workdir .tmp/newsletter-supabase-ci db lint --local --schema public --level error --fail-on error
```

Los errores PL/pgSQL son bloqueantes. Los warnings no se elevan en este checkpoint.

La generación informativa de tipos queda pospuesta: los tipos productivos siguen siendo manuales y
R3A.1 no debe sobrescribirlos. Una futura comprobación podrá ejecutar `gen types --local` y filtrar
exclusivamente las cinco tablas y cuatro RPC si la salida resulta estable con la versión fijada.

## Diagnóstico y limpieza

Ante fallo, el workflow localiza por nombre exacto únicamente el contenedor PostgreSQL del project ID
efímero. Un `docker inspect --format` limitado muestra nombre, estado, código de salida, `OOMKilled` y
health status. Después imprime como máximo las últimas 300 líneas con timestamps mediante
`docker logs`; no muestra variables del contenedor, `supabase status`, claves, credenciales o dumps y
no sube artifacts.

El paso final se ejecuta siempre:

```text
supabase --workdir .tmp/newsletter-supabase-ci stop --no-backup
node scripts/prepare-newsletter-supabase-ci.mjs --clean
```

## Qué no toca

- Supabase remoto o producción.
- `.env.local` o secretos.
- R1, R2 o R3A salvo los filtros de CI que vigilan sus contratos.
- Eventos, lotes, enrichment, importadores, SEO, imágenes o marca.
- Resend, DNS, Vercel, endpoints, formularios o emails.

## Bloqueo de R3B

R3B permanece bloqueado hasta que una ejecución del workflow sobre este commit o su PR demuestre:

1. Aplicación limpia de la migración.
2. Todas las suites pgTAP en verde.
3. Concurrencia real en verde.
4. DB lint sin errores.
5. Las cuatro llamadas anon denegadas con HTTP `401` y SQLSTATE `42501`, y las cuatro authenticated
   denegadas con HTTP `403` y SQLSTATE `42501`, sin 5xx, recovery ni efectos laterales.
6. Revisión y corrección aislada de cualquier defecto SQL reproducible.

## Propuesta de commit

```text
test(newsletter): use local Auth for RPC permission validation
```
