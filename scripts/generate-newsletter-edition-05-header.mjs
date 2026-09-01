import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const WIDTH = 1240;
const HEIGHT = 200;
const BACKGROUND = { r: 5, g: 6, b: 8, alpha: 1 };
const HEADER_TEXT = "LA AGENDA MOTOR · EDICIÓN 05 · 4–6 SEPTIEMBRE 2026";
const ROOT = process.cwd();
const REFERENCE_LOGO_PATH = resolve(
  ROOT,
  "public/newsletter/2026-09-03/assets/eventomotor-logo.png",
);
const OUTPUT_PATHS = [
  resolve(
    ROOT,
    "public/newsletter/2026-09-03/assets/eventomotor-header.png",
  ),
  resolve(
    ROOT,
    "docs/newsletter/ediciones/2026-09-03/assets/eventomotor-header.png",
  ),
];

const textLayer = Buffer.from(`
  <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <text
      x="620"
      y="159"
      text-anchor="middle"
      fill="#cbd0d8"
      font-family="Arial, Helvetica, sans-serif"
      font-size="22"
      font-weight="700"
      letter-spacing="3"
    >${HEADER_TEXT}</text>
  </svg>
`);

const logo = await readFile(REFERENCE_LOGO_PATH);
const header = await sharp({
  create: {
    width: WIDTH,
    height: HEIGHT,
    channels: 4,
    background: BACKGROUND,
  },
})
  .composite([
    { input: logo, left: 360, top: 38 },
    { input: textLayer, left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();

await Promise.all(OUTPUT_PATHS.map((path) => writeFile(path, header)));

console.log(
  JSON.stringify({
    files: OUTPUT_PATHS.map((path) => path.slice(ROOT.length + 1)),
    width: WIDTH,
    height: HEIGHT,
    bytes: header.byteLength,
    sha256: createHash("sha256").update(header).digest("hex"),
  }),
);
