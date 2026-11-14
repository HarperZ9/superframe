"""Dialogue lint: flags spoken lines that read as epigrams instead of speech (design/DIALOGUE-STANDARD.md).

    python content/tools/dialogue_lint.py [--acts content/act1,content/act2,content/act3] [--list] [--speaker NAME]
                                          [--articulate] [--json out.json] [--max N]

Reads every `line:` record (speech, LAMB included) and every quoted option label (what Lamb says aloud)
in the act directories, strips {..} attributes, and checks each against the patterns below. Prints a
count per rule and per speaker, and with --list every flagged line with file:line. --max N exits 1 when
more than N lines are flagged (for a gate once the voice pass lands; there is no gate yet).

A flag is a pattern, not a verdict: a person can say a balanced sentence and mean it. Every flag still
gets the read-aloud test (would this person say it out loud, here, to this person, now?).

--articulate also runs the local Articulate check (literary-fiction/narrate) over the same lines and
reports its contrast and antithesis rule counts beside ours. On 2026-10-21 it found none of the four
epigrams the author named, which is why this lint exists; the Articulate engineer's dialogue checks
(design/VOICE-AUDIT.md) supersede it when they land. Standard library only.
"""
import json, pathlib, re, subprocess, sys, tempfile, collections

ABSTRACT = ("truth|faith|rule|rules|a slate|the slate|debt|a debt|the light|light|the sea|fear|grace|honesty|freedom|money|"
            "the law|law|justice|arithmetic|wicked|wickedness|power|a lie|lies|shame|kindness|mercy|hope|the dark|"
            "silence|custom|a vote|the vote|the wire|a town|a ledger|history|charity|duty|honour|work|crime|punishment|"
            "a wall|the wall|a jar|the jar|a lamp|a promise|the price|a price|the tide|a tide")
NUMWORDS = set("one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety fine sorry here there".split())
RULES = [
    ("semicolon-pair", "two short clauses balanced on a semicolon",
     lambda s: any(semi(a, b) for a, b in [p.split(";", 1) for p in re.split(r"(?<=[.!?])\s+", s) if ";" in p])),
    ("there-here", 'a comparison of two places built "In A ... Here ..."',
     lambda s: bool(re.search(r"\b(In|On|At|Up|Down) (Kell|Hesk|Gullet|my shore|your shore|the hill|the Gut|here|there)\b[^.?!]{0,80}[.,;]\s+(Here|There|Down here|Up there|In Gullet|In Kell|In Hesk)\b", s))
     or bool(re.search(r"\b(On|In) my shore\b", s))),
    ("abstract-definition", 'an abstraction defined in a sentence ("A slate is a promise", "Wicked is cheap")',
     lambda s: bool(re.search(rf"(^|[.!?;]\s+)({ABSTRACT}) (is|are|was|doesn't|does not|never|always|only|can't|cannot|won't)\b", s, re.I))),
    ("self-definition", 'the speaker defines themself with a noun ("I am arithmetic", "I\'m the room")',
     lambda s: any(not w.endswith("ing") and w not in NUMWORDS for w in re.findall(r"(?:^|[.!?]\s+)I(?:'m| am) (?:the |a |an )?([a-z]+)\.", s))),
    ("corrective-negation", '"not X. It is Y" corrections',
     lambda s: bool(re.search(r"\b(isn't|is not|wasn't|was not|aren't|are not|not)\b[^.?!;]{0,50}[.;,]\s*(It's|It is|That's|That is|It was|They're|They are|He's|She's|I'm)\b", s))
     or bool(re.search(r"\bnot [^.?!,]{1,30}, but\b", s))),
    ("mirrored-pair", "two neighbouring sentences built the same way with the words swapped",
     lambda s: mirrored(s)),
    ("summary-zinger", 'a closing line that names what something is for or costs ("That\'s the price of the light")',
     lambda s: bool(re.search(r"\b(That's|That is|It's|It is) (the price of|what [a-z ]{1,20} (is|are) for|the whole of it|all there is|the point)\b", s))),
]

STOP = set("a an the and or but of to in on at for with i you he she it we they is are was were be been 's 'm 're".split())
def semi(a, b):
    """A semicolon pair that balances: both sides short, and they share content words or both make a claim with a copula."""
    ta, tb = re.findall(r"[a-z']+", a.lower()), re.findall(r"[a-z']+", b.lower())
    if not (2 <= len(ta) <= 10 and 2 <= len(tb) <= 10): return False
    shared = (set(ta) - STOP) & (set(tb) - STOP)
    cop = lambda t: any(w in ("is", "are", "was", "were") or w.endswith("'s") for w in t)
    return len(shared) >= 1 or (cop(ta) and cop(tb))

