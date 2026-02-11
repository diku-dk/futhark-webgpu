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

### Check installed Emscripten versions

From an `emsdk` checkout:

```bash
./emsdk list | grep -i installed
```

### Known working version

`emcc` version **5.0.0** works for the current setup.

In order to confirm the `emcc` version:

  ```bash
  emcc -v
  ```

## Troubleshooting

### Device lost / destroyed in Chrome

If when you try a webgpu demo, it shows:

* `Device lost ("destroyed"): Device was destroyed.`

Steps that helped:

* confirm hardware acceleration is enabled in `chrome://gpu`
* do not enable `#enable-unsafe-webgpu` unless needed
* optionally enable `#force-high-performance-gpu` on laptops if the integrated
  GPU driver is unstable

