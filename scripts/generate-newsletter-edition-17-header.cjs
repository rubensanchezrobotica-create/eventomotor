/* eslint-disable @typescript-eslint/no-require-imports -- Header generator uses the existing local Sharp installation. */
const { createHash } = require("node:crypto");
const { readFile, writeFile } = require("node:fs/promises");
const { resolve } = require("node:path");
const sharp = require("sharp");

const root = process.cwd();
const width = 1240;
const height = 200;
const background = { r: 5, g: 6, b: 8, alpha: 1 };
const referencePath = resolve(root, "../eventomotor-newsletter-edition-16/docs/newsletter/ediciones/2026-11-19/assets/eventomotor-header.png");
const logoPath = resolve(root, "docs/newsletter/ediciones/2026-11-26/assets/eventomotor-logo.png");
const outputPath = resolve(root, "docs/newsletter/ediciones/2026-11-26/assets/eventomotor-header.png");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  const [reference, logo] = await Promise.all([readFile(referencePath), readFile(logoPath)]);
  if (sha256(reference) !== "da5b11ea89c3f5205817070619393a60a143886d8a2de8114e5d3e17bc9e84b1" ||
      sha256(logo) !== "d68c8763f1651d942736399bd19d81390b54a7df9e3460a4841c48b752d8ccbc") {
    throw new Error("Ed17 header: approved Ed16 reference or official logo changed");
  }
  const [referenceMeta, logoMeta] = await Promise.all([sharp(reference).metadata(), sharp(logo).metadata()]);
  if (referenceMeta.width !== width || referenceMeta.height !== height || logoMeta.width !== 520 || logoMeta.height !== 56) {
    throw new Error("Ed17 header: reference dimensions changed");
  }
  const text = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="620" y="159" text-anchor="middle" fill="#cbd0d8" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="3">LA AGENDA MOTOR · EDICIÓN 17 · 26 NOVIEMBRE 2026</text></svg>`);
  const output = await sharp({ create: { width, height, channels: 4, background } })
    .composite([{ input: logo, left: 360, top: 38 }, { input: text, left: 0, top: 0 }])
    .flatten({ background })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  if (output.length > 300_000) throw new Error("Ed17 header: asset size limit exceeded");
  await writeFile(outputPath, output, { flag: "wx" });
  console.log(JSON.stringify({ width, height, bytes: output.length, sha256: sha256(output) }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Ed17 header generation failed");
  process.exitCode = 1;
});
