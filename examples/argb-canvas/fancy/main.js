async function run() {
  const statusEl = document.getElementById("status");
  const rawCanvas = document.getElementById("raw");
  const fixedCanvas = document.getElementById("fixed");

  const wEl = document.getElementById("w");
  const hEl = document.getElementById("h");
  const swapEl = document.getElementById("swap");
  const renderBtn = document.getElementById("render");

  function log(line) {
    statusEl.textContent += line + "\n";
    statusEl.parentElement.scrollTop = statusEl.parentElement.scrollHeight;
  }
  function clearLog() {
    statusEl.textContent = "";
  }

  // --- Endianness helper (mostly academic; browsers are almost always little-endian) ---
  function isLittleEndian() {
    const b = new ArrayBuffer(4);
    new Uint32Array(b)[0] = 0x01020304;
    return new Uint8Array(b)[0] === 0x04;
  }
  const little = isLittleEndian();

  // fancy.fut outputs ARGB packed u32: 0xAARRGGBB
  // Canvas ImageData wants RGBA bytes: [R,G,B,A,...]
  //
  // When writing via Uint32Array(ImageData.data.buffer):
  // - on little-endian, the word value must be ABGR (0xAABBGGRR) so the bytes become RGBA.
  function argbToAbgr(x) {
    x = x >>> 0;
    return (
      (x & 0xFF00FF00) |
      ((x & 0x00FF0000) >>> 16) |
      ((x & 0x000000FF) << 16)
    ) >>> 0;
  }

  // Robust conversion to RGBA bytes (works regardless of endianness):
  function argbToRgbaBytes(dstU8, srcU32) {
    for (let i = 0; i < srcU32.length; i++) {
      const x = srcU32[i] >>> 0;       // 0xAARRGGBB
      const a = (x >>> 24) & 0xFF;
      const r = (x >>> 16) & 0xFF;
      const g = (x >>>  8) & 0xFF;
      const b = (x >>>  0) & 0xFF;

      const j = i * 4;
      dstU8[j + 0] = r;
      dstU8[j + 1] = g;
      dstU8[j + 2] = b;
      dstU8[j + 3] = a;
    }
  }

  function drawFromARGB(canvas, argbU32, w, h, doConvert) {
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: true });
    const img = ctx.createImageData(w, h);

    if (!doConvert) {
      // Raw path: write ARGB words directly (expected to look wrong on little-endian).
      const dst32 = new Uint32Array(img.data.buffer);
      dst32.set(argbU32);
    } else {
      // Fixed path:
      if (little) {
        // Fast conversion: ARGB word -> ABGR word
        const dst32 = new Uint32Array(img.data.buffer);
        for (let i = 0; i < argbU32.length; i++) dst32[i] = argbToAbgr(argbU32[i]);
      } else {
        // Safe conversion: always fill RGBA bytes
        argbToRgbaBytes(img.data, argbU32);
      }
    }

    ctx.putImageData(img, 0, 0);
  }

  // --- WebGPU/Emscripten init (tunnel-style) ---
  clearLog();
  log("Checking WebGPU support...");
  const hasWebGPU = typeof navigator !== "undefined" && !!navigator.gpu;
  log(hasWebGPU ? "WebGPU available." : "WebGPU NOT available.");

  if (!hasWebGPU) {
    log("Cannot run: WebGPU is missing.");
    return;
  }

  if (typeof Module !== "function" || typeof FutharkModule !== "function") {
    log("ERROR: fancy.js did not define Module/FutharkModule (wrong file order?)");
    return;
  }

  log("Initializing Emscripten module...");
  const m = await Module();

  log("Creating Futhark context (WebGPU device)...");
  const fut = new FutharkModule();
  await fut.init(m);
  log("Futhark ready.");

  log(`Endianness: ${little ? "little" : "big"}-endian`);
  log("fancy.fut output assumed: ARGB u32 (0xAARRGGBB)");
  log("Canvas wants: RGBA bytes; Uint32 fast path uses ABGR words on little-endian.");

  async function render() {
    clearLog();
    const w = Number(wEl.value) | 0;
    const h = Number(hEl.value) | 0;
    const doConvert = !!swapEl.checked;

    log(`Render w=${w}, h=${h}, convert=${doConvert ? "on" : "off"}`);

    const t0 = performance.now();

    // fancy.fut entry: entry render (w:i32) (h:i32) : []u32
    const res = await fut.entry.render(w, h);
    const buf = Array.isArray(res) ? res[0] : res;

    const argb = await buf.values(); // Uint32Array
    buf.free();

    const t1 = performance.now();
    log(`Compute+readback: ${(t1 - t0).toFixed(2)} ms`);

    // Show both: raw vs fixed (fixed respects the checkbox; raw always raw)
    drawFromARGB(rawCanvas, argb, w, h, false);
    drawFromARGB(fixedCanvas, argb, w, h, doConvert);

    log("Done.");
  }

  renderBtn.addEventListener("click", render);

  // Initial render
  await render();
}

window.addEventListener("load", run);
