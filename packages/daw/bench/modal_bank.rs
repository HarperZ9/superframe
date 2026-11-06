// SPDX-License-Identifier: FSL-1.1-MIT
// Modal bank cost: N two-pole resonators driven by one input, summed, per sample.
use std::time::Instant;
fn main() {
    let n_modes: usize = std::env::args().nth(1).map(|s| s.parse().unwrap()).unwrap_or(1024);
    let fs = 48000usize; let s = fs * 2;
    let mut a1 = vec![0f32; n_modes]; let mut a2 = vec![0f32; n_modes]; let b = vec![1.0f32 / n_modes as f32; n_modes];
    let (mut y1, mut y2) = (vec![0f32; n_modes], vec![0f32; n_modes]);
    for k in 0..n_modes {
        let f = 50.0 + 15.0 * k as f64; let r = (-3.0 / fs as f64).exp();
        a1[k] = (2.0 * r * (2.0 * std::f64::consts::PI * f / fs as f64).cos()) as f32; a2[k] = (r * r) as f32;
    }
    let mut out = vec![0f32; s];
    let t0 = Instant::now();
    for n in 0..s {
        let x = if n == 0 { 1.0f32 } else { 0.0 }; let mut acc = 0f32;
        for k in 0..n_modes {
            let y = a1[k] * y1[k] - a2[k] * y2[k] + b[k] * x; y2[k] = y1[k]; y1[k] = y; acc += y;
        }
        out[n] = acc;
    }
    let dt = t0.elapsed().as_secs_f64();
    println!("{{\"lang\":\"rust\",\"modes\":{},\"seconds_audio\":2,\"wall\":{:.4},\"check\":{:e}}}", n_modes, dt, out[s - 1]);
}
