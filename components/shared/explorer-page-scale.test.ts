import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const scaleSource = readFileSync(
  new URL("./ExplorerPageScale.module.css", import.meta.url),
  "utf8",
);
const zonePageSource = readFileSync(
  new URL("../zones/ZonePreviewPage.tsx", import.meta.url),
  "utf8",
);
const disciplinePageSource = readFileSync(
  new URL("../disciplines/DisciplinePreviewPage.tsx", import.meta.url),
  "utf8",
);
const disciplineCardSource = readFileSync(
  new URL("../disciplines/DisciplineEventCard.tsx", import.meta.url),
  "utf8",
);

test("define una única escala funcional para zonas y disciplinas", () => {
  for (const token of [
    "--em-hero-title",
    "--em-hero-description",
    "--em-filter-title",
    "--em-list-title",
    "--em-explore-title",
    "--em-subsection-title",
    "--em-cta-title",
    "--em-seo-title",
    "--em-section-gap",
    "--em-hero-padding-top",
    "--em-hero-padding-bottom",
  ]) {
    assert.match(scaleSource, new RegExp(token));
  }
  assert.match(zonePageSource, /scaleStyles\.explorerScale/);
  assert.match(disciplinePageSource, /scaleStyles\.explorerScale/);
});

test("las tarjetas de disciplina muestran como máximo modalidad y vehículo", () => {
  assert.match(disciplineCardSource, /showMultiDayMeta=\{false\}/);
  assert.match(disciplineCardSource, /showStatus=\{false\}/);
  assert.doesNotMatch(disciplineCardSource, /Varios días/);
});
