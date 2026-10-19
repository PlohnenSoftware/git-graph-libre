// `Math.log` as V8 computes it. V8's `ieee754::log` (src/base/ieee754.cc,
// V8 11.3 to 14.6 measured) is fdlibm's `e_log.c`; this is that function,
// transcribed for the one score VS Code takes a logarithm for
// (`1 + Math.log(1 + length)` in `defaultLinesDiffComputer.ts` L76-L80 at
// microsoft/vscode commit 28a562309973a386b2bdefae78127788a4742fe8).
// Rust's `f64::ln` (the platform libm) differs from V8 on 9,276 of the inputs
// `1 + n`, n in 0..=1,000,000, and the `libm` crate's `log` (musl's rewrite)
// on 727; this port matches V8 on all of them (tests/data/math-log-oracle.txt).
//
// The original fdlibm source code is covered by:
//
// ====================================================
// Copyright (C) 1993 by Sun Microsystems, Inc. All rights reserved.
//
// Developed at SunSoft, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this
// software is freely granted, provided that this notice
// is preserved.
// ====================================================
//
// It was adapted by the V8 project (Copyright 2016 the V8 project authors,
// BSD-3-Clause) and translated into Rust for Git Graph Libre
// (AGPL-3.0-or-later). Microsoft's MIT notice is in LICENSE.mit.

// Shortest decimal forms of the doubles with the bit patterns shown (the
// hexadecimal values fdlibm's comments call "the intended ones").
const LN2_HI: f64 = 0.6931471803691238; // 0x3fe62e42fee00000
const LN2_LO: f64 = 1.9082149292705877e-10; // 0x3dea39ef35793c76
const TWO54: f64 = 1.8014398509481984e+16; // 0x4350000000000000
const ONE_THIRD: f64 = 0.3333333333333333; // 0x3fd5555555555555
const LG1: f64 = 0.6666666666666735; // 0x3fe5555555555593
const LG2: f64 = 0.3999999999940942; // 0x3fd999999997fa04
const LG3: f64 = 0.2857142874366239; // 0x3fd2492494229359
const LG4: f64 = 0.22222198432149784; // 0x3fcc71c51d8e78af
const LG5: f64 = 0.1818357216161805; // 0x3fc7466496cb03de
const LG6: f64 = 0.15313837699209373; // 0x3fc39a09d078c69f
const LG7: f64 = 0.14798198605116586; // 0x3fc2f112df3e5244

/// The signed high 32 bits of a double (`GET_HIGH_WORD`).
fn high_word(x: f64) -> i32 {
    (x.to_bits() >> 32) as u32 as i32
}

/// `x` with its high 32 bits replaced (`SET_HIGH_WORD`).
fn with_high_word(x: f64, high: i32) -> f64 {
    f64::from_bits((u64::from(high as u32) << 32) | (x.to_bits() & 0xFFFF_FFFF))
}

/// `Math.log(x)`, bit for bit as V8 computes it. Calls, in order, the
/// argument reduction (here), then either [`log_near_one`] (`-2**-20 <= f <
/// 2**-20`) or [`log_polynomial`].
pub fn math_log(x: f64) -> f64 {
    let mut x = x;
    let mut k: i32 = 0;
    let mut hx = high_word(x);
    if hx < 0x0010_0000 {
        // x < 2**-1022
        if ((hx & 0x7FFF_FFFF) as u32 | (x.to_bits() as u32)) == 0 {
            return f64::NEG_INFINITY;
        }
        if hx < 0 {
            return f64::NAN;
        }
        k -= 54;
        x *= TWO54; // subnormal number, scale up x
        hx = high_word(x);
    }
    if hx >= 0x7FF0_0000 {
        return x + x;
    }
    k += (hx >> 20) - 1023;
    hx &= 0x000F_FFFF;
    let i = (hx + 0x95F64) & 0x0010_0000;
    x = with_high_word(x, hx | (i ^ 0x3FF0_0000)); // normalize x or x/2
    k += i >> 20;
    let f = x - 1.0;
    if (0x000F_FFFF & (2 + hx)) < 3 {
        return log_near_one(f, k);
    }
    log_polynomial(f, k, hx)
}

/// The branch of `log` for `-2**-20 <= f < 2**-20`.
fn log_near_one(f: f64, k: i32) -> f64 {
    if f == 0.0 {
        if k == 0 {
            return 0.0;
        }
        let dk = f64::from(k);
        return dk * LN2_HI + dk * LN2_LO;
    }
    let r = f * f * (0.5 - ONE_THIRD * f);
    if k == 0 {
        return f - r;
    }
    let dk = f64::from(k);
    dk * LN2_HI - ((r - dk * LN2_LO) - f)
}

/// The general branch of `log`: `s = f / (2 + f)` and the degree-14 polynomial,
/// finished one of four ways by `k` and the sign test on `i`.
fn log_polynomial(f: f64, k: i32, hx: i32) -> f64 {
    let s = f / (2.0 + f);
    let dk = f64::from(k);
    let z = s * s;
    let i = hx - 0x6147A;
    let w = z * z;
    let j = 0x6B851 - hx;
    let t1 = w * (LG2 + w * (LG4 + w * LG6));
    let t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
    let r = t2 + t1;
    if (i | j) > 0 {
        let hfsq = 0.5 * f * f;
        if k == 0 {
            f - (hfsq - s * (hfsq + r))
        } else {
            dk * LN2_HI - ((hfsq - (s * (hfsq + r) + dk * LN2_LO)) - f)
        }
    } else if k == 0 {
        f - s * (f - r)
    } else {
        dk * LN2_HI - ((s * (f - r) - dk * LN2_LO) - f)
    }
}

#[cfg(test)]
mod tests {
    use super::math_log;

    #[test]
    fn special_values() {
        assert_eq!(math_log(1.0), 0.0);
        assert_eq!(math_log(0.0), f64::NEG_INFINITY);
        assert!(math_log(-1.0).is_nan());
        assert_eq!(math_log(f64::INFINITY), f64::INFINITY);
        // A subnormal input goes through the scaling branch.
        assert!((math_log(f64::MIN_POSITIVE / 4.0) + 709.782_712_893_384).abs() < 1e-9);
    }
}
