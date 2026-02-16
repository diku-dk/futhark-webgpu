# ARGB Canvas channel order tests

This folder contains small browser tests that explain and reproduce a common issue:

- Many programs produce packed 32-bit pixels as **ARGB** (`0xAARRGGBB`).
- The HTML canvas `ImageData` stores pixels as **RGBA bytes** (`[R, G, B, A]`).
- If you write pixels through a `Uint32Array` view of `ImageData.data.buffer`, the 32-bit *word* you need to write is different from ARGB on most machines (typically little-endian). This looks like **ABGR** (`0xAABBGGRR`) when viewed as a 32-bit number.

Result: if you take ARGB `u32` pixels and render them without conversion into a canvas buffer, **red and blue usually end up swapped**.

The purpose of these tests is to:

- show the mismatch clearly (with a "Raw" and "Fixed" view side-by-side),
- provide a small, reliable conversion that fixes it at the JS boundary,
- make it easy to verify changes to wrappers/runtime code (regression test).

## Subfolders

- `pixels/`
  A minimal "stripes" test (JS + optional Futhark). It is the quickest way to see the bug and confirm the fix.
  It also includes an option where the generator already outputs the correct canvas word format, to show what "already correct" looks like.

- `fancy/`
  A more complex pattern (HSV-style color wheel + alpha + overlay). This is useful to verify the fix on non-trivial colors and transparency, not just pure red/green/blue.

