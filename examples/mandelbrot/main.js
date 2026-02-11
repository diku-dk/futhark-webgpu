async function run() {
  const m = await Module();
  const fut = new FutharkModule();
  await fut.init(m);

  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  const width = canvas.width;
  const height = canvas.height;
  const max_depth = 50;
  const [xmin, xmax] = [-1.7, 1.1];
  const [ymin, ymax] = [-1.4, 1.4];

  const [buf] = await fut.entry.main(
    BigInt(width),
    BigInt(height),
    max_depth,
    xmin,
    ymin,
    xmax,
    ymax,
  );
  const vals = await buf.values();

  // vals is Int32Array; canvas expects bytes (RGBA), so use length*4 like in the thesis listing :contentReference[oaicite:3]{index=3}
  const colors = new Uint8Array(vals.buffer, vals.byteOffset, vals.length * 4);
  setColors(ctx, colors, width, height);

  buf.free();
}

function setColors(ctx, colors, width, height) {
  const imgData = ctx.createImageData(width, height);
  imgData.data.set(colors);
  ctx.putImageData(imgData, 0, 0);
}

window.addEventListener("load", run);
