import { chromium } from "playwright";
import http from "http";

function startServer() {
  const server = http.createServer((req, res) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<!doctype html><html><body>ok</body></html>");
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

const { server, url } = await startServer();

const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan,WebGPU",
    "--ignore-gpu-blocklist",
    "--use-angle=vulkan",
  ],
});

const page = await browser.newPage();
await page.goto(url);

const result = await page.evaluate(async () => {
  return {
    href: location.href,
    isSecureContext,
    hasNavigatorGpu: "gpu" in navigator,
    ua: navigator.userAgent,
  };
});

console.log(result);

if (!result.hasNavigatorGpu) {
  await browser.close();
  server.close();
  process.exit(1);
}

const detail = await page.evaluate(async () => {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { ok: false, why: "requestAdapter() returned null" };
  const device = await adapter.requestDevice();

  return {
    ok: true,
    crossOriginIsolated,
    maxWorkgroupSizeX: device.limits.maxComputeWorkgroupSizeX,
    maxBufferSize: device.limits.maxBufferSize,
  };
});


console.log(detail);

await browser.close();
server.close();

if (!detail.ok) process.exit(2);
