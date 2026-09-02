import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function run(name, viewport, fn) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message + "\n" + (e.stack || "")));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1200);
  await fn(page);
  await page.waitForTimeout(600);
  const crashed = await page.locator("text=Something went wrong").count();
  await page.screenshot({ path: `/workspace/screenshots/${name}.png` });
  console.log("===", name, "crashedUI", crashed, "errors", errors.length);
  for (const e of errors) console.log("---", e.slice(0, 800));
  await page.close();
}

await run("click-mobile-list", { width: 390, height: 844 }, async (page) => {
  await page.getByRole("button", { name: "List" }).click();
  await page.waitForTimeout(400);
  await page.locator("ul li button").nth(2).click();
});

await run("click-desktop-pin", { width: 1280, height: 800 }, async (page) => {
  const clicked = await page.evaluate(() => {
    const markers = document.querySelectorAll(".leaflet-marker-icon.leaflet-interactive");
    const vis = [...markers].find((el) => {
      const r = el.getBoundingClientRect();
      return r.width && r.height && r.top > 80 && r.left > 20 && r.left < 700 && r.top < 700;
    });
    if (!vis) return { n: markers.length, ok: false };
    vis.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return { n: markers.length, ok: true, title: vis.getAttribute("title") };
  });
  console.log("pin click", clicked);
});

await run("click-mobile-pin", { width: 390, height: 844 }, async (page) => {
  const clicked = await page.evaluate(() => {
    const markers = document.querySelectorAll(".leaflet-marker-icon.leaflet-interactive");
    const vis = [...markers].find((el) => {
      const r = el.getBoundingClientRect();
      return r.width && r.height && r.top > 60 && r.left >= 0 && r.left < 390 && r.top < 500;
    }) || markers[0];
    if (!vis) return { n: markers.length, ok: false };
    vis.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return { n: markers.length, ok: true, title: vis.getAttribute("title") };
  });
  console.log("mobile pin", clicked);
});

await browser.close();
