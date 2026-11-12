# Operador local de La Agenda Motor

Este operador reutiliza los módulos y runners **sellados de cada edición**. No reemplaza sus RPC, hashes, ni mecanismos de consentimiento, claim o reconciliación. No programa envíos ni ejecuta acciones reales por sí solo.

## Estructura y límites

- Código: `scripts/newsletter-operator/{operator.ps1,cli.mjs,edition-bridge.cjs,core.mjs}`.
- Cada ejecución apunta al worktree `eventomotor-newsletter-edition-NN` (o `-Worktree` explícito). El worktree operador puede estar en otra rama; no modifica el checkout principal ni Ed15.
- El puente carga el contenido canónico y valida manifiesto, bytes locales, hashes HTML/texto de ambas variantes y opacidad local del header usando la implementación de la edición. Exige la misma convención de exports/CLI de Ed14/Ed15. Si Ed16 cambia esa interfaz, falla cerrado hasta adaptar el puente y probarlo; no inventa argumentos.
- `preview` vuelve a GET de assets públicos (200, MIME, SHA256, sin redirects) y enlaces UTM, y llama a la RPC de preview read-only. `status` hace solo el preview de campaña. `audit` usa la RPC de auditoría. `report` combina ambas.
- `test` exige que la campaña aún no exista e invoca exactamente una vez el sender protegido de esa edición, destinatario fijo y confirmación propia de ella. Por ello también requiere conexión Supabase. `prepare` invoca exactamente una vez el runner `--prepare-only` tras un preview actualizado. `send` invoca exactamente una vez `--send-prepared` tras auditar el snapshot preparado. Ante error o respuesta incierta, solo hace auditoría read-only: **nunca reintenta**.
- El runner de edición sigue imponiendo `allowRetry:false`, snapshot exacto, límite 500 y ausencia de segundo prepare. El operador añade aprobación separada, verificación pública, un lock local por campaña contra dos procesos simultáneos y reconciliación final 100% accepted. Un resultado parcial se reporta como bloqueo con la auditoría agregada disponible, no como éxito.

## Configuración única en una consola local de Windows

Desde una PowerShell de la cuenta Windows que realizará las operaciones:

```powershell
$op = 'C:\Users\rsanchez\proyectos\eventomotor-newsletter-operator\scripts\newsletter-operator\operator.ps1'
pwsh -NoProfile -File $op -Action setup
pwsh -NoProfile -File $op -Action credential-status
```

`setup` pide mediante `Read-Host -AsSecureString` la URL de Supabase, su clave `service_role` y la API key de Resend. Guarda únicamente cadenas cifradas con DPAPI del usuario Windows actual en `%USERPROFILE%\AppData\Local\EventoMotor\NewsletterOperator\credentials.json`, fuera del repositorio, con ACL restringida al usuario y SYSTEM. No sobrescribe un almacén existente. No se piden claves en Codex ni se incluyen en argumentos, commits, logs o archivos `.env`. El launcher descifra solo las variables que necesita la acción, las pasa al proceso hijo y las borra en `finally`.

El almacén **no protege contra código que ya se ejecute con la misma cuenta y acceso al mismo DPAPI**. Codex tampoco debe considerarse automáticamente aislado: si su proceso puede abrir el almacén, podría leerlo. Por eso debe usarse solo en un equipo y una sesión de confianza, con código revisado y sin plugins/runners no confiables. El estado actual de acceso se verifica con `credential-status`, sin mostrar valores. Si el sandbox de Codex no puede abrir o descifrar el almacén, la misma orden breve se ejecuta en la PowerShell local del usuario; no se copian grandes scripts ni se reintroducen credenciales semanalmente.

Un proceso de `test`, `prepare` o `send` mantiene un archivo de bloqueo vacío en el directorio del almacén DPAPI durante la operación. Si termina con error o de forma abrupta, el `.lock` **permanece**. No repetir: consultar primero `status`/`audit` y retirar el lock solo tras comprobar que no hay otro proceso en marcha y resolver el estado con revisión humana.

## Uso semanal

```powershell
$op = 'C:\Users\rsanchez\proyectos\eventomotor-newsletter-operator\scripts\newsletter-operator\operator.ps1'
pwsh -NoProfile -File $op -Action status  -Edition 16 -Date 2026-11-19
pwsh -NoProfile -File $op -Action preview -Edition 16 -Date 2026-11-19
pwsh -NoProfile -File $op -Action audit   -Edition 16 -Date 2026-11-19
pwsh -NoProfile -File $op -Action report  -Edition 16 -Date 2026-11-19
```

Las acciones con efectos requieren **autorización humana expresa en esa edición y fase**. Codex no debe deducirla de una petición de revisión o de autorizaciones previas. Además, el operador exige el valor `-Approval` específico:

- `test`: `TEST:<campaignKey>`.
- `prepare`: `PREPARE:<campaignKey>:<contentManifestDigest>`.
- `send`: `SEND:<campaignKey>:<campaignId>:<deliveryCount>`, obtenido de la auditoría congelada actual.

Ejemplo **de forma, no autorización para ejecutarlo**:

```powershell
pwsh -NoProfile -File $op -Action prepare -Edition 16 -Date 2026-11-19 -Approval 'PREPARE:agenda_motor_2026_11_19:<digest-sellado>'
```

El test protegido usa `-Variant madrid` por defecto; la edición puede rechazar otra variante. `-Worktree` permite indicar un worktree sellado distinto de la ruta hermana por defecto. No se pasa `-Approval` en `status`, `preview`, `audit` o `report`.

## Condiciones antes de usar Ed16

1. Ed16 debe estar sellada, revisada humanamente y con su worktree de implementación disponible. La migración/RPC de Ed16 debe instalarse y verificarse por el procedimiento autorizado independiente.
2. Los assets deben estar desplegados; `preview` y `prepare` verifican sus bytes públicos. El test Gmail protegido de Ed16 y los runners de preview, prepare, audit y send-prepared deben seguir el contrato de Ed15 y tener sus pruebas propias.
3. Ejecutar `credential-status` en la sesión que operará, luego `status` y `preview`. No declarar acceso real por una revisión estática.
4. Solicitar aprobación independiente antes de `prepare` y otra antes de `send`. Tras `prepare`, comprobar `audit`; tras `send`, comprobar `report`. Si el resultado es incierto, detenerse y auditar, nunca repetir.

El operador no necesita que Codex vea las claves. Si Codex tiene acceso al almacén y a la red, puede ejecutar la orden corta; si no, el usuario ejecuta la misma orden en su sesión local. No hay envío periódico autónomo.
