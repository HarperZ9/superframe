# viable-viz

The Viable Visualization Flagship — the smallest viable instance of the Viable
Visualization Thesis, running the live reconcile loop on real subjects (the workspace
ecosystem graph and nD polytopes), across dimension + scale + sound, with both human
and model perceiving.

---

## Run

```sh
# Ecosystem subject (workspace dependency graph — default)
node viable-viz/flagship.mjs --subject ecosystem

# Polytope subject (4D cube, 16 vertices / 32 edges)
node viable-viz/flagship.mjs --subject polytope:cube:4

# Polytope subject — other kinds and dimensions
node viable-viz/flagship.mjs --subject polytope:simplex:5
node viable-viz/flagship.mjs --subject polytope:cross:4
```

Options:

| Flag             | Default       | Description                                      |
|------------------|---------------|--------------------------------------------------|
| `--subject`      | `ecosystem`   | `ecosystem` or `polytope:kind:n`                 |
| `--endpoint`     | _(none)_      | OpenAI-compatible chat endpoint for model arm    |
| `--key`          | _(none)_      | API key (omit for local Ollama / LM Studio)      |
| `--model`        | `gpt-4o-mini` | Model name to pass to the endpoint               |
| `--width`        | `192`         | Render width in pixels                           |
| `--maxAmplify`   | `6`           | Maximum amplification steps before UNVERIFIABLE  |

Exit code: 0 on CERTIFIED or UNVERIFIABLE (both are honest outcomes); nonzero only on
an actual crash.

---

## Live-model arm (Ollama / Claude Desktop)

The `--endpoint` flag connects the model regulator to any OpenAI-compatible endpoint.
On connection failure the flagship falls back silently to the grounded regulator and
records the reason in the certificate disclosure.

**Ollama (local):**

```sh
# Start Ollama then run with the model arm
ollama serve
node viable-viz/flagship.mjs --subject polytope:cube:4 \
  --endpoint http://localhost:11434/v1/chat/completions \
  --model llama3
```

**LM Studio (local):**

```sh
node viable-viz/flagship.mjs --subject ecosystem \
  --endpoint http://localhost:1234/v1/chat/completions
```

**Claude via a proxy / compatible wrapper:**

```sh
node viable-viz/flagship.mjs --subject polytope:simplex:5 \
  --endpoint https://your-proxy.example.com/v1 \
  --key sk-... \
  --model claude-3-haiku-20240307
```

---

## Tests

```sh
# Run the Task 4 (flagship) tests only
node --test viable-viz/test/flagship.test.mjs

# Run the full viable-viz suite
node --test viable-viz/test/*.test.mjs
```

---

## Disclosure

> Structural, bilateral, reconciled perception with honest UNVERIFIABLE on variety
> deficit. The live-model arm requires a connected model; this is the smallest viable
> instance, not the complete simulator.

---

## Architecture

```
viable-viz/
├── subject.mjs      — polytopeSubject / graphSubject / ecosystemSubject
├── embed.mjs        — embedGraph: deterministic nD spectral layout
├── regulator.mjs    — groundedRegulator / modelRegulator (OpenAI-compatible)
├── reconcile.mjs    — live reconcile loop → Certificate
├── certificate.mjs  — Certificate{verdict, recovered, recheck()} factory
├── flagship.mjs     — runFlagship() orchestrator + CLI entry
└── test/            — node:test suites (zero external deps)
```

The amplification order follows E11 (proven): generic view → multi-view (2nd, 3rd
orthogonal projections) → sound channel (polytopes only). Fail-closed: CERTIFIED is
emitted only when the criterion-invariant is recovered and verified. UNVERIFIABLE is
an honest outcome, not an error.
