# Ed17 · QA de previews preliminares

Capturas locales de Chrome headless con Playwright Core; no se ha enviado correo ni consultado la audiencia. Las imágenes de eventos y el header definitivo aún son espacios marcados como pendientes. El logo PNG es el oficial reutilizado de Ed16.

| Variante | Escritorio 1280 px | Móvil 390 px |
| --- | --- | --- |
| Nacional | `national-desktop.png` | `national-mobile-390.png` |
| Madrid | `madrid-desktop.png` | `madrid-mobile-390.png` |

Resultado automatizado: `scrollWidth = viewportWidth` en los cuatro casos; logo cargado; CTA y enlaces visibles; footer y baja presentes; módulo regional ausente en nacional y presente una vez en Madrid. Revisión visual de las cuatro capturas: sin desbordamientos, recortes materiales ni botones fuera del contenedor. La aprobación humana de la preview completa sigue pendiente.

Parámetros UTM contrastados con el HTML canónico real de Ed16: `utm_source=la_agenda_motor`, `utm_medium=email`, `utm_campaign=agenda_motor_2026_11_26`; `utm_content` identifica cada CTA. El enlace de baja del borrador contiene únicamente un token sintético de fixture.

Para reproducir las capturas con Playwright Core instalado localmente, ejecutar `capture-previews.cjs` desde Node. Si el paquete o Chrome no están en sus rutas por defecto, proporcionar `ED17_PLAYWRIGHT_CORE` y `ED17_CHROME_EXE` en el entorno del proceso. El script no usa credenciales ni llama a APIs de campaña.
