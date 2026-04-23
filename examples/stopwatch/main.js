async function run() {
  const statusEl = document.getElementById("status");
  const statusBox = statusEl.parentElement;
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  const speedEl = document.getElementById("speed");
  const speedValEl = document.getElementById("speedVal");
  const toggleBtn = document.getElementById("toggle");
  const resetBtn = document.getElementById("reset");
  const elapsedEl = document.getElementById("elapsed");

  const LOG_MAX_LINES = 40;
  const logLines = [];

  function log(line) {
    logLines.push(line);
    if (logLines.length > LOG_MAX_LINES) {
      logLines.splice(0, logLines.length - LOG_MAX_LINES);
    }
    statusEl.textContent = logLines.join("\n");
    statusBox.scrollTop = statusBox.scrollHeight;
  }

  function currentSpeed() {
    return Number(speedEl.value);
  }

  function updateSpeedLabel() {
    speedValEl.textContent = currentSpeed().toFixed(1);
  }

  function formatElapsed(t) {
    const total = Math.floor(t);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    const tenths = Math.floor((t - Math.floor(t)) * 10);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }

  speedEl.addEventListener("input", updateSpeedLabel);
  updateSpeedLabel();

  let running = true;
  let elapsed = 0.0;

  toggleBtn.addEventListener("click", () => {
    running = !running;
    toggleBtn.textContent = running ? "Pause" : "Start";
    log(running ? "Timer resumed." : "Timer paused.");
  });

  resetBtn.addEventListener("click", () => {
    elapsed = 0.0;
    elapsedEl.textContent = formatElapsed(elapsed);
    log("Timer reset.");
  });

  log("Checking WebGPU support...");
  const hasWebGPU = typeof navigator !== "undefined" && !!navigator.gpu;
  log(hasWebGPU ? "WebGPU available." : "WebGPU NOT available.");

  const hasSAB = typeof SharedArrayBuffer !== "undefined";
  log(hasSAB ? "SharedArrayBuffer available." : "SharedArrayBuffer NOT available.");

  if (!hasWebGPU) {
    log("");
    log("Cannot run: WebGPU is missing. Try a newer Chrome/Edge, or enable WebGPU.");
    return;
  }

  log("Initializing Emscripten module...");
  const m = await Module();

  log("Creating Futhark context (WebGPU device)...");
  const fut = new FutharkModule();
  await fut.init(m);
  log("Futhark context ready.");

  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.createImageData(width, height);

  let lastNow = performance.now();

  let frames = 0;
  let accComputeMs = 0;
  let lastStatsNow = lastNow;

  async function frame(now) {
    const dt = (now - lastNow) / 1000.0;
    lastNow = now;

    if (running) {
      elapsed += dt * currentSpeed();
    }

    elapsedEl.textContent = formatElapsed(elapsed);

    const tCompute0 = performance.now();
    const res = await fut.entry.main(elapsed, height, width);
    const buf = Array.isArray(res) ? res[0] : res;

    const vals = await buf.values();
    const bytes = new Uint8Array(vals.buffer, vals.byteOffset, vals.length * 4);

    imgData.data.set(bytes);
    ctx.putImageData(imgData, 0, 0);

    buf.free();
    const tCompute1 = performance.now();

    frames += 1;
    accComputeMs += (tCompute1 - tCompute0);

    if (now - lastStatsNow >= 1000) {
      const fps = frames * 1000 / (now - lastStatsNow);
      const avgCompute = accComputeMs / frames;

      log(
        `FPS: ${fps.toFixed(1)} | avg frame compute: ${avgCompute.toFixed(2)} ms | ` +
        `timer: ${formatElapsed(elapsed)} | speed: ${currentSpeed().toFixed(1)}x`
      );

      frames = 0;
      accComputeMs = 0;
      lastStatsNow = now;
    }

    requestAnimationFrame(frame);
  }

  elapsedEl.textContent = formatElapsed(elapsed);
  requestAnimationFrame(frame);
}

window.addEventListener("load", run);