NEG = {"not", "don't", "doesn't", "didn't", "never", "isn't", "aren't", "wasn't", "won't", "can't", "no"}
def stems(t): return {w.rstrip("s") for w in t if w not in STOP and w not in NEG and len(w) > 2}
def mirrored(s):
    sents = [x for x in re.split(r"(?<=[.!?])\s+", s) if x]
    for a, b in zip(sents, sents[1:]):
        ta, tb = re.findall(r"[a-z']+", a.lower()), re.findall(r"[a-z']+", b.lower())
        # two short sentences hinged on the same word ("They don't want the truth. They want somebody to have it.")
        if 3 <= len(ta) <= 7 and 3 <= len(tb) <= 7 and stems(ta) & stems(tb):
            neg = lambda t: any(w in NEG for w in t)
            pos = [(i, w.rstrip("s")) for i, w in enumerate(ta)], [(i, w.rstrip("s")) for i, w in enumerate(tb)]
            hinge = any(abs(i - j) <= 2 and x == y and x in stems(ta) for i, x in pos[0] for j, y in pos[1])
            # a turn on the hinge: one side negated and the other not, or the same word in the same place with new words round it
            if neg(ta) != neg(tb) or (hinge and abs(len(ta) - len(tb)) <= 2 and set(ta) != set(tb)):
                return True
        if 4 <= len(ta) <= 14 and 4 <= len(tb) <= 14:
            same = sum(1 for x, y in zip(ta, tb) if x == y)
            if same >= 4 and same / max(len(ta), len(tb)) >= 0.5 and ta != tb:
                return True
    return False

ATTR = re.compile(r"\s*\{[^}]*\}\s*$")
def lines_of(acts):
    for d in acts:
        for f in sorted(pathlib.Path(d).glob("*.lwd")):
            for n, raw in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
                if raw.startswith("line: "):
                    body = ATTR.sub("", raw[6:])
                    sp, _, text = body.partition(": ")
                    if text: yield (str(f), n, sp.strip(), text.strip())
                elif raw.startswith(("opt: ", "claim: ")):
                    m = re.match(r'^\w+: "(.*?)"\s*->', raw)
                    if m and m.group(1).startswith("'"): yield (str(f), n, "LAMB", m.group(1).strip("'"))

def articulate_counts(texts):
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as t:
        t.write("\n\n".join(texts)); p = t.name
    out = subprocess.run(["articulate", "check", "--mode", "literary-fiction/narrate", "--json", p], capture_output=True, text=True, timeout=900)
    r = json.loads(out.stdout)["results"][0]; c = collections.Counter()
    for tier in ("high", "medium", "low"):
        for x in r[tier]: c[(x.get("category") or x.get("rule_id") or "?")] += 1
    return c

def main(argv):
    arg = lambda k, d=None: argv[argv.index(k) + 1] if k in argv else d
    acts = (arg("--acts") or "content/act1,content/act2,content/act3").split(",")
    who = arg("--speaker")
    rows = [r for r in lines_of(acts) if not who or r[2] == who]
    flagged, by_rule, by_speaker = [], collections.Counter(), collections.Counter()
    for f, n, sp, text in rows:
        hits = [rid for rid, _, test in RULES if test(text)]
        if hits:
            flagged.append({"file": f, "line": n, "speaker": sp, "text": text, "rules": hits})
            by_speaker[sp] += 1
            for h in hits: by_rule[h] += 1
    print(f"{len(rows)} spoken lines read, {len(flagged)} flagged ({100 * len(flagged) / max(1, len(rows)):.1f} percent)")
    for rid, about, _ in RULES: print(f"  {rid:22} {by_rule[rid]:5}  {about}")
    print("  by speaker: " + ", ".join(f"{k} {v}" for k, v in by_speaker.most_common(20)))
    if "--list" in argv:
        for x in flagged: print(f"{x['file']}:{x['line']}: {','.join(x['rules'])}: {x['speaker']}: {x['text']}")
    if "--articulate" in argv:
        c = articulate_counts([r[3] for r in rows])
        print("  Articulate (literary-fiction/narrate) on the same lines: " + (", ".join(f"{k} {v}" for k, v in c.most_common(12)) or "no findings"))
    if arg("--json"): pathlib.Path(arg("--json")).write_text(json.dumps({"read": len(rows), "flagged": flagged, "by_rule": by_rule, "by_speaker": by_speaker}, indent=1), encoding="utf-8")
    mx = arg("--max")
    return 1 if mx is not None and len(flagged) > int(mx) else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
