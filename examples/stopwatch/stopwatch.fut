-- stopwatch.fut
--
-- same overall idea as the tunnel example:
-- javascript keeps the timer and calls main(time, h, w) every frame.
-- the futhark program only computes the pixels for one frame.

type vec2 = {x: f32, y: f32}

-- basic 2d vector helpers
def vadd (a: vec2) (b: vec2): vec2 = {x=a.x+b.x, y=a.y+b.y}
def vsub (a: vec2) (b: vec2): vec2 = {x=a.x-b.x, y=a.y-b.y}
def vmul (a: vec2) (k: f32): vec2 = {x=a.x*k, y=a.y*k}
def vdot (a: vec2) (b: vec2): f32 = a.x*b.x + a.y*b.y
def vlen (a: vec2): f32 = f32.sqrt (vdot a a)

-- fractional part of a float
def fract(x: f32): f32 =
  x - f32.i32(i32.f32 x)

-- clamp x into the interval [lower, upper]
def clamp(lower: f32, x: f32, upper: f32): f32 =
  if x < lower then lower
  else if x > upper then upper
  else x

-- smooth transition between 0 and 1
-- this is used a lot to make edges softer
def smoothstep(edge0: f32, edge1: f32, x: f32): f32 =
  let t = clamp(0f32, (x - edge0) / (edge1 - edge0), 1f32)
  in t * t * (3f32 - 2f32 * t)

-- distance from point p to the line segment from a to b
-- this is used for drawing tick marks
def dist_segment(p: vec2, a: vec2, b: vec2): f32 =
  let pa = vsub p a
  let ba = vsub b a
  let denom = vdot ba ba
  let h =
    if denom == 0f32 then 0f32
    else clamp(0f32, vdot pa ba / denom, 1f32)
  in vlen (vsub pa (vmul ba h))

-- draw a circle outline
-- r is the radius
-- w is half the stroke width
-- the extra 0.004 is just a small soft edge
def circle_stroke(p: vec2, r: f32, w: f32): f32 =
  let d = f32.abs (vlen p - r)
  in 1f32 - smoothstep(w, w + 0.004f32, d) -- 1 - because we want 1 inside the stroke and 0 outside

-- draw a line segment with soft edges
-- w is half the stroke width
def line_stroke(p: vec2, a: vec2, b: vec2, w: f32): f32 =
  let d = dist_segment(p, a, b)
  in 1f32 - smoothstep(w, w + 0.004f32, d)

-- draw a filled circle
-- r is the radius
def filled_circle(p: vec2, r: f32): f32 =
  1f32 - smoothstep(r, r + 0.004f32, vlen p)

def pi(): f32 = 3.141592653589793f32

-- pack rgba floats in [0,1] into one u32 pixel
-- the 255 scales to byte values
def rgba_u32 (r: f32) (g: f32) (b: f32) (a: f32): u32 =
  let cc (x: f32) = clamp(0f32, x, 1f32)
  let ri = u32.f32 (cc r * 255f32)
  let gi = u32.f32 (cc g * 255f32)
  let bi = u32.f32 (cc b * 255f32)
  let ai = u32.f32 (cc a * 255f32)
  in (ai << 24) | (bi << 16) | (gi << 8) | ri

-- draw the 12 hour marks around the clock
-- 2*pi is a full turn, so i/12 steps around the whole circle
-- subtracting pi/2 makes 0 start at the top instead of to the 9 pos
--
-- 0.66 and 0.78 were chosen by eye:
-- they say where the tick starts and ends, relative to the center
-- smaller numbers are more inside the clock
--
-- 0.010 is the tick thickness
def tick_marks(p: vec2): f32 =
  loop acc = 0f32 for i < 12 do
    let ang = 2f32 * pi() * (f32.i32 i) / 12f32 - pi()/2f32
    let dir = {x = f32.cos ang, y = f32.sin ang}
    let a = vmul dir 0.66f32
    let b = vmul dir 0.78f32
    in acc + line_stroke(p, a, b, 0.010f32)

-- make a soft band that is 1 inside [lo, hi] and fades near the edges
-- feather says how soft the edge should be
def band(lo: f32, hi: f32, x: f32, feather: f32): f32 =
  smoothstep(lo - feather, lo, x) *
  (1f32 - smoothstep(hi, hi + feather, x))

-- draw a hand as a rotated rectangle
--
-- dir is the hand direction
-- back says how much the hand extends behind the center
-- front says how much it extends forward
-- half_w is half the hand width
--
-- 0.01 and 0.006 are just small soft edges so the hand does not look jagged
def hand_mask(p: vec2, dir: vec2, back: f32, front: f32, half_w: f32): f32 =
  let perp = {x = -dir.y, y = dir.x}
  let u = vdot p dir
  let v = f32.abs (vdot p perp)
  let along = band(-back, front, u, 0.01f32)
  let across = 1f32 - smoothstep(half_w, half_w + 0.006f32, v)
  in along * across

