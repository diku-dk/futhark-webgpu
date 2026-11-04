# Futhark WebGPU examples

This repository contains examples of how to use
[Futhark](https://futhark-lang.org)'s WebGPU backend. Each example is an HTML
file and some JavaScript that uses the modules produced by `futhark webgpu
--library`.

The generated JavaScript API is documented upstream in
[`docs/js-api.rst`](https://github.com/diku-dk/futhark/blob/master/docs/js-api.rst).
It is the *same* API for the `webgpu`, `wasm`, and `wasm-multicore` backends.

## The examples

* [`argb-canvas/`](argb-canvas/): the pixel-order problem you hit when a Futhark
  program produces ARGB words and the canvas wants RGBA bytes.

* [`mandelbrot/`](mandelbrot/): compute one image and blit it to a canvas.

* [`tunnel/`](tunnel/): a `requestAnimationFrame`-driven animation.

* [`stopwatch/`](stopwatch/): the same idea, with UI state (pause, reset,
  speed).

* [`lys-browser/`](lys-browser/): translating browser input events into
  [Lys](https://github.com/diku-dk/lys) events, and a fully interactive Lys
  renderer.

To build an example, do `make serve` in its directory. This builds the example
and runs a webserver (using `python3`) serving it at `localhost:8000`. The
`Makefiles` are fairly simple and also serve to demonstrate the build process.

## Prerequisites

### Browser (Chrome)

WebGPU should work in Chrome *without* enabling unsafe flags, as long as
hardware acceleration is enabled.

Useful pages:

- `chrome://gpu`
  - Verify that hardware acceleration is enabled and inspect GPU/WebGPU status.
- `chrome://flags/#enable-unsafe-webgpu`
  - Not necessary if hardware acceleration is on (keep default unless you really need it).
- `chrome://flags/#force-high-performance-gpu`
  - Optional: forces Chrome to prefer the discrete GPU. WebGPU can run on
    integrated graphics as well, so this is not required.

### Futhark

A Futhark compiler with WebGPU support, which at the time of writing means a
build of the `webgpu` branch.

### Emscripten (emcc)

`futhark webgpu` invokes `emcc`, so it must be on your `PATH`.

#### Known working version

`emcc` version **6.0.9** works for the current setup, and is what Futhark's own
CI uses.

To confirm the `emcc` version:

```bash
emcc -v
```

#### Check installed Emscripten versions

From an `emsdk` checkout:

```bash
./emsdk list | grep -i installed
```

#### With Nix

The Futhark repository provides a shell with a working `emcc` and a Node with
WebGPU support:

```bash
nix develop /path/to/futhark#test-webgpu
```

## Troubleshooting

### `Unsupported feature: shader-f16`

The generated runtime requests the `shader-f16` WebGPU feature, so an adapter
that does not expose it cannot be used. Headless Chromium falls back to
SwiftShader, which does not have it; pass `--use-angle=vulkan
--disable-vulkan-surface` (and `--ignore-gpu-blocklist`) to get a hardware
adapter.

### `Failed to load module script` / bare 404s

The generated `.mjs` file is an ES module and loads its `.wasm` from the same
directory, so the page must be served over HTTP (`make serve`) rather than
opened as a `file:` URL, and the `.wasm` must sit beside the `.mjs`.

### Device lost / destroyed in Chrome

If when you try a webgpu demo, it shows:

* `Device lost ("destroyed"): Device was destroyed.`

Steps that helped:

* confirm hardware acceleration is enabled in `chrome://gpu`

* do not enable `#enable-unsafe-webgpu` unless needed

* optionally enable `#force-high-performance-gpu` on laptops if the integrated
  GPU driver is unstable

