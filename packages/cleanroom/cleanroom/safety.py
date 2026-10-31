# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Rules for handling untrusted inputs.

Every saved artifact is data. It is read in binary, hashed and copied; it is never executed, never
imported, and never opened by a shell. Files whose names look like credentials or recovery phrases
are skipped without being opened. Media types come from magic bytes, not from the file extension.
"""
import os
import re

SENSITIVE = re.compile(
    r"(passw|passwd|secret|token|credential|recovery|seed[ _-]?phrase|mnemonic|wallet|private[ _-]?key|"
    r"api[ _-]?key|backup[ _-]?codes?|2fa|otp|keystore|\.kdbx$|\.pem$|\.key$|\.p12$|\.pfx$|id_rsa|id_ed25519|"
    r"^\.env|\.envrc|\.npmrc|\.netrc|cookies?\.(txt|json|sqlite))", re.I)
MAX_BYTES = 4 * 1024 ** 3


def refuse_reason(path):
    """None when the path may be read as data, else a short reason. The file is not opened."""
    name = os.path.basename(path)
    if SENSITIVE.search(name):
        return "name looks like a credential or recovery file"
    if os.path.islink(path):
        return "symbolic link"
    if not os.path.isfile(path):
        return "not a regular file"
    if os.path.getsize(path) > MAX_BYTES:
        return "larger than the 4 GiB cap"
    return None


MAGIC = [
    (b"\xff\xd8\xff", "image/jpeg", ".jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", ".png"),
    (b"GIF87a", "image/gif", ".gif"),
    (b"GIF89a", "image/gif", ".gif"),
    (b"RIFF", None, None),
    (b"OggS", "audio/ogg", ".ogg"),
    (b"fLaC", "audio/flac", ".flac"),
    (b"ID3", "audio/mpeg", ".mp3"),
    (b"%PDF", "application/pdf", ".pdf"),
    (b"PK\x03\x04", "application/zip", ".zip"),
    (b"\x1aE\xdf\xa3", "video/webm", ".webm"),
]


def sniff(head):
    """Media type and extension from the first bytes."""
    for sig, mt, ext in MAGIC:
        if head.startswith(sig):
            if sig == b"RIFF":
                kind = head[8:12]
                return {b"WAVE": ("audio/wav", ".wav"), b"WEBP": ("image/webp", ".webp"),
                        b"AVI ": ("video/avi", ".avi")}.get(kind, ("application/octet-stream", ".bin"))
            return mt, ext
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in (b"M4A ", b"M4B "):
            return "audio/mp4", ".m4a"
        return "video/mp4", ".mp4"
    if len(head) > 1 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0:
        return "audio/mpeg", ".mp3"
    try:
        head.decode("utf-8")
        return "text/plain", ".txt"
    except UnicodeDecodeError:
        # a cut multibyte character at the end of the window is still text
        try:
            head[:-3].decode("utf-8")
            return "text/plain", ".txt"
        except UnicodeDecodeError:
            return "application/octet-stream", ".bin"


def family(media_type):
    return (media_type or "").split("/")[0]
