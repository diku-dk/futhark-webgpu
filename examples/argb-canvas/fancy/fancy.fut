-- fancy.fut
-- Output: packed ARGB pixels (0xAARRGGBB)

let clamp01 (x:f32) : f32 =
  f32.max 0.0f32 (f32.min 1.0f32 x)

let fract (x:f32) : f32 =
  x - f32.floor x

-- HSV in [0,1] -> RGB in [0,1]
let hsv2rgb (h:f32) (s:f32) (v:f32) : (f32, f32, f32) =
  let k0 = 1.0f32
  let k1 = 2.0f32 / 3.0f32
  let k2 = 1.0f32 / 3.0f32
  let k3 = 3.0f32

  let p0 = f32.abs (fract (h + k0) * 6.0f32 - k3)
  let p1 = f32.abs (fract (h + k1) * 6.0f32 - k3)
  let p2 = f32.abs (fract (h + k2) * 6.0f32 - k3)

  let r = v * (k0 - s * f32.max 0.0f32 (f32.min k0 (p0 - k0)))
  let g = v * (k0 - s * f32.max 0.0f32 (f32.min k0 (p1 - k0)))
  let b = v * (k0 - s * f32.max 0.0f32 (f32.min k0 (p2 - k0)))
  in (r, g, b)

let pack_argb (a:u32) (r:u32) (g:u32) (b:u32) : u32 =
  (a << 24) | (r << 16) | (g << 8) | b

entry render (w:i32) (h:i32) : []u32 =
  let w64 = i64.i32 w
  let h64 = i64.i32 h
  let n   = w64 * h64

  in tabulate n (\i ->
       let x_i32 = i32.i64 (i % w64)
       let y_i32 = i32.i64 (i / w64)

       let fx = (f32.i32 x_i32 + 0.5f32) / f32.i32 w
       let fy = (f32.i32 y_i32 + 0.5f32) / f32.i32 h

       -- center to [-1,1]
       let cx = 2.0f32 * fx - 1.0f32
       let cy = 2.0f32 * fy - 1.0f32

       let radsq = cx*cx + cy*cy
       let rad   = f32.sqrt radsq

       -- hue from angle
       let pi  = 3.14159265f32
       let ang = f32.atan2 cy cx          -- [-pi, pi]
       let hue = fract (ang / (2.0f32*pi) + 0.5f32)

       let sat = 0.85f32
       let v = 0.95f32
       let (rr, gg, bb) = hsv2rgb hue sat v

       -- alpha fades outward + checker modulation
       let base_a = clamp01 (1.0f32 - rad * 1.15f32)
       let checker =
         let cx8 = (x_i32 / 8) % 2
         let cy8 = (y_i32 / 8) % 2
         in if cx8 == cy8 then 1.0f32 else 0.85f32

       let a_f = clamp01 (base_a * checker)

       let to_u8 (x:f32) : u32 =
         u32.i32 (i32.f32 (clamp01 x * 255.0f32))

       let a = to_u8 a_f
       let r = to_u8 rr
       let g = to_u8 gg
       let b = to_u8 bb

       in pack_argb a r g b)
