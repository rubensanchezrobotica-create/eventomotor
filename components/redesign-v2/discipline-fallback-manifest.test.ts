import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";
import {
  V2_DISCIPLINE_FALLBACKS,
  type FallbackDiscipline,
} from "./discipline-fallback-manifest";

const EXPECTED_DISTRIBUTION: Record<FallbackDiscipline, number> = {
  rallyes: 11,
  circuito: 19,
  concentraciones: 11,
  offroad: 19,
  clasicos: 9,
  karting: 7,
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

test("el manifiesto contiene exactamente los 87 fallbacks aprobados", () => {
  assert.equal(V2_DISCIPLINE_FALLBACKS.length, 87);
  assert.equal(new Set(V2_DISCIPLINE_FALLBACKS.map(({ id }) => id)).size, 87);
  assert.equal(new Set(V2_DISCIPLINE_FALLBACKS.map(({ src }) => src)).size, 87);
  assert.equal(V2_DISCIPLINE_FALLBACKS.some(({ discipline }) => String(discipline) === "motos"), false);

  const distribution = Object.fromEntries(
    Object.keys(EXPECTED_DISTRIBUTION).map((discipline) => [
      discipline,
      V2_DISCIPLINE_FALLBACKS.filter((image) => image.discipline === discipline).length,
    ]),
  );
  assert.deepEqual(distribution, EXPECTED_DISTRIBUTION);
});

test("A6.8.4A registra los dos fallbacks genéricos de Karting con sus metadatos técnicos", async () => {
  const expected = new Map([
    ["karting-06", {
      src: "/images/disciplines/fallbacks/karting/karting-06-carrera-outdoor-grupo-compacto-curva-accion-lateral.webp",
      tags: ["karting", "carrera", "outdoor", "grupo", "curva"],
    }],
    ["karting-07", {
      src: "/images/disciplines/fallbacks/karting/karting-07-carrera-outdoor-frenada-entrada-curva-grupo-precision.webp",
      tags: ["karting", "carrera", "outdoor", "grupo", "frenada", "curva"],
    }],
  ] as const);

  for (const [id, contract] of expected) {
    const image = V2_DISCIPLINE_FALLBACKS.find((candidate) => candidate.id === id);
    assert.ok(image);
    assert.equal(image.discipline, "karting");
    assert.equal(image.vehicle, "karting");
    assert.equal(image.src, contract.src);
    assert.deepEqual(image.tags, contract.tags);
    const file = new URL(`../../public${contract.src}`, import.meta.url);
    const metadata = await sharp(readFileSync(file)).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 800);
    assert.equal(metadata.space, "srgb");
    assert.equal(metadata.channels, 3);
    assert.equal(metadata.pages ?? 1, 1);
    assert.equal(metadata.hasAlpha, false);
  }
});

test("Karting 01 a 05 permanecen congelados byte por byte", () => {
  const expectedHashes = new Map([
    ["karting-01", "f9bed318c32f858d98d2abf399da0e3868ccec2e16537389d6aa549ddbd32a53"],
    ["karting-02", "f19fc5f3520a526c471d89eea05746c3a486387fe53c0965a418c1de3e9cab50"],
    ["karting-03", "40d891ff48759879ec2fb75afd9e6e30c1756976b95bb9131b51fd5533085a26"],
    ["karting-04", "6bf0e99c789b733b13fb3e6613ecb55d64d18b5e715c9c917e83103f4732de38"],
    ["karting-05", "f07c90b829523d0254869b6ef35a4ad65feaa9000bd19bac6772a2a279f93d44"],
  ]);

  for (const [id, expectedHash] of expectedHashes) {
    const image = V2_DISCIPLINE_FALLBACKS.find((candidate) => candidate.id === id);
    assert.ok(image);
    const file = new URL(`../../public${image.src}`, import.meta.url);
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), expectedHash, id);
  }
});

