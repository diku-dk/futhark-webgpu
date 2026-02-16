-- Produces packed ARGB pixels: 0xAARRGGBB

let color_for (x:i32) (w:i32) : u32 =
  let stripe_w = w / 4
  let s = x / stripe_w
  in if s == 0 then 0xFFFF0000u32
     else if s == 1 then 0xFF00FF00u32
     else if s == 2 then 0xFF0000FFu32
     else 0xFFFFFFFFu32

entry render (w:i32) (h:i32) : []u32 =
  let w64 = i64.i32 w
  let h64 = i64.i32 h
  let n   = w64 * h64
  in tabulate n (\i ->
       let x = i32.i64 (i % w64)
       in color_for x w)
