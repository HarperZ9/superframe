<!-- writing-profile: research -->
# Directional light from 9 numbers: SH order 2 against maximum entropy (pre-registration)

Written 2026-10-27, before any code ran. The idea comes from arXiv 2608.20429 (maximum-entropy spherical moments, a single-author preprint). I have read only its abstract, so this is a test of the idea, not a reproduction of the paper. Changes after the run go in a dated section at the end.

## The question

Low Water pools the light reaching a point as colour times energy, with no direction (`game/engine/light/field.mjs`). A surface there is lit the same from every side. Storing 9 numbers per point adds direction. Two ways to turn them back into light:

- **SH-2:** the 9 numbers are the spherical-harmonic projection to order 2; irradiance follows by the Ramamoorthi-Hanrahan cosine convolution. Cheap, but it can ring and go negative.
- **MaxEnt-2:** the same 9 numbers are read as moments, and the light is the maximum-entropy density with those moments, `L(w) = exp(sum of lambda_k f_k(w))` over the same 9 basis functions. It is positive by construction. Fitting it takes Newton steps.

The 9 moments are the same data for both, so the comparison isolates the reconstruction.

## Scenes (fixed now; `node tools/moments-study.mjs`, seed 20261027)

- **Truth.** Each scene is 1 to 4 lamps around a point. Each lamp is a von Mises-Fisher lobe with a direction, a sharpness kappa (4 to 200, log-uniform) and a power (log-uniform over 1.5 decades). An optional sky term is uniform with weight 0 to 0.3 of the total.
- **Quadrature.** Integrals use 4096 Fibonacci directions.
- **Sample.** 400 scenes. Irradiance is evaluated for 256 normals.
- **Baseline.** Isotropic: the same total energy spread evenly, the information Low Water has today.

## Measures

1. **RMSE.** The root mean square error of irradiance over the 256 normals, relative to the RMS of the true irradiance.
2. **Negatives.** The share of normals where reconstructed irradiance is below 0.
3. **Win rate.** The share of scenes where one method has lower RMSE than another.
4. **Fit failures.** Scenes where MaxEnt-2's Newton fit does not converge within 60 steps. These are reported and scored as the isotropic baseline (no silent drop).

## Predictions

- **P1.** MaxEnt-2 has no negative irradiance on any normal of any scene. SH-2 has negatives on at least 10 percent of scenes.
- **P2.** MaxEnt-2 beats the isotropic baseline on at least 75 percent of scenes.
- **P3.** On single-lamp scenes with kappa at least 30 (a compact lamp), MaxEnt-2 beats SH-2 on at least 60 percent of scenes.
- **P4.** Over all scenes, the two are within 25 percent of each other in median relative RMSE. I do not predict a winner overall.

## Controls

- **C1, sanity.** A uniform sky with no lamps: all three methods must be exact (relative RMSE under 1e-6).
- **C2, must fail.** Shuffled moments: each scene reconstructed from another scene's 9 numbers must lose to the isotropic baseline on most scenes (at least 75 percent). If it does not, the RMSE measure is not reading direction.

## Ways this could mislead

- **Lamps as smooth lobes.** Real point lamps are sharper, and a delta has no finite maximum-entropy fit. kappa up to 200 stands in for that.
- **Irradiance only.** No shadows, no specular, and no colour; one channel.
- **Not the paper's model.** The paper's parameterisation (it reports 5 numbers per sample in places) may differ from these 9.

## Result, 2026-10-27 (after the run)

`node tools/moments-study.mjs`, output in `out/moments/result.json`. Ten seconds for 400 scenes, with no fit failures.

| Measure | SH-2 | MaxEnt-2 | Isotropic |
|---|---|---|---|
| Median relative RMSE, all scenes | 0.046 | 0.019 | 0.655 |
| Scenes with any negative irradiance | 43% | 0% | 0% |
| MaxEnt-2 wins, all scenes | | 98.3% | |
| MaxEnt-2 wins, 1 / 2 / 3 / 4 lamps | | 100 / 100 / 97.8 / 95.7% | |

- **P1: holds.** MaxEnt-2 is never negative; SH-2 goes negative on 43% of scenes.
- **P2: holds.** MaxEnt-2 beats the isotropic baseline on every scene.
- **P3: holds, but it was close to guaranteed.** MaxEnt-2 wins all 45 compact single-lamp scenes. The pre-registered lamps are vMF lobes, `exp(kappa mu . w)`, which lie inside MaxEnt-2's own family, so one lamp is reproduced almost exactly (median 0.0016). I saw this only after the run.
- **P4: fails.** I predicted the two would be within 25% in median error with no winner. MaxEnt-2's median error is 2.5 times smaller than SH-2's.
- **C1: fails its stated threshold, for an understood reason.** On a uniform sky, SH-2 and the isotropic baseline come out at 2.0e-5 relative error, not under 1e-6. The truth is integrated with 4096 Fibonacci directions and SH-2 with the exact cosine convolution, and 2e-5 is that quadrature's floor, about 2000 times smaller than the effects measured. MaxEnt-2 shares the quadrature with the truth and comes out at 6e-14. This favours MaxEnt-2 by at most that floor.
- **C2: holds.** Light read from another scene's 9 numbers loses to the isotropic baseline on 82% of scenes for both methods, so the measure reads direction.

**Robustness check, not pre-registered** (`--lamp cone`, `out/moments/result-cone.json`). The lamps here are hard-edged discs of uniform radiance with the same angular spread, which are outside both methods' families.
- Median relative RMSE: 0.054 for SH-2 and 0.023 for MaxEnt-2.
- MaxEnt-2 wins on 98.3% of scenes, and on 93% of compact single lamps.
- SH-2 is negative on 54% of scenes, MaxEnt-2 on none.
- Three fits failed; they were scored as isotropic, as pre-registered.

The advantage survives a lamp shape that MaxEnt-2 cannot represent exactly.

**The research file's control does not hold here.** The research notes proposed two lamps on opposite sides as a case where MaxEnt must lose to SH-2. With 9 moments it does not: the second-order terms represent antipodal pairs well.

| Lamps (10 degree discs) | SH-2 | MaxEnt-2 |
|---|---|---|
| Opposite, equal | 0.112 | 0.002 |
| Opposite, unequal | 0.090 | 0.002 |
| 90 degrees apart | 0.077 | 0.002 |
| Three at 120 degrees, one plane | 0.059 | 0.036 |

The planar three-lamp case is where MaxEnt-2 is weakest. The paper's own failure case may concern a smaller parameter set (it mentions 5 numbers); unknown, since I read only its abstract.

**Cost.**
- A fit takes 10 to 14 Newton steps, 5 to 10 ms per probe in JavaScript with 4096 directions. That is acceptable in a light bake.
- Evaluating MaxEnt-2 irradiance needs an integral over the sphere, so at run time a probe would store a small baked irradiance table (for example an 8 by 8 octahedral map) or higher-order SH of the MaxEnt-2 irradiance. Neither is built or tested.

**For Low Water.** `field.mjs` pools light as colour times energy, the isotropic column above, with median error 0.66. Storing the 9 numbers and reading them back with MaxEnt-2 at bake time would cut that to about 0.02 on these scenes, with no negative light. This is a proposal for the light model's owner; Low Water's files are unchanged. Test: `superframe tests/moments.test.mjs`.

**Does not prove.**
- One channel, irradiance only: no shadows, no specular, no colour.
- Synthetic lamps.
- It is not a reproduction of arXiv 2608.20429.