test("los cuatro nuevos fallbacks de Clásicos conservan contratos y metadatos técnicos aprobados", async () => {
  const expected = new Map([
    ["clasicos-06", {
      vehicle: "mixto",
      src: "/images/disciplines/fallbacks/clasicos/clasicos-06-concentracion-mixta-coches-y-motos-clasicos-encuentro-exterior.webp",
      tags: ["clasicos", "mixto", "coche", "moto", "concentracion"],
    }],
    ["clasicos-07", {
      vehicle: "moto",
      src: "/images/disciplines/fallbacks/clasicos/clasicos-07-motos-clasicas-velocidad-asfalto-circuito-dinamico.webp",
      tags: ["clasicos", "moto", "velocidad", "resistencia", "asfalto", "circuito"],
    }],
    ["clasicos-08", {
      vehicle: "moto",
      src: "/images/disciplines/fallbacks/clasicos/clasicos-08-motos-clasicas-todo-terreno-competicion-bosque.webp",
      tags: ["clasicos", "moto", "todo-terreno-clasico", "offroad", "competicion"],
    }],
    ["clasicos-09", {
      vehicle: "mixto",
      src: "/images/disciplines/fallbacks/clasicos/clasicos-09-evento-mixto-llegada-club-coches-y-motos-clasicos-exterior.webp",
      tags: ["clasicos", "mixto", "coche", "moto", "evento", "llegada", "club", "exterior"],
    }],
  ] as const);

  for (const [id, contract] of expected) {
    const image = V2_DISCIPLINE_FALLBACKS.find((candidate) => candidate.id === id);
    assert.ok(image);
    assert.equal(image.discipline, "clasicos");
    assert.equal(image.vehicle, contract.vehicle);
    assert.equal(image.src, contract.src);
    assert.deepEqual(image.tags, contract.tags);
    const file = new URL(`../../public${contract.src}`, import.meta.url);
    const metadata = await sharp(readFileSync(file)).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 800);
    assert.equal(metadata.space, "srgb");
    assert.equal(metadata.channels, 3);
    assert.equal(metadata.pages ?? 1, 1);
    assert.equal(metadata.hasAlpha, false);
  }
});

test("Clásicos 01 a 05 permanecen congelados byte por byte", () => {
  const expectedHashes = new Map([
    ["clasicos-01", "e328f1b3c6b06bf71823f06171ea7621bf3608103801637bab80c4715f503272"],
    ["clasicos-02", "9a54cfc7bef80b44042cf5b8dfab08f1ad11e46f61d44f74e345e5be6dd7cb1d"],
    ["clasicos-03", "485b33d2a123c84fe317af1bff76cb9ec5f4cfa1665e86a641790a3d4e7592db"],
    ["clasicos-04", "cee2e1053ff96d0ccd1e3da50b7239664b41497b8f48d616c4bbf834d48e2bdd"],
    ["clasicos-05", "aa49ce16767be89210e0ad683141df500a6b2860958611f273e50ba83278a732"],
  ]);

  for (const [id, expectedHash] of expectedHashes) {
    const image = V2_DISCIPLINE_FALLBACKS.find((candidate) => candidate.id === id);
    assert.ok(image);
    const file = new URL(`../../public${image.src}`, import.meta.url);
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), expectedHash, id);
  }
});

test("los dos nuevos fallbacks especializados de Offroad conservan rutas y metadatos técnicos aprobados", async () => {
  const expected = new Map([
    ["offroad-18", {
      src: "/images/disciplines/fallbacks/offroad/offroad-18-resistencia-tierra-motos-grupo-circuito-natural-polvo.webp",
      tags: ["offroad", "moto", "resistencia-tierra", "resistencia", "grupo", "circuito-natural", "polvo"],
    }],
    ["offroad-19", {
      src: "/images/disciplines/fallbacks/offroad/offroad-19-trial-natural-bosque-humedo-obstaculo-tecnico.webp",
      tags: ["offroad", "moto", "trial", "natural", "bosque", "humedo", "obstaculo-tecnico"],
    }],
  ] as const);

  for (const [id, contract] of expected) {
    const image = V2_DISCIPLINE_FALLBACKS.find((candidate) => candidate.id === id);
    assert.ok(image);
    assert.equal(image.src, contract.src);
    assert.equal(image.discipline, "offroad");
    assert.equal(image.vehicle, "moto");
    assert.deepEqual(image.tags, contract.tags);
    const file = new URL(`../../public${contract.src}`, import.meta.url);
    const metadata = await sharp(readFileSync(file)).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 800);
    assert.equal(metadata.space, "srgb");
    assert.equal(metadata.channels, 3);
    assert.equal(metadata.pages ?? 1, 1);
    assert.equal(metadata.hasAlpha, false);
  }
});

