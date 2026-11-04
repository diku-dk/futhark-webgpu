# Lys in the browser

This folder contains a browser-side example that was built while investigating
how Lys-style programs might run through the Futhark WebGPU backend.

## Background: what Lys expects

On the Futhark side, Lys applications are written around a small event-based interface. A Lys-style program reacts to events such as:

- `#keydown {key}`
- `#keyup {key}`
- `#mouse {buttons, x, y}`
- `#wheel {dx, dy}`
- `#step td`

and renders a 2D image based on the current state.

In the native Lys setup, a generated C/SDL wrapper drives this loop. The browser
does not have SDL, so the first question is whether browser events can be
translated into the same shape, and the second question is whether the generated
WebGPU wrapper can successfully drive the state and render loop.

This example demonstrates the complete browser-side loop:

* load the generated WebGPU wrapper
* create and initialize the Futhark runtime
* initialize application state
* repeatedly call `step`
* forward keyboard, mouse, and wheel input
* call `render`
* draw the resulting pixels into the browser canvas

The status box shows both general runtime information and a decoded summary of
the current browser-side state.

## A note on the application state

The natural interface for a Lys program keeps the application state on the
Futhark side and passes it back and forth as an opaque value:

- `init -> state`
- `step(state) -> state`
- `mouse(state) -> state`
- `render(state) -> pixels`

Earlier versions of the WebGPU backend could not return such an opaque state to
JavaScript — `await fut.entry.init(...)` failed with `ReferenceError: val is
not defined` — so this example used to flatten the state into a long list of
scalars and reassemble it inside Futhark on every call.

That is no longer necessary. The generated wrapper now returns opaque values as
`FutharkOpaque` objects that can be passed straight back into other entry
points, so `genlys.fut` is the ordinary Lys wrapper interface and `main.js`
simply holds on to the state object.

The one thing to be careful about is lifetime: Futhark values are not garbage
collected, so every state that is replaced must be freed. In `main.js` that is
what `replaceState()` is for.

## Files

The example is built around these files:

* `index.html`
  Provides the page structure: canvas, status box, and restart button.

* `style.css`
  Provides the visual layout and styling for the page.

* `main.js`
  Imports the generated WebGPU module, holds the Futhark state, forwards input events, runs the animation loop, and draws pixels into the canvas.

* `lys.fut`
  Contains the actual Lys-style application logic, ending in a `lys` module that satisfies the Lys interface.

* `genlys.fut`
  Exposes the browser-facing entry points, mirroring the `genlys.fut` that the Lys package generates for its C/SDL wrapper.

* `Makefile`
  Builds the WebGPU output and serves the example locally.

## How it works

### Loading the Futhark WebGPU wrapper

The generated `build/lys.mjs` is an ES module, so `main.js` is loaded as a module and imports it:

```js
import { FutharkContext } from "./build/lys.mjs";

const fut = new FutharkContext();
await fut.init();
```

This produces the context object whose `entry` field holds the entry points used for initialization, updates, and rendering.

### Browser-side state

`main.js` holds the Futhark `state` opaque value directly. `replaceState(next)` installs a new state and frees the old one, which matters because an entry point is called on every animation frame.

### Initialisation and resizing

`initState()` asks Futhark to create the initial state based on the current canvas size.

`resizeStateIfNeeded()` checks whether the DOM size of the canvas has changed and, if so, calls the `resize` entry point.

### Rendering

`renderCurrentState()` calls the `render` entry point and receives a `[][]u32` pixel array, which `values()` returns as a flat `Uint32Array`.

The Futhark renderer outputs pixels in ARGB word format. The browser canvas expects RGBA byte order, so the JavaScript converts each returned pixel to the correct canvas word format before calling `putImageData`.

This is the same pixel-order issue that was explored in the earlier ARGB/canvas tests.

### Animation loop

The `frame(ts)` function runs via `requestAnimationFrame`.

Each frame:

1. computes a small `dt`
2. applies `step(dt)` to the state
3. renders the updated state
4. schedules the next frame

This reproduces the basic `step` + `render` loop that a Lys application expects.

### Status display and the Lys text interface

Lys programs describe their status text with `text_format` (a printf-style
string, where `%[a|b]` names the constructors of a sum type) and `text_content`
(the values to substitute). `main.js` reads the format once at startup, calls
`text_content` after each frame, reads the resulting tuple with the generated
`project_*` methods, and does the formatting itself in `formatText()`. This is
the same information the C/SDL wrapper draws on top of the image.

Alongside that, the example keeps two separate status strings, `loopStatus` and
`lastAction`, so that the constantly updated animation loop does not immediately
overwrite more useful messages such as `Key down: ArrowRight` or `Wheel input.`

### Serializing updates

Since animation frames, mouse input, keyboard input, and resize events can all happen close together, the example serializes all state-changing actions through a promise chain called `actionChain`.

The helper `queueAction(fn)` ensures that updates happen one at a time and in order. This keeps the state consistent and avoids overlapping updates.

### Input handling

Keyboard input is mapped to SDL-style key values through `jsKeyToSDL(event)`. The resulting key values are then passed into the `key` entry point.

Mouse movement and button state are converted through `browserButtonsToSDLMask(buttons)` and local canvas coordinates from `offsetX` and `offsetY`, then passed into the `mouse` entry point.

Wheel input is normalized to small integer steps and passed into the `wheel` entry point.

The current Lys-style demo behavior is then visible directly:

* arrow keys move the shape
* `c` and `s` switch shapes
* dragging the mouse moves the object
* the wheel changes the radius
* `space` pauses rotation
