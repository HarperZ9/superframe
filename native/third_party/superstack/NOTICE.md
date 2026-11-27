# Vendored: superstack (MIT)

This directory holds files copied byte for byte from `packages/superstack/` (originally [HarperZ9/superstack](https://github.com/HarperZ9/superstack)), the shared
contract for renderers and sound engines:

- `superstack.hpp`: the C++23 implementation, header only, standard library only.
- `tests/run_vectors.cpp`: the contract's C++ vector runner.
- `superstack.mjs`: the JavaScript implementation, which the sound engine in
  `web/sound/` uses for the seed rule, the quantizer, the BS.1770 meter and receipts.
- `examples/sound/`: the contract's example sound scene and its JavaScript
  renderer. Its PCM (`692ead20...`) is the vector the sound engine must reproduce
  sample for sample.
- `vectors/`: the contract's test vectors, pinned by `vectors/MANIFEST.json`.

`LICENSE.txt` carries the MIT License and the notices for the public-domain/MIT
algorithms listed in the header. Release archives ship it as `LICENSE-superstack.txt`.

**Licence.** These files are under the MIT License (`MIT`), the same licence as the rest
of raw-native and superframe. The header names the algorithms by others that it contains
(mulberry32, xmur3, the OKLab matrices and the libebur128 K-weighting constants).
Each keeps its own terms, and their notices are kept word for word in `LICENSE.txt`.

**Pin.** `SUPERSTACK.sha256` records the SHA-256 of each copied file (the header's hash
equals the one in `packages/superstack/SHA256SUMS`). CI checks the pins on every push
and runs the vectors against the header on each compiler raw-native builds with.
`.gitattributes` keeps these files at LF line endings so a Windows checkout does not
change their bytes.
