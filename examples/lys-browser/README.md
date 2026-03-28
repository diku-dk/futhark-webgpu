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

## Example 2: Render test 

