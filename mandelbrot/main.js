// The compiled Futhark program is an ES module that exports FutharkContext.
import { FutharkContext } from "./build/mandelbrot.mjs";

async function run() {
  const fut = new FutharkContext();
  await fut.init();

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  const width = canvas.width;
  const height = canvas.height;
  const max_depth = 50;
  const [xmin, xmax] = [-1.7, 1.1];
  const [ymin, ymax] = [-1.4, 1.4];

  // The i64 parameters accept plain numbers as well as BigInts.
  const buf = await fut.entry.main(width, height, max_depth, xmin, ymin, xmax, ymax);
  const vals = await buf.values();
  buf.free();

  // 'vals' is an Int32Array of pixels whose bytes are already in the RGBA order
  // that the canvas expects, so we can reinterpret it as bytes and copy it in.
  const colors = new Uint8Array(vals.buffer, vals.byteOffset, vals.length * 4);
  setColors(ctx, colors, width, height);

  fut.free();
}

function setColors(ctx, colors, width, height) {
  const imgData = ctx.createImageData(width, height);
  imgData.data.set(colors);
  ctx.putImageData(imgData, 0, 0);
}

// A module script runs after the document has been parsed, so the canvas exists.
run().catch((e) => {
  console.error(e);
  document.body.append(`Failed: ${e.message}`);
});
