# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Turn text into integer symbol streams at character level and word level.

Character alphabet (fixed, so every text is read through the same lens):
  a-z after ASCII folding, 0-9, one space for any whitespace run, and eight punctuation classes.
  Newlines become spaces: hard-wrapped prose would otherwise carry a fake period at the wrap width.
Word level: lowercase alphabetic tokens; a word's symbol is its frequency rank among the top K-1
words of that text, and every other word shares the symbol K-1.
"""
import re
import unicodedata

import numpy as np

PUNCT = {".": 0, "!": 0, "?": 0, ",": 1, ";": 2, ":": 2, "'": 3, '"': 4, "-": 5, "(": 6, ")": 6,
         "[": 6, "]": 6}
LETTERS = "abcdefghijklmnopqrstuvwxyz"
N_CHAR = 26 + 10 + 1 + 8  # letters, digits, space, punctuation classes (7 named and one 'other')
SPACE = 36
WORD_RE = re.compile(r"[a-z]+")


def fold(text):
    """Lowercase ASCII fold: accents dropped, ligatures split."""
    t = unicodedata.normalize("NFKD", text)
    return "".join(c for c in t if not unicodedata.combining(c)).lower()


def chars(text):
    """Integer array over N_CHAR symbols, through a 256-entry translation table."""
    t = re.sub(r"\s+", " ", fold(text)).strip()
    b = np.frombuffer(t.encode("ascii", "replace"), dtype=np.uint8)
    lut = np.full(256, 37 + 7, dtype=np.int64)
    lut[97:123] = np.arange(26)
    lut[48:58] = 26 + np.arange(10)
    lut[32] = SPACE
    for c, k in PUNCT.items():
        lut[ord(c)] = 37 + k
    return lut[b]


def words(text):
    """Lowercase alphabetic word tokens."""
    return WORD_RE.findall(fold(text))


def word_symbols(tokens, k=32):
    """Map tokens to ranks 0..k-2 by frequency in this token list; the rest share k-1."""
    counts = {}
    for w in tokens:
        counts[w] = counts.get(w, 0) + 1
    top = sorted(counts, key=lambda w: (-counts[w], w))[: k - 1]
    rank = {w: i for i, w in enumerate(top)}
    return np.array([rank.get(w, k - 1) for w in tokens], dtype=np.int64)


def strip_gutenberg(text):
    """Body between the Project Gutenberg START and END markers (whole text if absent)."""
    s = re.search(r"\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n", text)
    e = re.search(r"\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG", text)
    return text[s.end() if s else 0: e.start() if e else len(text)]