test("Offroad 01 a 17 conservan byte por byte el banco aprobado", () => {
  const expectedHashes = new Map([
    ["offroad-01", "4db6387a2130a2e1c39d15df9f248c336f76eaefd0c88e7a0b9348f827900ea5"],
    ["offroad-02", "5a4a201528690c289b0a943d61d7df2a55f12c79277f96c923c71ec72d15f5b7"],
    ["offroad-03", "2bd170b8b9d8fa0562dfd5b7ef65d97f776f6118bc1252193843dbf7906c580e"],
    ["offroad-04", "42f3d3c2f36efc5d358039212a3edf71f658823a234b2e3c33f6c13ecd6062f5"],
    ["offroad-05", "0d57e160f40c9a8a56271772e95516b1b2402682770b3d32d44545bc5331a760"],
    ["offroad-06", "672bd015829f48ea59c7adc4d2d413240c5dbbf83e0c72f5a68f679306622784"],
    ["offroad-07", "bfd7d2e32de63c606acf834c2338486886cc02d210e2ee9672e77b548eba90aa"],
    ["offroad-08", "7f3e7cade8d8dbff085b614b6824fac0bd4ec09ab74a55a38a7fe95d3e056587"],
    ["offroad-09", "635041581d2861f7156a064fc2355b2248a4b8bc2fb319faa248fce2c00f027e"],
    ["offroad-10", "8554924810bcc9a7a2829fcff03ebdc1dfb4eb4f780b2318b57b7bd24da31e59"],
    ["offroad-11", "329e42e416f12cdc1fb4cbbd62999082ce8b295c5fd6695a1cf366f7ea870946"],
    ["offroad-12", "26b8b80ee38fc7e236aa260593785f018af282b3111986346093fe834a1ad7fe"],
    ["offroad-13", "89398eebc5ddc1b2c622781664bf620ae802aa104707ddb7e799b16367ee4153"],
    ["offroad-14", "dfefe358c097e93561bc78c3d218fa6575d4fd032cededf7391f2d268fa187c0"],
    ["offroad-15", "305d8a43b5db070ea2ea29ff5ae98340ba54f50476c6560c023b5f9ff602ad74"],
    ["offroad-16", "1e476484905ff0959384f5f230a1563f01532a18aefc0ded1d95e29803ce78a1"],
    ["offroad-17", "f0f56dc495a3f0efc8b418502d0eb0172b989460f6e9573730bfdc4f89116b55"],
  ]);

  for (const [id, expectedHash] of expectedHashes) {
    const image = V2_DISCIPLINE_FALLBACKS.find((candidate) => candidate.id === id);
    assert.ok(image);
    const file = new URL(`../../public${image.src}`, import.meta.url);
    assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), expectedHash, id);
  }
});

test("los dos nuevos fallbacks genéricos de Concentraciones conservan rutas y metadatos técnicos aprobados", async () => {
  const expected = new Map([
    ["concentraciones-10", "/images/disciplines/fallbacks/concentraciones/concentraciones-10-concentracion-motera-pequena-rural-plaza-pueblo.webp"],
    ["concentraciones-11", "/images/disciplines/fallbacks/concentraciones/concentraciones-11-encuentro-urbano-club-motero-llegada-aparcamiento.webp"],
  ]);

  for (const [id, src] of expected) {
    const image = V2_DISCIPLINE_FALLBACKS.find((candidate) => candidate.id === id);
    assert.ok(image);
    assert.equal(image.src, src);
    assert.equal(image.discipline, "concentraciones");
    assert.equal(image.vehicle, "moto");
    assert.deepEqual(image.tags, ["concentracion", "moto"]);
    const file = new URL(`../../public${src}`, import.meta.url);
    const metadata = await sharp(readFileSync(file)).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 800);
    assert.equal(metadata.space, "srgb");
    assert.equal(metadata.channels, 3);
    assert.equal(metadata.pages ?? 1, 1);
    assert.equal(metadata.hasAlpha, false);
  }
});

