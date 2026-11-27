# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Native engine-receipt/1 emitter and verifier for Superframe engines.

Emits canonical SHA-256 verification envelopes compatible with the
Flywheel engine-receipt/1 bridge (in-toto Statement/v1 + EngineReceipt/v1).

Fail-closed rules:
  - No executed oracle command -> verdict is UNVERIFIABLE.
  - Non-zero oracle exit code or any fail marker in output -> verdict is DRIFT.
  - Only an executed exit-0 oracle with zero fail markers promotes to MATCH.

Pure Python standard library. Every function <= 50 lines.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

SCHEMA = "engine-receipt/1"
IN_TOTO_STATEMENT = "https://in-toto.io/Statement/v1"
PREDICATE_TYPE = "https://flywheel.dev/EngineReceipt/v1"
PASS_LINE_RE = re.compile(r"^\s*(\[PASS\]|PASS\b|ok\b|.*\bsame$)")
FAIL_LINE_RE = re.compile(r"^\s*(\[FAIL\]|FAIL:|FAILED\b|ERROR:|.*\bDIFF$)")


def canonical_bytes(obj: object) -> bytes:
    """Serialize obj to canonical compact ASCII JSON bytes."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def sha256_bytes(data: bytes) -> str:
    """Return prefixed SHA-256 digest of bytes."""
    return "sha256:" + hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> tuple[str, int]:
    """Stream-hash a file and return (prefixed_sha256, byte_size)."""
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
            size += len(chunk)
    return "sha256:" + digest.hexdigest(), size


def git_meta(root: Path) -> dict[str, str]:
    """Read commit metadata from root if it is a git repository."""
    def _run(args: list[str]) -> str:
        try:
            proc = subprocess.run(
                ["git", "-C", str(root)] + args,
                capture_output=True,
                text=True,
                timeout=10,
            )
            return proc.stdout.strip() if proc.returncode == 0 else ""
        except OSError:
            return ""

    return {
        "commit": _run(["rev-parse", "HEAD"]),
        "short_commit": _run(["rev-parse", "--short", "HEAD"]),
        "branch": _run(["rev-parse", "--abbrev-ref", "HEAD"]),
        "subject": _run(["log", "-1", "--format=%s"]),
    }


def collect_artifacts(root: Path, paths: Sequence[Path | str]) -> list[dict]:
    """Resolve and SHA-256 hash every unique artifact file."""
    resolved_root = Path(root).resolve()
    items: list[dict] = []
    for path in sorted({Path(p).resolve() for p in paths}):
        if not path.is_file():
            raise FileNotFoundError(f"artifact not found: {path}")
        digest, size = sha256_file(path)
        try:
            rel = str(path.relative_to(resolved_root)).replace("\\", "/")
        except ValueError:
            rel = path.name
        items.append({"rel_path": rel, "abs_path": str(path), "sha256": digest, "bytes": size})
    return items


def run_oracle(command: Sequence[str], cwd: Path, timeout: int = 120) -> dict:
    """Execute an oracle command and record exit status and output digests."""
    cmd_list = [str(c) for c in command]
    proc = subprocess.run(
        cmd_list,
        cwd=str(cwd),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
    stdout = proc.stdout or ""
    stderr = proc.stderr or ""
    combined = stdout + ("\n" + stderr if stderr else "")
    pass_count = sum(1 for ln in combined.splitlines() if PASS_LINE_RE.search(ln))
    fail_count = sum(1 for ln in combined.splitlines() if FAIL_LINE_RE.search(ln))
    return {
        "command": cmd_list,
        "cwd": str(Path(cwd).resolve()),
        "exit_code": proc.returncode,
        "stdout_sha256": sha256_bytes(stdout.encode("utf-8")),
        "stderr_sha256": sha256_bytes(stderr.encode("utf-8")),
        "pass_lines": pass_count,
        "fail_lines": fail_count,
        "stdout_excerpt": stdout[:1200],
    }


def derive_scope(engine: str, oracle: dict | None, artifacts: Sequence[dict]) -> list[str]:
    """Derive deterministic honest scope lines from engine, oracle, and artifacts."""
    lines = [
        f"engine={engine}; fail-closed receipt bridge between engine verification and Flywheel",
        f"hashed {len(artifacts)} artifact file(s) with SHA-256 at emission time",
    ]
    if not oracle:
        lines.append("no oracle command executed: standing remains UNVERIFIABLE until an oracle runs")
    elif oracle["exit_code"] == 0:
        lines.append(
            f"oracle exited 0 with {oracle['pass_lines']} pass marker(s) and {oracle['fail_lines']} fail marker(s); "
            "proves the named command passed on this commit and artifacts, not unexecuted surfaces"
        )
    else:
        lines.append(f"oracle exited {oracle['exit_code']}: standing is DRIFT")
    return lines


def compute_digests(subject: dict, claim: dict, hmac_key: str | None = None) -> dict:
    """Compute subject, claim, and envelope SHA-256 digests plus optional HMAC-SHA256."""
    subj_sha = sha256_bytes(canonical_bytes(subject))
    claim_sha = sha256_bytes(canonical_bytes(claim))
    seal_payload = {"schema": SCHEMA, "subject_sha256": subj_sha, "claim_sha256": claim_sha}
    env_sha = sha256_bytes(canonical_bytes(seal_payload))
    sig = None
    if hmac_key:
        sig = "hmac-sha256:" + hmac.new(
            hmac_key.encode("utf-8"),
            canonical_bytes(seal_payload),
            hashlib.sha256,
        ).hexdigest()
    return {
        "subject_sha256": subj_sha,
        "claim_sha256": claim_sha,
        "envelope_sha256": env_sha,
        "signature": sig,
    }


def build_receipt(
    engine: str,
    flagship: str,
    task_id: str,
    root: Path | str,
    artifact_paths: Sequence[Path | str],
    oracle_cmd: Sequence[str] | None = None,
    hmac_key: str | None = None,
    timeout: int = 120,
) -> dict:
    """Build a complete fail-closed engine-receipt/1 dictionary."""
    root_path = Path(root)
    artifacts = collect_artifacts(root_path, artifact_paths)
    oracle = run_oracle(oracle_cmd, root_path, timeout=timeout) if oracle_cmd else None
    if oracle is None:
        verdict = "UNVERIFIABLE"
    elif oracle["exit_code"] == 0 and oracle["fail_lines"] == 0:
        verdict = "MATCH"
    else:
        verdict = "DRIFT"
    subject = {
        "engine": engine,
        "flagship": flagship,
        "task_id": task_id,
        "git": git_meta(root_path),
        "artifacts": [{"rel_path": a["rel_path"], "sha256": a["sha256"], "bytes": a["bytes"]} for a in artifacts],
        "oracle_command": oracle["command"] if oracle else [],
    }
    oracle_claim = (
        {k: oracle[k] for k in ("exit_code", "stdout_sha256", "stderr_sha256", "pass_lines", "fail_lines")}
        if oracle else None
    )
    scope = derive_scope(engine, oracle, artifacts)
    claim = {"subject": subject, "verdict": verdict, "oracle": oracle_claim, "scope": scope}
    digests = compute_digests(subject, claim, hmac_key=hmac_key)
    return {
        "schema": SCHEMA,
        "in_toto_statement_type": IN_TOTO_STATEMENT,
        "predicate_type": PREDICATE_TYPE,
        "emitted_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "subject": subject,
        "verdict": verdict,
        "oracle": oracle,
        "artifact_paths": {a["rel_path"]: a["abs_path"] for a in artifacts},
        "scope": scope,
        "digests": digests,
    }


def emit_receipt(
    out_path: Path | str,
    engine: str,
    flagship: str,
    task_id: str,
    root: Path | str,
    artifact_paths: Sequence[Path | str],
    oracle_cmd: Sequence[str] | None = None,
    hmac_key: str | None = None,
    timeout: int = 120,
) -> dict:
    """Build and write a canonical engine-receipt/1 JSON file to out_path."""
    receipt = build_receipt(
        engine=engine,
        flagship=flagship,
        task_id=task_id,
        root=root,
        artifact_paths=artifact_paths,
        oracle_cmd=oracle_cmd,
        hmac_key=hmac_key,
        timeout=timeout,
    )
    target = Path(out_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(receipt, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return receipt


def _check_artifact_files(receipt: dict, subject: dict, errors: list[str]) -> None:
    path_map = receipt.get("artifact_paths") or {}
    for art in subject.get("artifacts", []):
        raw_path = path_map.get(art["rel_path"], "")
        fp = Path(raw_path) if raw_path else Path()
        if not raw_path or not fp.is_file():
            errors.append(f"missing artifact file: {fp}")
            continue
        live_sha, _ = sha256_file(fp)
        if live_sha != art["sha256"]:
            errors.append(f"artifact SHA-256 drift on {art['rel_path']}: live={live_sha} receipt={art['sha256']}")


def verify_receipt(
    receipt: dict,
    check_files: bool = False,
    hmac_key: str | None = None,
) -> tuple[bool, list[str]]:
    """Verify schema, fail-closed verdict, scope, digests, HMAC, and optionally artifact files."""
    errors: list[str] = []
    if receipt.get("schema") != SCHEMA:
        errors.append(f"unexpected schema: {receipt.get('schema')}")
    subject = receipt.get("subject") or {}
    oracle = receipt.get("oracle")
    oracle_claim = (
        {k: oracle[k] for k in ("exit_code", "stdout_sha256", "stderr_sha256", "pass_lines", "fail_lines")}
        if isinstance(oracle, dict) else None
    )
    verdict = receipt.get("verdict")
    if verdict == "MATCH" and (
        not oracle_claim or oracle_claim.get("exit_code") != 0 or oracle_claim.get("fail_lines", 0) != 0
    ):
        errors.append("fail-closed violation: MATCH verdict without passing exit-0 oracle")
    expected_scope = derive_scope(
        subject.get("engine", ""),
        oracle if isinstance(oracle, dict) else None,
        subject.get("artifacts", []),
    )
    if receipt.get("scope") != expected_scope:
        errors.append("scope mismatch: derived scope does not match stored scope")
    claim = {"subject": subject, "verdict": verdict, "oracle": oracle_claim, "scope": expected_scope}
    expected = compute_digests(subject, claim, hmac_key=hmac_key)
    stored = receipt.get("digests") or {}
    for field in ("subject_sha256", "claim_sha256", "envelope_sha256"):
        if stored.get(field) != expected[field]:
            errors.append(f"digest mismatch on {field}: stored={stored.get(field)} expected={expected[field]}")
    if hmac_key and not hmac.compare_digest(str(stored.get("signature") or ""), str(expected["signature"] or "")):
        errors.append("HMAC-SHA256 signature mismatch")
    if check_files:
        _check_artifact_files(receipt, subject, errors)
    return len(errors) == 0, errors


def _build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description="Native Superframe engine-receipt/1 emitter and verifier")
    sub = ap.add_subparsers(dest="cmd", required=True)
    em = sub.add_parser("emit", help="Emit canonical SHA-256 engine-receipt/1 JSON envelope")
    em.add_argument("--engine", required=True, choices=["raw", "superframe", "buildlang"])
    em.add_argument("--flagship", default="superframe")
    em.add_argument("--task-id", required=True)
    em.add_argument("--root", type=Path, required=True)
    em.add_argument("--artifact", type=Path, action="append", default=[])
    em.add_argument("--oracle-cmd", nargs=argparse.REMAINDER)
    em.add_argument("--out", type=Path, required=True)
    vf = sub.add_parser("verify", help="Verify canonical SHA-256 engine-receipt/1 JSON envelope")
    vf.add_argument("receipt", type=Path)
    vf.add_argument("--check-files", action="store_true")
    return ap


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    hmac_key = os.environ.get("FLYWHEEL_RECEIPT_HMAC_KEY")
    if args.cmd == "emit":
        cmd = [c for c in (args.oracle_cmd or []) if c != "--"]
        receipt = emit_receipt(
            out_path=args.out,
            engine=args.engine,
            flagship=args.flagship,
            task_id=args.task_id,
            root=args.root,
            artifact_paths=args.artifact,
            oracle_cmd=cmd or None,
            hmac_key=hmac_key,
        )
        print(json.dumps({
            "out": str(args.out),
            "verdict": receipt["verdict"],
            "claim_sha256": receipt["digests"]["claim_sha256"],
            "envelope_sha256": receipt["digests"]["envelope_sha256"],
        }, indent=2))
        return 0 if receipt["verdict"] in ("MATCH", "UNVERIFIABLE") else 1
    if args.cmd == "verify":
        receipt = json.loads(args.receipt.read_text(encoding="utf-8"))
        ok, errs = verify_receipt(receipt, check_files=args.check_files, hmac_key=hmac_key)
        print(json.dumps({"ok": ok, "verdict": receipt.get("verdict"), "errors": errs}, indent=2))
        return 0 if ok else 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
