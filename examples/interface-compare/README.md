# Interface check (WebGPU vs WASM) — generated JS API comparison

This example is a small introspection tool: it compiles the same `probe.fut` program to both the **WebGPU** backend and the **WASM** backend, then prints what the generated JavaScript interfaces look like.

The goal is to help answer this question:

* "Does choosing WebGPU vs WASM change what the JS interface looks like (entry points, init, types)?"

This example does not run any heavy computations or render anything. It just loads the generated wrappers and prints the API surface in a readable way.

## What you should see

After clicking **Run check**, the output is split into two sections:

* **WASM**

  * lists module exports
  * constructs a `FutharkContext` using `newFutharkContext()`
  * prints the context "shape" (which fields exist)
  * prints the entry point table with input/output types

* **WebGPU**

  * checks that the generated wrapper created the expected globals (`Module`, `FutharkModule`)
  * constructs a `FutharkModule` context and initialises it
  * prints the `fut` object keys and the `fut.entry` keys
  * prints entry point signatures from the manifest
  * prints which manifest types are arrays

The important part is that the entry point names and type signatures should match between backends, even if the loader code is different.

## Files

* `index.html`
  Minimal UI: a button and a `<pre>` output box.

  It loads:

  * `build/probe_webgpu.js` as a normal script (this defines global `Module` + `FutharkModule`)
  * `main.js` as an ES module (so it can `import` the WASM `.mjs` file)

* `main.js`
  The inspection logic:

  * `checkWasm()` imports the WASM wrapper module, creates a context, and prints the entry point table.
  * `checkWebGPU()` creates a WebGPU context from the generated globals and prints the manifest entry points.

* `probe.fut`
  A Futhark program with several entry points used as test cases.

* `Makefile`
  Builds both backends into `build/` and provides a simple `serve` target.

## How `main.js` works

### 1) Output helpers

The UI is just a `<pre>` element. The helper functions:

* `p(line)` appends a line to the output.
* `hr()` prints a separator line.
* `keys(obj)` prints sorted keys for stable output.

### 2) WASM path (`checkWasm`)

The WASM wrapper is an ES module (`probe_wasm.mjs`), so we load it with:

* `const wasmMod = await import("./build/probe_wasm.mjs");`

Then we print:

* `module exports` (what the module exports at top level)
* whether it has:

  * `newFutharkContext()` (the usual entry point for creating a context)
  * a default export loader (often used internally by `newFutharkContext`)

Next, we create the context:

* `ctx = await wasmMod.newFutharkContext();`

Then we print:

* `context keys` (the top-level fields on the context object)

Finally, we print entry point signatures:

* if `ctx.get_entry_points()` exists, we call it and print for each entry:

  * input types
  * output types

At the end, we call `ctx.free()` if it exists.

This produces a summary of the WASM-facing interface, showing what object we get and what entry points we expose.

### 3) WebGPU path (`checkWebGPU`)

The WebGPU wrapper is loaded as a script (`probe_webgpu.js`), which defines globals. So we first check:

* `typeof Module === "function"`
* `typeof FutharkModule === "function"`

Then we initialise:

* `const m = await Module();`
* `const fut = new FutharkModule();`
* `await fut.init(m);`

This gives a context-like `fut` object. We print:

* `fut keys` (fields like `manifest`, `types`, `entry`, etc.)
* `fut.entry keys` (the callable entry points)

Finally, we print entry point signatures from the manifest:

* `fut.manifest.entry_points[name].inputs/outputs`

and we list which manifest types are arrays (by scanning `fut.manifest.types` for `kind == "array"`).

This produces a summary of the WebGPU-facing interface.

## What this example is useful for

* Quickly checking whether both backends generate:

  * the same set of entry points
  * the same input/output type signatures

* Comparing "shape differences", such as:

  * init mechanism (WASM module import + `newFutharkContext` vs WebGPU global `Module` + `FutharkModule`)
  * where entry points live (`ctx.*` / entry table vs `fut.entry.*`)
  * whether types are described via a manifest (WebGPU) or entry point table (WASM)

