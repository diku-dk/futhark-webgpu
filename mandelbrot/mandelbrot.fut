-- Adapted from futhark/tests/rosettacode/mandelbrot.fut

type complex = (f32, f32)

def dot ((r, i): complex) : f32 =
  r * r + i * i

def multComplex ((a, b): complex) ((c, d): complex) : complex =
  (a * c - b * d, a * d + b * c)

def addComplex ((a, b): complex) ((c, d): complex) : complex =
  (a + c, b + d)

def divergence (depth: i32) (c0: complex) : i32 =
  (.1) (loop (c, i) = (c0, 0)
        while i < depth && dot c < 4.0 do
          (addComplex c0 (multComplex c c), i + 1))

def rgba (r: u8) (b: u8) (g: u8) (a: u8) : i32 =
  (i32.u8 a << 24) | (i32.u8 b << 16) | (i32.u8 g << 8) | (i32.u8 r << 0)

def color (depth: i32) (div: i32) : i32 =
  if div >= depth
  then rgba 0 0 0 255
  else let quot = f32.i32 div / f32.i32 depth
       let value = u8.f32 (255 * quot)
       in if quot > 0.5
          then rgba value value 255 255
          else rgba 0 0 value 255

def main (screenX: i64)
         (screenY: i64)
         (depth: i32)
         (xmin: f32)
         (ymin: f32)
         (xmax: f32)
         (ymax: f32) : [screenY][screenX]i32 =
  let sizex = xmax - xmin
  let sizey = ymax - ymin
  in map (\y : [screenX]i32 ->
            map (\x : i32 ->
                   let c0 =
                     ( xmin + (f32.i64 x * sizex) / f32.i64 screenX
                     , ymin + (f32.i64 y * sizey) / f32.i64 screenY
                     )
                   in color depth (divergence depth c0))
                (iota screenX))
         (iota screenY)
