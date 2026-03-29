# Lys in the browser - issue exploration and test examples

This folder contains two small browser-side examples that were built while investigating how Lys-style programs might run through the Futhark WebGPU backend.


The two examples in this folder therefore serve different purposes:

1. `poc-test` checks only the JavaScript-side event translation.
2. `render-test` checks that a Lys-style Futhark program can actually be driven from the browser and rendered to a canvas.

## Background: what Lys expects

On the Futhark side, Lys applications are written around a small event-based interface. A Lys-style program reacts to events such as:

- `#keydown {key}`
- `#keyup {key}`
- `#mouse {buttons, x, y}`
- `#wheel {dx, dy}`
- `#step td`

and renders a 2D image based on the current state.

In the native Lys setup, a generated C/SDL wrapper drives this loop. The browser does not have SDL, so the first question is whether browser events can be translated into the same shape, and the second question is whether the generated WebGPU wrapper can successfully drive the state and render loop.

## Example 1: PoC test - JavaScript event translation

This example is the smallest possible proof of concept for the browser input side.

It does not load any Futhark code. It does not create a WebGPU context. It does not render a Lys program. Instead, it only asks:

"Can browser keyboard, mouse, and wheel events be translated into the same event payloads that a Lys-style wrapper would expect?"

### What the PoC test does

The page contains an interactive surface, a small white dot showing the current mouse location, a box showing the latest translated event, and a log of recent events.

After clicking inside the surface, the example listens for:

* mouse movement
* mouse button presses and releases
* mouse wheel scrolling
* keyboard key down and key up

Each browser event is translated into a payload shaped like the Lys event constructors:

* `#keydown {key}`
* `#keyup {key}`
* `#mouse {buttons, x, y}`
* `#wheel {dx, dy}`

These translated payloads are displayed in the UI so they can be inspected directly.

### What the PoC test does not do

This example does not:

* run a Futhark program
* use `lys.fut`
* create a WebGPU context
* update any Futhark-side state
* render pixels returned from Futhark

It is only an interface check for the browser event layer.

### How the PoC translation works

The script defines a small `SDLK` table for the keys used by the demo, such as:

* arrow keys
* `space`
* `escape`
* `enter`
* `tab`
* `backspace`
* `F1`

For printable keys, the translation uses `event.key` and then converts the resulting character to its code point. This is important because `event.key` reflects the active keyboard layout, which is closer to the SDL-style key values used by Lys than `event.code`, which is purely based on physical key location.


Browser `event.buttons` uses:

* `1` for left
* `2` for right
* `4` for middle
* `8` for back
* `16` for forward

So the JavaScript helper rearranges the bits before emitting the `#mouse` payload.

Mouse coordinates are taken from `offsetX` and `offsetY`, so they are local to the interactive surface. This matches what a browser-facing Lys wrapper would want.

Wheel input is normalized to small integer steps so that the resulting `#wheel {dx, dy}` payload.

### Why this test is useful

The test is useful because it proves that JavaScript input can be translated into the same event vocabulary used by Lys.

## Example 2: Render test - running a Lys-style program through WebGPU

The second example is the actual browser rendering test.

This one does load generated Futhark code. It creates a WebGPU-backed Futhark runtime, initializes a Lys-style application state, forwards input events to Futhark, steps the application over time, and draws the returned pixels to a browser canvas.

This example demonstrates the complete browser-side loop:

* load the generated WebGPU wrapper
* create and initialize the Futhark runtime
* initialize application state
* repeatedly call `step`
* forward keyboard, mouse, and wheel input
* call `render`
* draw the resulting pixels into the browser canvas

The status box shows both general runtime information and a decoded summary of the current browser-side state.

## Why the render test currently uses a packed state interface

This is the main design compromise in the render test.

The first version used the more natural interface, where JavaScript receives the Futhark `state` returned by `init`, stores it, and passes it back into later entry points such as `step`, `mouse`, and `render`. In other words, the intended interface looked like:

- `init -> state`
- `step(state) -> state`
- `mouse(state) -> state`
- `render(state) -> pixels`

This failed when the browser-side code tried to call:

```js
state = await fut.entry.init(Date.now() >>> 0, height, width);
```

At that point the generated wrapper crashed with:

```
ReferenceError: val is not defined
```

So the failure happened precisely when JavaScript tried to receive the returned Futhark `state`.

To check whether the problem was really the returned state object, a helper called `render_once` was added. That helper did:

* `init`
* then `render`

entirely inside Futhark, and returned only the pixel array to JavaScript.

That version worked. This showed that:

