- **BuildLang renderer parity expanded from 9 of 9 to 11 of 11 (`art_sky.bld` + `art_brdf.bld`).**
  Ported analytic Preetham/CIE sky baking (`src/renderer/sky.cpp`, `0x4774e06b9efdb90d`) and
  GGX-VNDF / Smith / Schlick / Gauss-Legendre 64 specular BRDF evaluation (`src/renderer/brdf.cpp`,
  `0xe8d741020e6f146a`) to `native/bld/`, pinning both bit-exact hashes in `tests/test_sky.cpp`
  and `tests/test_brdf_furnace.cpp` across GCC and MSVC with fail-closed planted controls.
