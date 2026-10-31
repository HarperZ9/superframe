# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
import json
import os
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))

import fixtures as F  # noqa: E402
from cleanroom import decompose  # noqa: E402
from cleanroom.vault import Vault  # noqa: E402


def write_sidecar(d, name, files, text, saved, post="https://example.org/p/1", media="https://example.org/m/1.jpg"):
    front = {"format": "daylight.sidecar/1", "files": files, "kind": "media", "site": "example.org",
             "saved": saved, "post": post, "media": media}
    body = "---\n" + "\n".join(f"{k}: {json.dumps(v)}" for k, v in front.items()) + "\n---\n\n# Example\n\n"
    body += "\n".join("> " + l for l in text.splitlines()) + "\n"
    with open(os.path.join(d, name), "w", encoding="utf-8") as f:
        f.write(body)


@pytest.fixture(scope="session", autouse=True)
def temp_vault_env(tmp_path_factory):
    """Point CLEANROOM_VAULT at a temp dir so no test can touch a real vault."""
    old = os.environ.get("CLEANROOM_VAULT")
    os.environ["CLEANROOM_VAULT"] = str(tmp_path_factory.mktemp("env-vault"))
    yield os.environ["CLEANROOM_VAULT"]
    if old is None:
        os.environ.pop("CLEANROOM_VAULT", None)
    else:
        os.environ["CLEANROOM_VAULT"] = old


@pytest.fixture(scope="session")
def world(temp_vault_env, tmp_path_factory):
    """A vault holding three textured pictures, one text post and one tone, all decomposed."""
    base = tmp_path_factory.mktemp("cr")
    saves = base / "saves"
    saves.mkdir()
    root = str(base / "vault")
    pics = {}
    for i, seed in enumerate((11, 12, 13)):
        im = F.textured(seed)
        p = F.save_jpeg(im, str(saves / f"pic{i}.jpg"))
        write_sidecar(str(saves), f"pic{i}.md", [f"pic{i}.jpg"], f"picture number {i}", f"2026-10-2{i}T00:00:00Z")
        pics[i] = (im, p)
    (saves / "wallet-recovery-phrase.txt").write_text("not to be opened", encoding="utf-8")
    write_sidecar(str(saves), "secret.md", ["wallet-recovery-phrase.txt"], "x", "2026-10-25T00:00:00Z")
    text = ("the heron waits in the brackish shallows while the tide turns slowly over the mudflat "
            "and the reeds lean east under a low grey sky that smells of salt and rain")
    write_sidecar(str(saves), "post.md", [], text, "2026-10-26T00:00:00Z")
    F.tone_wav(str(saves / "tone.wav"), seconds=10, seed=5)
    write_sidecar(str(saves), "tone.md", ["tone.wav"], "a tone", "2026-10-27T00:00:00Z")
    from cleanroom import sources
    v = Vault(root)
    shas = {}
    for path, meta in sources.daylight_saves(str(saves)):
        for kind, payload, m in sources.sidecar_items(path, meta):
            rec, status = v.ingest_file(payload, m) if kind == "file" else v.ingest_bytes(payload, m)
            if rec:
                shas.setdefault(os.path.basename(path), []).append(rec["sha256"])
    decompose.decompose_all(root)
    return {"root": root, "saves": saves, "vault": v, "shas": shas, "pics": pics, "text": text, "out": base / "out"}
