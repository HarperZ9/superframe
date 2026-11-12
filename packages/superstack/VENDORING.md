<!-- writing-profile: procedure -->
# Vendoring a superstack file

An engine uses the contract by copying one file into its own tree and pinning that file's SHA-256. There is no package to install and nothing to fetch at run time. The engine's CI then checks two things: the copy still has the pinned hash, and it still passes the shared vectors.

## 1. Choose the file

| Language | File | Needs |
|---|---|---|
| Python | `superstack.py` | Python 3.11 or later, standard library only |
| JavaScript | `superstack.mjs` | Any browser with ES modules, or Node 20 or later |
| C++ | `superstack.hpp` | A C++23 compiler, standard library only |

## 2. Copy it from a release

1. Take the file from a tagged release, for example `v0.2.0`, never from a branch.
2. Take `SHA256SUMS` from the same tag. It lists the hash of each implementation.
3. Copy the file byte for byte. You may rename it (the site keeps it as `system/media-engine/contracts.mjs`). Do not edit it: any change, even whitespace, changes the hash.
4. Keep LF line endings. Add this line to your `.gitattributes`, with your own path:

   ```
   system/media-engine/contracts.mjs text eol=lf
   ```

   Without it, a Windows checkout with `core.autocrlf` rewrites the line endings and the hash check fails.

5. Record the pin next to the copy, for example in a `SUPERSTACK.sha256` file or a comment in your build config:

   ```
   <sha256 from SHA256SUMS>  system/media-engine/contracts.mjs  superstack.mjs v0.2.0
   ```

The file carries its whole licence notice: FSL-1.1-MIT from v0.2.0, the MIT text it turns into, and the notices for the public domain algorithms it contains. The copy needs nothing else to meet the licence. Releases up to v0.1.0 remain MIT. `docs/LICENSING.md` covers vendoring into each consumer.

## 3. Check the copy in CI

`tools/check_vendored.py` uses only the Python standard library. Copy it alongside, or run it from a checkout of this repository:

```
python tools/check_vendored.py system/media-engine/contracts.mjs --expect <pinned sha256>
python tools/check_vendored.py vendor/superstack.py --sums SHA256SUMS
python tools/check_vendored.py system/media-engine/contracts.mjs --sums SHA256SUMS --as superstack.mjs
```

It prints MATCH and exits 0 when the bytes match, and prints DRIFT and exits 1 otherwise. When the only difference is CRLF line endings, it says so.

Without Python, any SHA-256 tool works:

```
sha256sum vendor/superstack.hpp                                  # Linux
Get-FileHash vendor\superstack.hpp -Algorithm SHA256             # PowerShell
node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync(process.argv[1])).digest('hex'))" vendor/superstack.mjs
```

## 4. Run the vectors in your CI

A hash match shows the file is unchanged. The vectors show it still behaves as the contract says on your runtime: your Python, your Node, your compiler.

1. Copy `vectors/` from the same tag.
2. Run the runner for your language from the same tag:
   - `python tests/run_vectors.py --impl <your copy>`
   - `node tests/run_vectors.mjs --impl <your copy>`
   - C++: build `tests/run_vectors.cpp` with `-I` pointing at the folder that holds `superstack.hpp`, then run it with the folder that holds `vectors/`.
3. Fail the build on a non-zero exit.

Each runner checks `vectors/MANIFEST.json` first, so a vector file that was edited by hand fails too.

## 5. Upgrade

1. Read the release notes and the changes to `SPEC.md`.
2. Copy the new file, the new `SHA256SUMS` and the new `vectors/`.
3. Update the pin in the same commit.
4. Run your own suite. A rule change that alters bytes comes with a new rule id (SPEC.md section 12), so artefacts already made under the old id keep verifying.

## 6. Do not

- Do not import the file from a URL at run time. The pin is the point.
- Do not patch the copy. Open an issue or a pull request here, so all three languages change together under new vectors.
- Do not mix files from different releases in one project.
