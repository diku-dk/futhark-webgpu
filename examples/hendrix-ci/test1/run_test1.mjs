import { chromium } from "playwright";
import { spawn } from "child_process";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node run_test1.mjs <compiled-output-dir>");
  process.exit(2);
}

function startServer() {
  return new Promise((resolve, reject) => {
    const p = spawn("node", [path.join(__dirname, "serve_test1.mjs"), dir], {
      stdio: ["ignore", "pipe", "inherit"],
    });

    p.stdout.on("data", (buf) => {
      const s = buf.toString();
      const m = s.match(/URL=(http:\/\/127\.0\.0\.1:\d+\/)\s*/);
      if (m) resolve({ proc: p, url: m[1] });
    });

    p.on("exit", (code) => reject(new Error("server exited " + code)));
  });
}

const { proc, url } = await startServer();

const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--headless=new",
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan,WebGPU",
    "--ignore-gpu-blocklist",
    "--use-angle=vulkan",
  ],
});

const page = await browser.newPage();

let ok = false;
page.on("console", (msg) => {
  const t = msg.text();
  if (t.includes("FUTHARK_WEBGPU_TEST1_OK")) ok = true;
  // Print browser console logs with type + location if available
  const loc = msg.location();
  const where = loc?.url ? ` (${loc.url}:${loc.lineNumber}:${loc.columnNumber})` : "";
  console.log(`[browser:${msg.type()}] ${msg.text()}${where}`);
});

page.on("pageerror", (err) => {
  console.log("[pageerror]", err?.stack || String(err));
});

page.on("requestfailed", (req) => {
  console.log("[requestfailed]", req.url(), req.failure()?.errorText);
});

page.on("response", (res) => {
  // Useful for catching 404s (missing wrapper/wasm/js)
  if (res.status() >= 400) {
    console.log("[http]", res.status(), res.url());
  }
});


await page.goto(url, { waitUntil: "load" });

// wait up to 20s for OK
const start = Date.now();
while (!ok && Date.now() - start < 20000) {
  await new Promise((r) => setTimeout(r, 100));
}

const outText = await page.evaluate(() => {
  const el = document.getElementById("out");
  return el ? el.textContent : "(no #out element)";
});
console.log("[page #out]", outText);
console.log("[info] loaded url:", url);

await browser.close();
proc.kill("SIGTERM");

if (!ok) {
  console.error("Did not observe FUTHARK_WEBGPU_TEST1_OK in console.");
  process.exit(1);
}
