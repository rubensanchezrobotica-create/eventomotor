# Ed17 · QA local con ocho assets aprobados

Capturas locales de Chrome headless con Playwright Core; no se ha enviado correo ni consultado la audiencia. Las seis imágenes editoriales son las aprobadas en el ZIP Ed17, y el header/logo reutilizan la identidad oficial de Ed16. No hay assets públicos ni sello operativo Ed17.

| Variante | Escritorio 1280 px | Móvil 390 px |
| --- | --- | --- |
| Nacional | `national-desktop.png` | `national-mobile-390.png` |
| Madrid | `madrid-desktop.png` | `madrid-mobile-390.png` |

Resultado automatizado: `scrollWidth = viewportWidth` en los cuatro casos; 6/6 imágenes cargadas en nacional, 7/7 en Madrid, sin deformación; CTA y enlaces visibles; footer y baja presentes; módulo regional ausente en nacional y presente una vez en Madrid. Revisión visual de las cuatro capturas: sin desbordamientos, recortes materiales, problemas de contraste ni botones fuera del contenedor. La aprobación humana definitiva de las previews con imágenes reales sigue pendiente.

Parámetros UTM contrastados con el HTML canónico real de Ed16: `utm_source=la_agenda_motor`, `utm_medium=email`, `utm_campaign=agenda_motor_2026_11_26`; `utm_content` identifica cada CTA. El enlace de baja del borrador contiene únicamente un token sintético de fixture.

Para reproducir las capturas con Playwright Core instalado localmente, ejecutar `capture-previews.cjs` desde Node. Si el paquete o Chrome no están en sus rutas por defecto, proporcionar `ED17_PLAYWRIGHT_CORE` y `ED17_CHROME_EXE` en el entorno del proceso. El script no usa credenciales ni llama a APIs de campaña.
