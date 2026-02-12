# Test 1: Futhark WebGPU headless smoke test

This test verifies that a small Futhark program compiled with the **WebGPU backend** can be executed in a **headless Chromium** instance on Hendrix.

It compiles `test1.fut` using:

```bash
futhark webgpu --library -o test1 test1.fut
```

This produces:

* `test1.js`
* `test1.wasm`
* `test1.json` (manifest used by the wrapper)
* `test1.c` (C wrapper source)
* `test1.wrapper.js` (JS wrapper exposing `FutharkModule`)

## Files in this folder

* `test1.fut`

  * Minimal deterministic program:

    * `main(x,y) = x + y`
  * The test calls `main(40,2)` and expects `42`.

* `index.html`

  * Loads generated output as a **classic script**:

    * `test1.js` defines a global `Module()` (Emscripten module initializer) and `FutharkModule`.
  * Initializes:

    * `const m = await Module();`
    * `const fut = new FutharkModule();`
    * `await fut.init(m);`
  * Runs:

    * `const [r] = await fut.entry.main(40, 2);`
  * On success:

    * prints `FUTHARK_WEBGPU_TEST1_OK` to the browser console
    * updates the `<pre id="out">` text to `OK`.

* `serve_test1.mjs`

  * Small static HTTP server that serves this directory on `127.0.0.1`.
  * Adds COOP/COEP headers:

    * `Cross-Origin-Opener-Policy: same-origin`
    * `Cross-Origin-Embedder-Policy: require-corp`
  * These headers enable `crossOriginIsolated` (needed if the runtime uses `SharedArrayBuffer`).

* `run_test1.mjs`

  * Playwright runner:

    * spawns `serve_test1.mjs`
    * launches headless Chromium with WebGPU flags
    * loads `/` (which serves `index.html`)
    * listens to browser console output
    * succeeds only if it sees `FUTHARK_WEBGPU_TEST1_OK`

* `Makefile`

  * `make build`: compiles `test1.fut` to `test1.*` outputs
  * `make run`: builds then runs the headless test
  * `make clean`: removes generated outputs

## Running the test

First time (from `hendrix-ci/`), ensure Playwright is installed:

```bash
npm install
npx playwright install chromium
```

Then run the test:

```bash
cd hendrix-ci/test1
make run
```

To clean generated files:

```bash
make clean
```

## Notes / troubleshooting

* If the runner times out waiting for `FUTHARK_WEBGPU_TEST1_OK`, check:

  * `index.html` is being served (no 404s)
  * generated files exist (`test1.js`, `test1.wasm`, `test1.wrapper.js`, ...)
  * WebGPU works on the node (run `../check-headless/check_webgpu.mjs`)
