# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Structure carriers that are not plain character streams (Part 2), each turned into a sequence or a
distance list that the same order parameters can read.

clause_depth   FALLBACK syntax: a rule-based clause chunker, not a parser. Depth rises at a
               subordinator, relative pronoun or "(" and falls at "," ";" ")" (to 0 at a sentence end).
               Returns the per-token depth stream (capped) and the arc lengths (tokens from an opener
               to the token that closes its clause).
rhyme_classes  rhyme key of each line ending: the last vowel group of the last word and what follows
               ("night" and "delight" share "ight"). A rough suffix rule, not phonetics.
statements / backref_distances   reason carrier: statements split at sentence ends; for every
               content term in a statement, the number of statements back to its last use.
term_overlap   mean Jaccard overlap of term sets k statements apart (the reason analogue of I(d)).
code_form / code_function   form: the Python token stream; function: the sequence of called names in
               source order, and the line distance from each call to its definition in the same file.
"""
import ast
import io
import re
import tokenize

import numpy as np

from .symbols import fold

SUBORD = set(("that which who whom whose when where because although though if while since unless "
              "whereas whether until before after lest wherein whereby").split())
STOP = set(("the and that this with from have which they their there were been would will shall "
            "what when where whom whose then than them these those such into upon also only other "
            "being some more most very same each every thus therefore hence because about could "
            "should must said unto your thou thee thy hath doth".split()))
TOK_RE = re.compile(r"[a-z]+|[(),;.!?:]")
VOWELS = re.compile(r"[aeiouy]+[^aeiouy]*$")


def clause_depth(text, cap=5):
    toks = TOK_RE.findall(fold(text))
    depth, opens, stream, arcs = 0, [], [], []
    for i, t in enumerate(toks):
        if t in SUBORD or t == "(":
            depth += 1
            opens.append(i)
        elif t in (",", ";", ")", ":") and opens:
            arcs.append(i - opens.pop())
            depth -= 1
        elif t in (".", "!", "?"):
            arcs += [i - o for o in opens]
            opens, depth = [], 0
        if t.isalpha():
            stream.append(min(depth, cap))
    return np.array(stream, dtype=np.int64), np.array(arcs, dtype=np.int64)


def rhyme_key(word):
    m = VOWELS.search(word)
    return m.group(0) if m else word


def rhyme_classes(lines):
    keys = []
    for ln in lines:
        w = re.findall(r"[a-z]+", fold(ln))
        if w:
            keys.append(rhyme_key(w[-1]))
    vocab = {k: i for i, k in enumerate(sorted(set(keys)))}
    return np.array([vocab[k] for k in keys], dtype=np.int64), keys


def class_corr(seq, ks):
    """P(c_i == c_(i+k)) - sum p^2 for each k."""
    s = np.asarray(seq)
    p = np.bincount(s) / len(s)
    base = float((p ** 2).sum())
    return np.array([(s[:-k] == s[k:]).mean() - base if k < len(s) else np.nan for k in ks])


def statements(text, min_words=4):
    parts = re.split(r"(?<=[.;:!?])\s+", re.sub(r"\s+", " ", fold(text)))
    out = []
    for p in parts:
        terms = {w for w in re.findall(r"[a-z]+", p) if len(w) >= 5 and w not in STOP}
        if len(p.split()) >= min_words:
            out.append(terms)
    return out


def backref_distances(stmts):
    last, out = {}, []
    for j, terms in enumerate(stmts):
        for t in terms:
            if t in last:
                out.append(j - last[t])
            last[t] = j
    return np.array(out, dtype=np.int64)


def term_overlap(stmts, ks):
    res = []
    for k in ks:
        if k >= len(stmts):
            res.append(np.nan)
            continue
        v = [len(a & b) / len(a | b) for a, b in zip(stmts[:-k], stmts[k:]) if a | b]
        res.append(float(np.mean(v)) if v else np.nan)
    return np.array(res)


def code_form(source):
    """Python token stream as strings: names, keywords and operators kept, literals by type."""
    out = []
    try:
        for t in tokenize.generate_tokens(io.StringIO(source).readline):
            if t.type in (tokenize.NAME, tokenize.OP):
                out.append(t.string)
            elif t.type in (tokenize.NUMBER, tokenize.STRING):
                out.append("<" + tokenize.tok_name[t.type] + ">")
    except (tokenize.TokenError, IndentationError, SyntaxError):
        pass
    return out


def code_function(source):
    """(called names in source order, line distances from each call to its definition in the file)."""
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return [], np.array([], dtype=np.int64)
    defs, calls = {}, []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            defs.setdefault(node.name, node.lineno)
        elif isinstance(node, ast.Call):
            f = node.func
            name = f.id if isinstance(f, ast.Name) else f.attr if isinstance(f, ast.Attribute) else None
            if name:
                calls.append((node.lineno, getattr(node, "col_offset", 0), name))
    calls.sort()
    names = [c[2] for c in calls]
    dist = [abs(ln - defs[n]) for ln, _, n in calls if n in defs]
    return names, np.array(dist, dtype=np.int64)
