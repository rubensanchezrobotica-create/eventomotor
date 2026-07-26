import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContactoPage, { metadata } from "@/app/contacto/page";
import { SITE_URL } from "@/lib/seo";

test("contacto presenta el correo, los CTA y los tres motivos sin formulario", () => {
  const markup = renderToStaticMarkup(createElement(ContactoPage));

  assert.match(markup, /info@eventomotor\.com/);
  assert.match(markup, /href="mailto:info@eventomotor\.com\?subject=Contacto%20EventoMotor"/);
  assert.match(markup, /href="\/publicar-evento"/);
  assert.match(markup, /href="\/#calendario"/);
  assert.match(markup, /Corregir un evento/);
  assert.match(markup, /Publicar un evento/);
  assert.match(markup, /Colaboraciones/);
  assert.doesNotMatch(markup, /<form/);
  assert.doesNotMatch(markup, /\/preview\//);
});

test("contacto mantiene metadata clara y canonical público", () => {
  assert.equal(metadata.title, "Contacto y publicación de eventos");
  assert.match(String(metadata.description), /corregir o publicar eventos de motor/);
  assert.equal(metadata.alternates?.canonical, `${SITE_URL}/contacto`);
});
