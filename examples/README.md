# Examples of using WebGPU with Futhark

This directory is intended to contain example programs that use Futhark with
WebGPU. Each is an HTML page along with various JavaScript or WASM files.

## Browser requirements

Running WebGPU is a bit intricate and still fragile in some browsers. This
section is intended to contain instructions on how to make it work, and where it
will probably not work.

# Building and running an example

The generated files are kept out of the repository, so you will need to build them yourself. You may follow the instructions below to build and run the examples.

## 1) Compile the Futhark program with the WebGPU backend

Easiest way to do it is using the Makefile from the example directory:

```bash
make
```

You can also do it manually from the example directory (or wherever the `.fut` lives):

```bash
futhark webgpu --library -o example_name example_name.fut
```

This should produce:

* `example_name.js`
* `example_name.wasm`
* `example_name.json` (manifest for the JS wrapper)
* `example_name.c` (the C wrapper for the JS wrapper)
* `example_name.wrapper.js` 

## 2) Serve the folder over HTTP

Again, using the Makefile from the example directory:

```bash
make serve
```

Or manually, from the directory that contains `index.html`:

```bash
python3 -m http.server 8000
```

Open in Chrome:

* `http://localhost:8000/index.html`

