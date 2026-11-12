# CLAUDE.md: superstack

Contract repo: SPEC.md plus one single-file implementation per language.

- A rule change touches SPEC.md, `tools/make_vectors.py`, all three of
  `superstack.py`, `superstack.mjs` and `superstack.hpp`, and
  `tests/mutations.json`, in one commit. Regenerate the vectors with
  `python tools/make_vectors.py` and `SHA256SUMS` with `sha256sum`.
- Before a commit: `python tests/run_vectors.py`, `node tests/run_vectors.mjs`,
  the C++ runner (tests/CMakeLists.txt), `python tests/mutate.py`,
  `python tools/check_dashes.py`.
- The implementations stay dependency-free: Python standard library, plain ES
  module, C++23 standard library.
- Prose: no em or en dashes; keep honest nulls and does-not-prove lines.
- Never commit `.env`, keys or tokens. Narration API keys never enter receipts.