* initialization inside Futhark works
* rendering inside Futhark works
* the WebGPU runtime works
* the browser canvas conversion works
* the problem is not the Lys logic itself, but the interface path where an opaque state value is returned to JavaScript

At that point, the safest way to do the test was to avoid returning the opaque state through the generated browser wrapper.

So the current render test uses a browser-facing wrapper interface that returns every relevant state component explicitly as scalar values, such as:

* time
* height and width
* center position
* current shape id
* movement vector
* mouse position
* radius
* paused flag

JavaScript stores these in a normal JS object. When it needs to call `step`, `key`, `mouse`, `wheel`, `resize`, or `render`, it passes those components back as ordinary arguments. Inside Futhark, helper functions reconstruct the real application state from that flat representation.

This should be understood as a practical workaround for the current browser/WebGPU wrapper behavior, not as a statement that Lys fundamentally needs this kind of interface. This looks like a compiler issue in the generated wrapper, and it may be possible to fix it so that the more natural opaque state path works correctly.

## Files in the render test

The render test is built around these files:

* `index.html`
  Provides the page structure: canvas, status box, and restart button.

* `style.css`
  Provides the visual layout and styling for the page.

* `main.js`
  Loads the generated WebGPU wrapper, stores the browser-side packed state, forwards input events, runs the animation loop, and draws pixels into the canvas.

* `lys.fut`
  Contains the actual Lys-style application logic and the helper functions for packing and unpacking the browser-side state representation.

* `genlys.fut`
  Exposes browser-facing entry points that use only plain scalar values plus pixel arrays, instead of opaque returned state.

* `Makefile`
  Builds the WebGPU output and serves the example locally.

## How the render test works

### Loading the Futhark WebGPU wrapper

The JavaScript first loads the generated `build/lys.js` script, then constructs the runtime via:

* `Module()`
* `new FutharkModule()`
* `await fut.init(emModule)`

This produces the browser-side wrapper object whose entry points are used for initialization, updates, and rendering.

### Browser-side state representation

Because the wrapper does not return an opaque `state`, `main.js` keeps a normal JS object with the explicit state fields.

Two helper functions bridge the JS and Futhark representations:

* `outputsToState(out)`
  Converts the flat list of values returned by Futhark into a browser-side JS state object.

* `stateToArgs(state)`
  Converts the JS state object back into the positional argument list expected by the Futhark entry points.

This browser-side state is what the page uses throughout the animation loop and input handling.

### Initialisation and resizing

`initState()` asks Futhark to create the initial packed state based on the current canvas size.

`resizeStateIfNeeded()` checks whether the DOM size of the canvas has changed and, if so, calls the packed-state `resize` entry point and updates the browser-side state accordingly.

### Rendering

`renderCurrentState()` calls the packed-state `render` entry point and receives a flat `[]u32` pixel buffer.

The Futhark renderer outputs pixels in ARGB word format. The browser canvas expects RGBA byte order, so the JavaScript converts each returned pixel to the correct canvas word format before calling `putImageData`.

This is the same pixel-order issue that was explored in the earlier ARGB/canvas tests.

### Animation loop

The `frame(ts)` function runs via `requestAnimationFrame`.

Each frame:

1. computes a small `dt`
2. applies `step(dt)` to the packed state
3. renders the updated state
4. schedules the next frame

This reproduces the basic `step` + `render` loop that a Lys application expects.

### Serializing updates

Since animation frames, mouse input, keyboard input, and resize events can all happen close together, the example serializes all state-changing actions through a promise chain called `actionChain`.

The helper `queueAction(fn)` ensures that updates happen one at a time and in order. This keeps the browser-side packed state consistent and avoids overlapping updates.

### Input handling

The same translation ideas from the PoC test are reused here.

Keyboard input is mapped to SDL-style key values through `jsKeyToSDL(event)`. The resulting key values are then passed into the packed-state `key` entry point.

Mouse movement and button state are converted through `browserButtonsToSDLMask(buttons)` and local canvas coordinates from `offsetX` and `offsetY`, then passed into the packed-state `mouse` entry point.

Wheel input is normalized to small integer steps and passed into the packed-state `wheel` entry point.

The current Lys-style demo behavior is then visible directly:

* arrow keys move the shape
* `c` and `s` switch shapes
* dragging the mouse moves the object
* the wheel changes the radius
* `space` pauses rotation

### Status display

The render test keeps two separate status strings:

* `loopStatus`
* `lastAction`

This is done so that the constantly updated animation loop does not immediately overwrite more useful messages such as `Key down: ArrowRight` or `Wheel input.`

The status panel also includes a decoded summary of the current state, which makes debugging much easier.
