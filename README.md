# futhark-webgpu

This repository is intended to coordinate maturation of the
[Futhark](https://futhark-lang.org) WebGPU backend, by containing examples and
guides until we figure out how to make them part of Futhark proper.

## Prerequisites

### Browser (Chrome)
WebGPU should work in Chrome *without* enabling unsafe flags, as long as hardware
acceleration is enabled.

Useful pages:

- `chrome://gpu`
  - Verify that hardware acceleration is enabled and inspect GPU/WebGPU status.
- `chrome://flags/#enable-unsafe-webgpu`
  - Not necessary if hardware acceleration is on (keep default unless you really need it).
- `chrome://flags/#force-high-performance-gpu`
  - Optional: forces Chrome to prefer the discrete GPU. WebGPU can run on
    integrated graphics as well, so this is not required.

## Emscripten (emcc) setup

### WebGPU flag change in newer Emscripten
Newer Emscripten versions no longer support:

- `-sUSE_WEBGPU=1`

For WebGPU builds, use:

- `--use-port=emdawnwebgpu`

In this repository, the only usage of `-sUSE_WEBGPU=1` for the Futhark WebGPU
backend is in `Actions.hs`.

I used this to locate occurrences:

```bash
grep -R "USE_WEBGPU" -n .
````

### Check installed Emscripten versions

From an `emsdk` checkout:

```bash
./emsdk list | grep -i installed
```

### Known working version

`emcc` version **3.1.68** works for the current setup.

In order to confirm the `emcc` version:

  ```bash
  emcc -v
  ```

## Building and running the Sebastian example

### 1) Compile the Futhark program with the WebGPU backend

From the example directory (or wherever the `.fut` lives):

```bash
futhark webgpu --library -o sebastian sebastian.fut
```

This should produce:

* `sebastian.js`
* `sebastian.wasm`
* `sebastan.json` (manifest for the JS wrapper)
* `sebastian.c` (the C wrapper for the JS wrapper)
* `sebastian.wrapper.js` 

### 2) Serve the folder over HTTP

From the directory that contains `index.html`:

```bash
python3 -m http.server 8000
```

Open in Chrome:

* `http://localhost:8000/index.html`

### 3) BigInt notes (important)

The Sebastian Mandelbrot example uses `i64` for `screenX` and `screenY`:

```futhark
entry main (screenX : i64) (screenY : i64) ...
```

I still get this error in Chrome when I try to use `i64`:

* `TypeError: Cannot convert <number> to a BigInt`


## Troubleshooting

### Device lost / destroyed in Chrome

If when you try a webgpu demo, it shows:

* `Device lost ("destroyed"): Device was destroyed.`

Steps that helped:

* confirm hardware acceleration is enabled in `chrome://gpu`
* do not enable `#enable-unsafe-webgpu` unless needed
* optionally enable `#force-high-performance-gpu` on laptops if the integrated
  GPU driver is unstable

