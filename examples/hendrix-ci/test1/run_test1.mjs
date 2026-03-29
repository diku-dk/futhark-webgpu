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
let timedOut = false;
const fatalConsole = [];
const pageErrors = [];
const requestFailures = [];
const httpErrors = [];

const fatalPatterns = [
  /FUTHARK_WEBGPU_TEST1_FAIL/,
  /Could not get WebGPU device/,
  /Unsupported feature:/,
  /program exited \(with status: -1\)/,
  /WINDOW_ERROR/,
  /UNHANDLED_REJECTION/,
];

page.on("console", (msg) => {
  const text = msg.text();
  const loc = msg.location();
  const where = loc?.url ? ` (${loc.url}:${loc.lineNumber}:${loc.columnNumber})` : "";
  console.log(`[browser:${msg.type()}] ${text}${where}`);

  if (text.includes("FUTHARK_WEBGPU_TEST1_OK")) {
    ok = true;
  }

  if (fatalPatterns.some((re) => re.test(text))) {
    fatalConsole.push(`[${msg.type()}] ${text}${where}`);
  }
});

page.on("pageerror", (err) => {
  const msg = err?.stack || String(err);
  pageErrors.push(msg);
  console.log("[pageerror]", msg);
});

page.on("requestfailed", (req) => {
  const msg = `${req.url()} ${req.failure()?.errorText}`;
  requestFailures.push(msg);
  console.log("[requestfailed]", msg);
});

page.on("response", (res) => {
  if (res.status() >= 400) {
    const msg = `${res.status()} ${res.url()}`;
    httpErrors.push(msg);
    console.log("[http]", msg);
  }
});

await page.goto(url, { waitUntil: "load" });

try {
  await page.waitForFunction(() => {
    const el = document.getElementById("out");
    if (!el) return false;
    const t = el.textContent || "";
    return t === "OK" || t.startsWith("FAIL:");
  }, null, { timeout: 20000 });
} catch (e) {
  timedOut = true;
  console.log("[timeout waiting for #out to become OK/FAIL]");
}

const outText = await page.evaluate(() => {
  const el = document.getElementById("out");
  return el ? el.textContent : "(no #out element)";
});

console.log("[page #out]", outText);
console.log("[info] loaded url:", url);

await browser.close();
proc.kill("SIGTERM");

if (!ok || outText !== "OK" || timedOut || fatalConsole.length > 0 || pageErrors.length > 0 || requestFailures.length > 0 || httpErrors.length > 0) {
  console.error("=== TEST FAILURE SUMMARY ===");
  console.error("ok seen:", ok);
  console.error("timed out:", timedOut);
  console.error("page #out:", outText);

  if (fatalConsole.length) {
    console.error("--- fatal console messages ---");
    for (const x of fatalConsole) console.error(x);
  }

  if (pageErrors.length) {
    console.error("--- page errors ---");
    for (const x of pageErrors) console.error(x);
  }

  if (requestFailures.length) {
    console.error("--- request failures ---");
    for (const x of requestFailures) console.error(x);
  }

  if (httpErrors.length) {
    console.error("--- http errors ---");
    for (const x of httpErrors) console.error(x);
  }

  process.exit(1);
}