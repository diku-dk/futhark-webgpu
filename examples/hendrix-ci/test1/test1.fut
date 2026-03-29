entry main (n: i32) : i32 =
  let n64 = i64.i32 n
  let xs = map (\x -> 1 + i32.i64 x) (iota n64)
  in reduce (+) 0 xs