test("los seis nuevos fallbacks de Circuito conservan rutas y metadatos técnicos aprobados", async () => {
  const expected = new Map([
    ["circuito-14", "/images/disciplines/fallbacks/circuito/circuito-14-drift-curva-circuito-humo-controlado.webp"],
    ["circuito-15", "/images/disciplines/fallbacks/circuito/circuito-15-competicion-coches-resistencia-atardecer.webp"],
    ["circuito-16", "/images/disciplines/fallbacks/circuito/circuito-16-trackday-coches-amateur-pit-lane-instructor.webp"],
    ["circuito-17", "/images/disciplines/fallbacks/circuito/circuito-17-competicion-motos-grupo-parrilla-curva.webp"],
    ["circuito-18", "/images/disciplines/fallbacks/circuito/circuito-18-resistencia-motos-atardecer-faros.webp"],
    ["circuito-19", "/images/disciplines/fallbacks/circuito/circuito-19-gt-turismos-carrera-grupo-curva.webp"],
  ]);

  for (const [id, src] of expected) {
    const image = V2_DISCIPLINE_FALLBACKS.find((candidate) => candidate.id === id);
    assert.ok(image);
    assert.equal(image.src, src);
    const file = new URL(`../../public${src}`, import.meta.url);
    const metadata = await sharp(readFileSync(file)).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 800);
    assert.equal(metadata.space, "srgb");
    assert.equal(metadata.channels, 3);
    assert.equal(metadata.pages ?? 1, 1);
    assert.equal(metadata.hasAlpha, false);
  }
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
  assert.deepEqual(byId.get("rallyes-06")?.tags, ["rally", "subida", "montana", "hillclimb", "asfalto", "seco", "mediterraneo", "horquilla"]);
  assert.deepEqual(byId.get("rallyes-07")?.tags, ["rally", "subida", "montana", "hillclimb", "asfalto", "humedo", "atlantico", "ascenso"]);
  assert.deepEqual(byId.get("rallyes-08")?.tags, ["rally", "subida", "montana", "hillclimb", "asfalto", "tramo-rapido", "roca", "ascenso"]);
  assert.deepEqual(byId.get("rallyes-09")?.tags, ["rally", "asfalto", "mojado", "bosque", "tramo-rapido", "accion-trasera"]);
  assert.deepEqual(byId.get("rallyes-10")?.tags, ["rally", "asfalto", "seco", "paisaje-abierto", "tramo-rapido", "lateral"]);
  assert.deepEqual(byId.get("rallyes-11")?.tags, ["rally", "rallysprint", "asfalto", "tramo-corto", "curva", "accion-proxima"]);
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
  assert.deepEqual(byId.get("circuito-13")?.tags, ["pitbike", "pit-bike", "minivelocidad", "kartodromo", "horquilla", "frenada", "accion-proxima"]);
  assert.deepEqual(byId.get("circuito-14")?.tags, ["circuito", "coche", "drift"]);
  assert.deepEqual(byId.get("circuito-15")?.tags, ["circuito", "coche", "resistencia", "endurance"]);
  assert.deepEqual(byId.get("circuito-16")?.tags, ["circuito", "coche", "trackday", "tandas", "rodada", "rodadas", "curso-de-conduccion", "experiencia-de-conduccion", "entrenamiento-amateur"]);
  assert.deepEqual(byId.get("circuito-17")?.tags, ["circuito", "moto", "motogp", "juniorgp", "superbike", "worldsbk", "esbk", "velocidad", "competicion"]);
  assert.deepEqual(byId.get("circuito-18")?.tags, ["circuito", "moto", "resistencia", "endurance"]);
  assert.deepEqual(byId.get("circuito-19")?.tags, ["circuito", "coche", "gt", "turismos"]);
  assert.deepEqual(byId.get("concentraciones-09")?.tags, ["motoalmuerzo", "almuerzo-motero", "matinal", "zona-rural", "encuentro-matinal", "motos", "social"]);
  assert.deepEqual(byId.get("offroad-16")?.tags, ["cross-country", "crosscountry", "xc", "terreno-verde", "dos-motos", "pista-rapida", "resistencia", "campo-abierto"]);
  assert.deepEqual(byId.get("offroad-17")?.tags, ["enduro", "enduro-indoor", "superenduro", "indoor", "neumaticos", "escalones", "obstaculos", "recinto-luminoso"]);
});
