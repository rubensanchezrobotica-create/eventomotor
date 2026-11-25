// Local-only QA for draft HTML. Does not fetch production data or send mail.
const { chromium } = require(process.env.ED17_PLAYWRIGHT_CORE || "playwright-core");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const chrome = process.env.ED17_CHROME_EXE || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const cases = [
  { variant: "national", device: "desktop", width: 1280, height: 900 },
  { variant: "national", device: "mobile-390", width: 390, height: 844 },
  { variant: "madrid", device: "desktop", width: 1280, height: 900 },
  { variant: "madrid", device: "mobile-390", width: 390, height: 844 },
];

async function main() {
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    for (const item of cases) {
      const page = await browser.newPage({
        viewport: { width: item.width, height: item.height },
        deviceScaleFactor: 1,
      });
      try {
        const source = path.resolve(root, `preview-${item.variant}-draft.html`);
        await page.goto(pathToFileURL(source).href, { waitUntil: "load" });
        const result = await page.evaluate(() => {
          const logo = document.querySelector('img[src="assets/eventomotor-logo.png"]');
          const links = [...document.querySelectorAll("a")];
          return {
            viewport: window.innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            logoLoaded: Boolean(logo && logo.complete && logo.naturalWidth > 0),
            plannedSlots: document.querySelectorAll("[data-planned-asset]").length,
            links: links.length,
            badLinks: links.filter((link) => !link.href.startsWith("https://www.eventomotor.com/")).length,
            ctaVisible: links.filter((link) => link.getBoundingClientRect().width > 0).length,
            footerVisible: document.body.innerText.includes("Darme de baja"),
            madridModuleCount: (document.body.innerText.match(/Lo próximo cerca de ti/gi) || []).length,
          };
        });
        const name = `${item.variant}-${item.device}.png`;
        await page.screenshot({ path: path.join(__dirname, name), fullPage: true });
        console.log(JSON.stringify({ screenshot: name, ...result }));
        if (result.scrollWidth > result.viewport || !result.logoLoaded || result.badLinks ||
            !result.footerVisible || result.ctaVisible !== result.links ||
            result.madridModuleCount !== (item.variant === "madrid" ? 1 : 0)) {
          throw new Error(`visual_qa_gate_failed:${name}`);
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "visual_qa_failed");
  process.exitCode = 1;
});
