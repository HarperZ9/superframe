<!-- writing-profile: procedure -->
# Changelog

## 0.2.0 (unreleased)

### Licence

From v0.2.0, code is licensed FSL-1.1-MIT. Earlier releases remain under MIT.

- `LICENSE` is the Functional Source License, Version 1.1, MIT Future License, with licensor Zain Dana Harper. Each release becomes available under MIT two years after it ships.
- The three implementation files carry the FSL-1.1-MIT notice, the MIT text it turns into, and the notices for mulberry32, xmur3 and the OKLab matrices, kept word for word.
- Prose stays CC BY 4.0 (`LICENSE-TEXT`).
- `docs/LICENSING.md` and `VENDORING.md` describe the change and what it means for each engine that vendors a file.

### Fixed

- `superstack.hpp` compiles under Emscripten. Value's constructors are now defined after `struct Member`, and its variant has no default member initializer, so libc++ never builds the variant while `Member` is incomplete. No rule changed: the vectors are the same and pass in all three languages.

### CI

- A wasm job builds the C++ runner with em++ (emsdk 6.0.11, pinned), runs the vectors in Node and requires the same check counts as the Python runner.

### Pins

The headers changed, so all three hashes changed. Engines re-pin from `SHA256SUMS` at the v0.2.0 tag.

## 0.1.0

First release of contract `superstack/0`, under MIT.
