import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  V2_DISCIPLINE_FALLBACKS,
  type FallbackDiscipline,
} from "./discipline-fallback-manifest";

const EXPECTED_DISTRIBUTION: Record<FallbackDiscipline, number> = {
  rallyes: 5,
  circuito: 12,
  concentraciones: 8,
  offroad: 15,
  clasicos: 5,
  karting: 5,
  rutas: 6,
  ferias: 5,
};

function webpDimensions(buffer: Buffer): { width: number; height: number } {
  assert.equal(buffer.toString("ascii", 0, 4), "RIFF");
  assert.equal(buffer.toString("ascii", 8, 12), "WEBP");

  for (let offset = 12; offset + 8 <= buffer.length;) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;

    if (type === "VP8X") {
      return {
        width: buffer.readUIntLE(data + 4, 3) + 1,
        height: buffer.readUIntLE(data + 7, 3) + 1,
      };
    }
    if (type === "VP8 ") {
      assert.deepEqual([...buffer.subarray(data + 3, data + 6)], [0x9d, 0x01, 0x2a]);
      return {
        width: buffer.readUInt16LE(data + 6) & 0x3fff,
        height: buffer.readUInt16LE(data + 8) & 0x3fff,
      };
    }
    if (type === "VP8L") {
      assert.equal(buffer[data], 0x2f);
      const bits = buffer.readUInt32LE(data + 1);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
    offset = data + size + (size % 2);
  }

  throw new Error("WebP sin chunk de imagen reconocido");
}

test("el manifiesto contiene exactamente los 61 fallbacks aprobados", () => {
  assert.equal(V2_DISCIPLINE_FALLBACKS.length, 61);
  assert.equal(new Set(V2_DISCIPLINE_FALLBACKS.map(({ id }) => id)).size, 61);
  assert.equal(new Set(V2_DISCIPLINE_FALLBACKS.map(({ src }) => src)).size, 61);
  assert.equal(V2_DISCIPLINE_FALLBACKS.some(({ discipline }) => String(discipline) === "motos"), false);

  const distribution = Object.fromEntries(
    Object.keys(EXPECTED_DISTRIBUTION).map((discipline) => [
      discipline,
      V2_DISCIPLINE_FALLBACKS.filter((image) => image.discipline === discipline).length,
    ]),
  );
  assert.deepEqual(distribution, EXPECTED_DISTRIBUTION);
});

test("todos los fallbacks tienen rutas ASCII estables y WebP reales de 1200 por 800", () => {
  for (const image of V2_DISCIPLINE_FALLBACKS) {
    assert.match(image.id, /^[a-z0-9]+-[0-9]{2}$/);
    assert.match(image.src, /^\/images\/disciplines\/fallbacks\/[a-z0-9]+\/[a-z0-9-]+\.webp$/);
    assert.equal(image.src.includes(" "), false);
    assert.equal(image.src, image.src.toLowerCase());
    assert.equal(image.src.includes(`/${image.discipline}/${image.id}-`), true);

    const file = new URL(`../../public${image.src}`, import.meta.url);
    assert.equal(existsSync(file), true, `Falta ${image.src}`);
    assert.deepEqual(webpDimensions(readFileSync(file)), { width: 1200, height: 800 });
  }
});

test("los tags distintivos aprobados permanecen en el manifiesto", () => {
  const byId = new Map(V2_DISCIPLINE_FALLBACKS.map((image) => [image.id, image]));
  assert.deepEqual(byId.get("offroad-03")?.tags, ["offroad", "motocross", "moto", "salto"]);
  assert.deepEqual(byId.get("offroad-02")?.tags, ["offroad", "enduro", "moto", "bosque"]);
  assert.deepEqual(byId.get("offroad-05")?.tags, ["offroad", "trial", "moto", "roca"]);
  assert.deepEqual(byId.get("circuito-03")?.tags, ["circuito", "coche", "trackday", "frenada"]);
  assert.deepEqual(byId.get("clasicos-05")?.tags, ["clasicos", "regularidad", "rally-historico"]);
  assert.deepEqual(byId.get("ferias-05")?.tags, ["ferias", "general", "coche", "moto", "pabellon"]);
  assert.deepEqual(byId.get("circuito-08")?.tags, ["circuito", "moto", "trackday", "tandas", "rodada", "rodadas", "amateur", "grupo", "motos"]);
  assert.deepEqual(byId.get("circuito-09")?.tags, ["circuito", "moto", "pitbike", "minivelocidad", "mini-velocidad", "drpit", "ciclomotores", "minibike", "kartodromo"]);
  assert.deepEqual(byId.get("circuito-10")?.tags, ["circuito", "moto", "supermotard", "supermoto", "minimotard", "trazado-mixto", "asfalto", "tierra"]);
  assert.deepEqual(byId.get("concentraciones-07")?.tags, ["motoalmuerzo", "almuerzo-motero", "matinal", "matinal-motera", "encuentro-matinal", "terraza", "local"]);
  assert.deepEqual(byId.get("offroad-08")?.tags, ["offroad", "moto", "enduro", "enduro-indoor", "superenduro", "obstaculos", "indoor"]);
  assert.deepEqual(byId.get("offroad-15")?.tags, ["offroad", "moto", "cross-country", "crosscountry", "xc", "rapido", "terreno-abierto", "resistencia"]);
});
