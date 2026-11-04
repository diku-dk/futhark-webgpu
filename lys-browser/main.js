// Drives the Lys-style program in 'lys.fut' from the browser: it forwards
// keyboard, mouse and wheel events, steps the application over time, and draws
// the pixels it returns into a canvas.
//
// The application state is a Futhark opaque value, which is passed back into
// every entry point and must be freed explicitly when it is replaced.

import { FutharkContext } from "./build/lys.mjs";

const canvas = document.getElementById("surface");
const statusEl = document.getElementById("status");
const restartBtn = document.getElementById("restartBtn");
const ctx = canvas.getContext("2d", { alpha: true });

let fut = null;
let state = null;
let textFormat = null;

let running = false;
let lastFrameTs = null;
let actionChain = Promise.resolve();

// for status display
let loopStatus = "Stopped";
let lastAction = "None";
let lastRenderMs = 0;
let summary = [];

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

function getCanvasSize() {
  const rect = canvas.getBoundingClientRect();
  return {
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height)),
  };
}

// Replace the current state with a new one, freeing the old one.  Futhark
// values are not garbage collected, so every state we stop using must be freed.
function replaceState(next) {
  if (state !== null) {
    state.free();
  }
  state = next;
}

// A tuple result is a single opaque value, whose components are read with the
// generated projections, in the order they appear in the manifest.
async function tupleValues(obj) {
  const fields = fut.manifest.types[obj.type].record.fields;
  const values = [];
  for (const field of fields) {
    values.push(await fut[field.project.replace(/^futhark_/, "")](obj));
  }
  return values;
}

// Format a Lys text_format string.  Lys uses ordinary printf directives, plus
// '%[a|b|...]' to name the constructors of a sum type.
function formatText(format, values) {
  let i = 0;
  return format.replace(/%(\[[^\]]*\]|[-#0-9.]*[a-zA-Z]+)/g, (all, spec) => {
    const value = values[i++];
    if (spec.startsWith("[")) {
      return spec.slice(1, -1).split("|")[Number(value)] ?? String(value);
    }
    if (/[fFeEgG]$/.test(spec)) {
      return Number(value).toFixed(2);
    }
    return String(value);
  });
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
    ...summary,
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

  setStatus("Creating Futhark WebGPU context...");
  fut = new FutharkContext();
  await fut.init();

  const format = await fut.entry.text_format();
  textFormat = new TextDecoder().decode(await format.values());
  format.free();

  console.log("entry keys:", Object.keys(fut.entry));

  setStatus("Futhark runtime ready.");
}

async function initState() {
  await ensureFutharkReady();

  const { width, height } = getCanvasSize();
  canvas.width = width;
  canvas.height = height;

  const seed = Date.now() >>> 0;
  replaceState(await fut.entry.init(seed, height, width));

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

  replaceState(await fut.entry.resize(height, width, state));

  setLastAction("State resized.");
}

// Ask Lys for the text it would draw, and show it in the status panel.
async function updateSummary() {
  const content = await fut.entry.text_content(lastRenderMs, state);
  const values = await tupleValues(content);
  content.free();
  summary = ["", formatText(textFormat, values)];
}

async function renderCurrentState() {
  if (!state) {
    throw new Error("State is not initialized.");
  }

  const width = canvas.width;
  const height = canvas.height;

  const started = performance.now();
  const buf = await fut.entry.render(state);
  const argb = await buf.values();
  buf.free();
  lastRenderMs = performance.now() - started;

  if (argb.length !== width * height) {
    throw new Error(`Expected ${width * height} pixels, got ${argb.length}.`);
  }

  // The Lys renderer produces ARGB words; the canvas wants RGBA bytes.
  const fixed = new Uint32Array(argb.length);
  for (let i = 0; i < argb.length; i++) {
    fixed[i] = argbToCanvasWord(argb[i]);
  }

  drawU32(fixed, width, height);
  await updateSummary();
}

async function stepState(dt) {
  if (!state) return;
  replaceState(await fut.entry.step(dt, state));
}

async function keyState(kind, key) {
  if (!state) return;
  replaceState(await fut.entry.key(kind, key, state));
}

async function mouseState(buttons, x, y) {
  if (!state) return;
  replaceState(await fut.entry.mouse(buttons, x, y, state));
}

async function wheelState(dx, dy) {
  if (!state) return;
  replaceState(await fut.entry.wheel(dx, dy, state));
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

restartBtn.addEventListener("click", () => {
  void queueAction(async () => {
    await restart();
  });
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
    await resizeStateIfNeeded();
    await renderCurrentState();
  });
});

void queueAction(async () => {
  await restart();
  running = true;
  lastFrameTs = null;
  requestAnimationFrame(frame);
});
