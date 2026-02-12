import http from "http";
import fs from "fs";
import path from "path";

const root = process.argv[2];
if (!root) {
  console.error("Usage: node serve_test1.mjs <dir>");
  process.exit(2);
}

function contentType(p) {
  if (p.endsWith(".html")) return "text/html";
  if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript";
  if (p.endsWith(".wasm")) return "application/wasm";
  if (p.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

const server = http.createServer((req, res) => {
  // Needed for crossOriginIsolated / SharedArrayBuffer
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

  let p = req.url.split("?")[0];
  if (p === "/") p = "/index.html";
  const filePath = path.join(root, p);

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(0, "127.0.0.1", () => {
  const { port } = server.address();
  console.log(`URL=http://127.0.0.1:${port}/`);
});
