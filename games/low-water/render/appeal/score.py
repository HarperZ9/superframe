# Score the painted portrait appeal test P1 (render/appeal/PROTOCOL.md): pooled shares with Wilson 95 percent intervals
# per task, and the decision by the pass lines written before the run.
#   python render/appeal/score.py [P2] 601 602 603   (the round's name first; P1 when omitted)
import json, math, sys
R = "render/appeal/results"
def wilson(k, n, z=1.96):
    if not n: return (0, 0, 1)
    p = k / n; d = 1 + z * z / n; c = (p + z * z / (2 * n)) / d; h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (round(p, 3), round(c - h, 3), round(c + h, 3))
tot = {}; per = []
RND = sys.argv[1] if not sys.argv[1].isdigit() else "P1"; seeds = [x for x in sys.argv[1:] if x.isdigit()]
for s in seeds:
    key = json.load(open(f"{R}/{RND}-{s}.json")); ans = json.load(open(f"{R}/{RND}-{s}-ans.json"))["answers"]
    for it in key["items"]:
        a = ans.get(it["id"]); hit = a == it["target"]; t = tot.setdefault(it["q"], [0, 0]); t[1] += 1; t[0] += hit
        per.append({"seed": int(s), "id": it["id"], "q": it["q"], "who": it["who"], "mood": it["mood"], "answer": a, "target": it["target"], "chose_target": hit})
out = {q: {"k": k, "n": n, "share_wilson": wilson(k, n)} for q, (k, n) in sorted(tot.items())}
P, S1, S2 = out.get("P"), out.get("S1"), out.get("S2")
if not P or P["share_wilson"][1] <= 0.5: decision = "P failed: task S decides nothing; the box keeps the old heads"
elif S1["share_wilson"][1] > 0.5 and S2["share_wilson"][1] > 0.5: decision = "sculpted heads go into the box"
elif S1["share_wilson"][2] < 0.5 and S2["share_wilson"][2] < 0.5: decision = "old heads stay in the box"
else: decision = "undecided: the box keeps the old heads"
res = {"tasks": out, "decision": decision, "note": "S shares are for the sculpted portrait; P for the second-pass painter", "items": per}
json.dump(res, open(f"{R}/{RND}-scored.json", "w"), indent=1)
print(json.dumps({"tasks": out, "decision": decision}, indent=1))
