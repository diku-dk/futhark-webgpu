# Pixels (ARGB vs canvas word format) — JS + Futhark

This is a minimal test that draws simple vertical color stripes and shows the ARGB/canvas mismatch very clearly.

It renders two canvases side-by-side:

- **Raw**: writes the pixel words directly into the canvas buffer.
- **Fixed**: assumes input is ARGB (`0xAARRGGBB`) and converts it to the word format the canvas needs before drawing.

This test also includes different input sources so you can see what happens when the input is already "correct".

## What you should see

The intended stripes are:
```
Red | Green | Blue | White
```

Depending on your selected source:

- If the source outputs **ARGB**:
  - Raw is typically wrong (often Blue/Green/Red/White).
  - Fixed is correct.

- If the source outputs **already-correct canvas words**:
  - Raw is correct.
  - Fixed becomes wrong (because it converts again).

This is useful to show why you either:
- standardize on one internal format (e.g. "everything outputs ARGB"), or
- carry a format flag so you only convert when needed.

## Files

- `index.html`
  UI layout: dropdown for input source, status box, and two canvases.

- `main.js`
  The glue code:
  - creates pixel buffers (JS generator or Futhark output)
  - detects endianness (for correct wording in logs / robust conversion logic)
  - draws "Raw" and "Fixed"
  - optionally loads the Futhark-generated `pixels.js` only when needed

- `pixels.fut`
  Optional Futhark generator for the same stripes.

  Entry point:
  - `entry render(w: i32, h: i32) -> []u32`

- `Makefile`
  Builds the WebGPU library output and starts a simple server.

## Source options (dropdown)

1. **JS generator (ARGB)**
   - Produces pixels as packed ARGB `u32` (`0xAARRGGBB`).
   - This is the "typical program output" case.
   - Raw should look wrong, Fixed should look correct.

2. **JS generator (already canvas format)**
   - Produces pixels already in the exact word format that can be written directly into
     `Uint32Array(ImageData.data.buffer)` to produce RGBA bytes.
   - Raw should look correct.
   - Fixed will look wrong because it assumes the input is ARGB and converts again.

3. **Futhark generator (ARGB)**
   - Runs `pixels.fut` on the GPU via WebGPU and returns `[]u32` pixels in ARGB.
   - This behaves like the JS ARGB option, but exercises the full compiled pipeline.

## How `main.js` works (step-by-step)

1. **Endianness detection**
   The code writes a known 32-bit value into an `ArrayBuffer` and checks the first byte.
   On little-endian machines (almost all browsers today), the least-significant byte comes first.

2. **Conversion helpers**
   - `argbToAbgr(x)` swaps the red and blue bytes inside `0xAARRGGBB`.
   - `argbToCanvasWord(x)` picks the correct "canvas word" conversion based on endianness:
     - little-endian: ABGR words
     - big-endian: RGBA words

3. **Drawing**
   `drawU32(canvas, pixelsU32, w, h)`:
   - creates an `ImageData`
   - makes a `Uint32Array` view of its byte buffer
   - copies the `u32` words over
   - calls `putImageData`

4. **Pick a source**
   - JS sources return a `Uint32Array` immediately.
   - Futhark source:
     - dynamically loads `pixels.js`
     - calls `await Module()`
     - initializes `FutharkModule`
     - calls `fut.entry.render(w, h)`
     - uses `await buf.values()` to read back a `Uint32Array`
     - calls `buf.free()` to avoid leaks

5. **Render Raw and Fixed**
   - Raw draws the source buffer directly.
   - Fixed converts each element assuming the source is ARGB, then draws.