-- compute the colour of one pixel
def stopwatch_pixel (time: f32) (p: vec2): u32 =
  -- distance from the center
  let r = vlen p

  -- small pulsing value for the background
  -- 1.5 controls how fast the pulse moves
  let pulse = 0.5f32 + 0.5f32 * f32.sin(time * 1.5f32)

  -- base background colour
  -- the (1 - clamp(...)) part makes the center a bit brighter than the outside
  -- the pulse terms make the background slowly flash
  --
  -- these values were chosen by eye for a dark blue background
  let base_r = 0.03f32 + 0.02f32 * (1f32 - clamp(0f32, r, 1f32)) + 0.01f32 * pulse
  let base_g = 0.05f32 + 0.03f32 * (1f32 - clamp(0f32, r, 1f32)) + 0.02f32 * pulse
  let base_b = 0.10f32 + 0.06f32 * (1f32 - clamp(0f32, r, 1f32)) + 0.04f32 * pulse

  -- the two rings of the stopwatch face
  -- 0.82 is the outer ring radius
  -- 0.62 is the inner ring radius
  -- 0.010 and 0.008 are the ring thicknesses
  let outer = circle_stroke(p, 0.82f32, 0.010f32)
  let inner = circle_stroke(p, 0.62f32, 0.008f32)
  let ticks = tick_marks(p)

  -- small center dot
  -- 0.020 is its radius
  let center = filled_circle(p, 0.020f32)

  -- hand angles
  --
  -- time / 60 makes the second hand do one full turn per 60 seconds
  -- time / 3600 makes the minute hand do one full turn per 3600 seconds = 60 minutes
  -- fract keeps only the part inside the current full turn
  -- subtracting pi/2 means the hands start at the top at time = 0
  let sec_ang = 2f32 * pi() * fract(time / 60f32) - pi()/2f32
  let min_ang = 2f32 * pi() * fract(time / 3600f32) - pi()/2f32

  let sec_dir = {x = f32.cos sec_ang, y = f32.sin sec_ang}
  let min_dir = {x = f32.cos min_ang, y = f32.sin min_ang}

  -- the second hand is longer and thinner
  -- back = 0.09 means it goes a little behind the center
  -- front = 0.66 means it reaches fairly close to the ring
  -- half_w = 0.006 makes it thin
  let sec_hand = hand_mask(p, sec_dir, 0.09f32, 0.66f32, 0.006f32)

  -- the minute hand is shorter and thicker
  let min_hand = hand_mask(p, min_dir, 0.05f32, 0.44f32, 0.014f32)

  -- darken the outer area of the image a bit
  -- 0.95 is where the darkening starts
  -- 1.28 is where it is almost fully faded out
  let vignette = 1f32 - smoothstep(0.95f32, 1.28f32, r)

  -- final red channel
  -- these weights were chosen by eye to mix the different parts together
  -- for example, the hands get large weights so they stand out clearly
  let rr =
    (base_r
     + 0.08f32 * outer
     + 0.05f32 * inner
     + 0.18f32 * ticks
     + 0.92f32 * min_hand
     + 0.95f32 * sec_hand
     + 0.90f32 * center) * vignette

  -- final green channel
  let gg =
    (base_g
     + 0.14f32 * outer
     + 0.10f32 * inner
     + 0.40f32 * ticks
     + 0.82f32 * min_hand
     + 0.28f32 * sec_hand
     + 0.82f32 * center) * vignette

  -- final blue channel
  -- blue has the biggest ring and tick weights, which is why the face looks blue
  let bb =
    (base_b
     + 0.28f32 * outer
     + 0.24f32 * inner
     + 0.78f32 * ticks
     + 0.72f32 * min_hand
     + 0.12f32 * sec_hand
     + 0.72f32 * center) * vignette

  in rgba_u32 rr gg bb 1f32

entry main (time: f32) (h: i32) (w: i32) =
  let hi = i64.i32 h
  let wi = i64.i32 w

  -- use the smaller of width and height so the clock stays circular
  let min_wh = if h < w then f32.i32 h else f32.i32 w

  in tabulate_2d hi wi (\yy xx ->
       -- move pixel coordinates so (0,0) is the center of the canvas
       let cx = i32.i64 (xx - wi / 2)
       let cy = i32.i64 (yy - hi / 2)

       -- convert from pixel coordinates to a normalized coordinate system
       -- the * 2.0 means the smaller canvas dimension roughly maps to [-1, 1]
       let p =
         { x = f32.i32 cx / min_wh * 2.0f32
         , y = f32.i32 cy / min_wh * 2.0f32
         }

       in stopwatch_pixel time p)