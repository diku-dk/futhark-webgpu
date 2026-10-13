(async function () {
  const canvas = document.getElementById("surface");
  const statusEl = document.getElementById("status");
  const restartBtn = document.getElementById("restartBtn");
  const ctx = canvas.getContext("2d", { alpha: true });

  let emModule = null;
  let fut = null;
  let state = null;

  let running = false;
  let lastFrameTs = null;
  let actionChain = Promise.resolve();

  // for status display
  let loopStatus = "Stopped";
  let lastAction = "None";

  // SDL keycodes used by the Lys demo.
  const SDLK = {
    BACKSPACE: 8,
    TAB: 9,
    RETURN: 13,
    ESCAPE: 27,
    SPACE: 32,

    F1: 0x4000003A,

    RIGHT: 0x4000004F,
    LEFT: 0x40000050,
    DOWN: 0x40000051,
    UP: 0x40000052,
  };

  function setStatus(...lines) {
    statusEl.textContent = lines.join("\n");
  }

  function isLittleEndian() {
    const b = new ArrayBuffer(4);
    new Uint32Array(b)[0] = 0x01020304;
    return new Uint8Array(b)[0] === 0x04;
  }

  const littleEndian = isLittleEndian();

  function argbToAbgr(x) {
    x = x >>> 0;
    return (
      (x & 0xFF00FF00) |
      ((x & 0x00FF0000) >>> 16) |
      ((x & 0x000000FF) << 16)
    ) >>> 0;
  }

  function argbToRgbaBE(x) {
    x = x >>> 0;
    return ((x << 8) | (x >>> 24)) >>> 0;
  }

  function argbToCanvasWord(x) {
    return littleEndian ? argbToAbgr(x) : argbToRgbaBE(x);
  }

  function drawU32(pixelsU32, w, h) {
    const img = ctx.createImageData(w, h);
    const dst = new Uint32Array(img.data.buffer);
    dst.set(pixelsU32);
    ctx.putImageData(img, 0, 0);
  }

  function loadScriptOnce(url) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${url}"]`);
      if (existing) {
        resolve();
        return;
      }

      const s = document.createElement("script");
      s.src = url;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${url}`));
      document.head.appendChild(s);
    });
  }

  function getCanvasSize() {
    const rect = canvas.getBoundingClientRect();
    return {
      width: Math.max(1, Math.floor(rect.width)),
      height: Math.max(1, Math.floor(rect.height)),
    };
  }

  // The entry points return the state as a tuple, which is an opaque record
  // whose fields we project, in order.
  async function outputsToState(out) {
    const fields = fut.manifest.types[out.futharkType()].record.fields;
    const vals = [];
    for (const f of fields) {
      vals.push(await fut[f.project.replace(/^futhark_/, "")](out));
    }
    out.free();

    const [
      time,
      h,
      w,
      centerY,
      centerX,
      centerObject,
      movingY,
      movingX,
      mouseY,
      mouseX,
      radius,
      paused,
    ] = vals;

    return {
      time,
      h,
      w,
      centerY,
      centerX,
      centerObject,
      movingY,
      movingX,
      mouseY,
      mouseX,
      radius,
      paused,
    };
  }

  function stateToArgs(s) {
    return [
      s.time,
      s.h,
      s.w,
      s.centerY,
      s.centerX,
      s.centerObject,
      s.movingY,
      s.movingX,
      s.mouseY,
      s.mouseX,
      s.radius,
      s.paused,
    ];
  }

  function centerObjectName(id) {
    return id === 0 ? "circle" : "square";
  }

  function stateSummaryLines(s) {
    if (!s) return ["State: not initialized"];
    return [
      `time: ${Number(s.time).toFixed(3)}`,
      `size in state: ${s.w} x ${s.h}`,
      `center: (${s.centerY}, ${s.centerX})`,
      `center object: ${centerObjectName(s.centerObject)}`,
      `moving: (${s.movingY}, ${s.movingX})`,
      `mouse: (${s.mouseY}, ${s.mouseX})`,
      `radius: ${s.radius}`,
      `paused: ${s.paused !== 0 ? "true" : "false"}`,
    ];
  }

  function controlsLines() {
    return [
      "",
      "Controls:",
      "Click canvas to focus",
      "Arrow keys: move",
      "C / S: circle / square",
      "Mouse drag: move shape",
      "Wheel: change radius",
      "Space: pause rotation",
    ];
  }

  function renderStatus() {
    setStatus(
      "Futhark runtime ready.",
      `Canvas size: ${canvas.width} x ${canvas.height}`,
      `Loop: ${loopStatus}`,
      `Last action: ${lastAction}`,
      ...stateSummaryLines(state),
      ...controlsLines()
    );
  }

  function setLoopStatus(message) {
    loopStatus = message;
    renderStatus();
  }

  function setLastAction(message) {
    lastAction = message;
    renderStatus();
  }

  function queueAction(fn) {
    const run = actionChain.then(fn, fn);
    actionChain = run.catch((err) => {
      console.error(err);
      loopStatus = "Error";
      lastAction = err?.message || String(err);
      renderStatus();
    });
    return run;
  }

  // Use event.key, not event.code, so printable keys follow the active layout.
  function jsKeyToSDL(event) {
    switch (event.key) {
      case "ArrowRight": return SDLK.RIGHT;
      case "ArrowLeft": return SDLK.LEFT;
      case "ArrowDown": return SDLK.DOWN;
      case "ArrowUp": return SDLK.UP;

      case "Escape": return SDLK.ESCAPE;
      case "Enter": return SDLK.RETURN;
      case "Tab": return SDLK.TAB;
      case "Backspace": return SDLK.BACKSPACE;
      case "F1": return SDLK.F1;
      case " ": return SDLK.SPACE;

      default:
        if (event.key.length === 1) {
          return event.key.toLowerCase().codePointAt(0) ?? 0;
        }
        return 0;
    }
  }

  // Browser event.buttons:
  // 1 left, 2 right, 4 middle, 8 back, 16 forward
  // Lys/SDL mask order:
  // left=1, middle=2, right=4, x1=8, x2=16
  function browserButtonsToSDLMask(buttons) {
    let mask = 0;
    if (buttons & 1) mask |= 1;   // left
    if (buttons & 4) mask |= 2;   // middle
    if (buttons & 2) mask |= 4;   // right
    if (buttons & 8) mask |= 8;   // x1
    if (buttons & 16) mask |= 16; // x2
    return mask;
  }

  function wheelDeltaToStep(delta) {
    if (delta < 0) return 1;
    if (delta > 0) return -1;
    return 0;
  }

  function localXY(event) {
    return {
      x: Math.floor(event.offsetX),
      y: Math.floor(event.offsetY),
    };
  }

  async function ensureFutharkReady() {
    if (fut) return;

    setStatus("Loading build/lys.js...");
    await loadScriptOnce("build/lys.js");

    if (typeof Module !== "function" || typeof FutharkModule !== "function") {
      throw new Error("build/lys.js loaded, but Module/FutharkModule were not found.");
    }

    setStatus("Initializing Emscripten module...");
    emModule = await Module();

    setStatus("Creating Futhark WebGPU context...");
    fut = new FutharkModule();
    await fut.init(emModule);

    console.log("entry keys:", Object.keys(fut.entry));

    setStatus("Futhark runtime ready.");
  }

  async function initState() {
    await ensureFutharkReady();

    const { width, height } = getCanvasSize();
    canvas.width = width;
    canvas.height = height;

    const seed = Date.now() >>> 0;
    const out = await fut.entry.init(seed, height, width);
    state = await outputsToState(out);

    console.log("decoded state after init:", state);
    setLastAction("State initialized.");
  }

  async function resizeStateIfNeeded() {
    if (!state) return;

    const { width, height } = getCanvasSize();

    if (width === canvas.width && height === canvas.height) {
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const out = await fut.entry.resize(height, width, ...stateToArgs(state));
    state = await outputsToState(out);

    setLastAction("State resized.");
  }

  async function renderCurrentState() {
    if (!state) {
      throw new Error("State is not initialized.");
    }

    const width = canvas.width;
    const height = canvas.height;

    const buf = await fut.entry.render(...stateToArgs(state));
    const argb = await buf.values();
    buf.free();

    if (argb.length !== width * height) {
      throw new Error(`Expected ${width * height} pixels, got ${argb.length}.`);
    }

    const fixed = new Uint32Array(argb.length);
    for (let i = 0; i < argb.length; i++) {
      fixed[i] = argbToCanvasWord(argb[i]);
    }

    drawU32(fixed, width, height);
  }

  async function renderState() {
    await ensureFutharkReady();

    if (!state) {
      await initState();
    }

    await resizeStateIfNeeded();
    await renderCurrentState();
    setLastAction("Rendered current state.");
  }

  async function stepState(dt) {
    if (!state) return;
    const out = await fut.entry.step(dt, ...stateToArgs(state));
    state = await outputsToState(out);
  }

  async function keyState(kind, key) {
    if (!state) return;
    const out = await fut.entry.key(kind, key, ...stateToArgs(state));
    state = await outputsToState(out);
  }

  async function mouseState(buttons, x, y) {
    if (!state) return;
    const out = await fut.entry.mouse(buttons, x, y, ...stateToArgs(state));
    state = await outputsToState(out);
  }

  async function wheelState(dx, dy) {
    if (!state) return;
    const out = await fut.entry.wheel(dx, dy, ...stateToArgs(state));
    state = await outputsToState(out);
  }

  async function restart() {
    await initState();
    await renderCurrentState();
    setLoopStatus("Restarted.");
  }

  async function frame(ts) {
    if (!running) return;

    if (lastFrameTs == null) {
      lastFrameTs = ts;
    }

    const dt = Math.min(0.05, (ts - lastFrameTs) / 1000);
    lastFrameTs = ts;

    await queueAction(async () => {
      if (!state) return;
      await resizeStateIfNeeded();
      await stepState(dt);
      await renderCurrentState();
      setLoopStatus("Running.");
    });

    if (running) {
      requestAnimationFrame(frame);
    }
  }

  restartBtn.addEventListener("click", async () => {
    try {
      await queueAction(async () => {
        await restart();
      });
    } catch (err) {
      console.error(err);
      setStatus("ERROR in restart button", err?.message || String(err));
    }
  });

  canvas.addEventListener("mousedown", (event) => {
    canvas.focus();
    void queueAction(async () => {
      if (!state) return;
      const { x, y } = localXY(event);
      const buttons = browserButtonsToSDLMask(event.buttons);
      await mouseState(buttons, x, y);
      setLastAction("Mouse down.");
    });
    event.preventDefault();
  });

  canvas.addEventListener("mouseup", (event) => {
    void queueAction(async () => {
      if (!state) return;
      const { x, y } = localXY(event);
      const buttons = browserButtonsToSDLMask(event.buttons);
      await mouseState(buttons, x, y);
      setLastAction("Mouse up.");
    });
    event.preventDefault();
  });

  canvas.addEventListener("mousemove", (event) => {
    void queueAction(async () => {
      if (!state) return;
      const { x, y } = localXY(event);
      const buttons = browserButtonsToSDLMask(event.buttons);
      await mouseState(buttons, x, y);
    });
  });

  canvas.addEventListener("wheel", (event) => {
    void queueAction(async () => {
      if (!state) return;
      const dx = wheelDeltaToStep(event.deltaX);
      const dy = wheelDeltaToStep(event.deltaY);
      await wheelState(dx, dy);
      setLastAction("Wheel input.");
    });
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  window.addEventListener("keydown", (event) => {
    if (document.activeElement !== canvas) return;

    void queueAction(async () => {
      if (!state) return;
      const key = jsKeyToSDL(event);
      if (key === 0) return;
      await keyState(0, key);
      setLastAction(`Key down: ${event.key}`);
    });

    event.preventDefault();
  });

  window.addEventListener("keyup", (event) => {
    if (document.activeElement !== canvas) return;

    void queueAction(async () => {
      if (!state) return;
      const key = jsKeyToSDL(event);
      if (key === 0) return;
      await keyState(1, key);
      setLastAction(`Key up: ${event.key}`);
    });

    event.preventDefault();
  });

  window.addEventListener("resize", () => {
    if (!fut || !state) return;
    void queueAction(async () => {
      await renderState();
    });
  });

  try {
    await queueAction(async () => {
      await restart();
      running = true;
      lastFrameTs = null;
      requestAnimationFrame(frame);
    });
  } catch (err) {
    console.error(err);
    loopStatus = "Error";
    lastAction = err?.message || String(err);
    renderStatus();
  }
})();