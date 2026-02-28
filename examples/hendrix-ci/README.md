# hendrix-ci

This folder contains **headless WebGPU checks and CI-style tests** meant to run on DIKU’s Hendrix cluster.

The purpose is to validate that:
1) WebGPU is available in a **headless browser** on Hendrix.
2) A **Futhark WebGPU-compiled program** can be executed headlessly and produces the correct result.

**Make sure to check `hendrix_installation.md` for installation instructions and troubleshooting tips.**

## Prerequisites (one-time)

From inside `hendrix-ci/`:

```bash
npm install
npx playwright install chromium
```

(Playwright is used to run Chromium headlessly.)

You also need `futhark` available in your PATH (your locally built WebGPU branch), and the relevant Hendrix modules loaded (gcc/gmp/perl/python), typically via your `.bashrc`.

## Folder structure

* `check-headless/`

  * `check_webgpu.mjs`

    * Minimal smoke check that launches headless Chromium and verifies:

      * `navigator.gpu` exists
      * `requestAdapter()` + `requestDevice()` succeed
    * Runs against a `http://127.0.0.1:PORT` page (secure context).

* `test1/`

  * First end-to-end test: compile + run a tiny Futhark program using the WebGPU backend in headless Chromium.

## Run the headless WebGPU environment check

From the `hendrix-ci/` folder:

```bash
node check-headless/check_webgpu.mjs
```

If this prints `{ ok: true, ... }`, headless WebGPU is available on this node.

If it fails with `navigator.gpu missing`, it usually means the check is not running in a secure context (must be served from `localhost/127.0.0.1`) or Chromium flags are missing.

## Run Test 1

```bash
cd test1
make run
```
