# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Fetch physical constants from Wikidata (CC0) for every material with a QID.

Run: python -I build/fetch_wd.py <new_empty_folder>
Writes the raw SPARQL JSON (one file per query) into that folder. Values come
with the raw amount and unit (psv:) and, where Wikidata has one, the SI-normalised
node (psn:).
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from picks import MATERIALS  # noqa: E402

PROPS = {
    "P2054": "density", "P2056": "specific_heat", "P2068": "thermal_conductivity",
    "P2101": "melting_point", "P2102": "boiling_point", "P2055": "electrical_conductivity",
    "P5679": "electrical_resistivity", "P5480": "youngs_modulus", "P5593": "poisson_ratio",
    "P3070": "viscosity", "P3013": "surface_tension", "P5675": "relative_permittivity",
}
ENDPOINT = "https://query.wikidata.org/sparql"
UA = {"User-Agent": "materials-library-research/0.1 (open data build)",
      "Accept": "application/sparql-results+json"}

QUERY = """
SELECT ?item ?itemLabel ?itemDescription ?prop ?st ?rv ?ru ?v ?unit ?tempK ?tRaw ?tUnit ?phaseLabel ?refurl ?statedLabel WHERE {
  VALUES ?item { %s }
  VALUES ?prop { %s }
  ?prop wikibase:claim ?claim ; wikibase:statementValue ?psv ; wikibase:statementValueNormalized ?psn .
  ?item ?claim ?st .
  ?st ?psv ?raw . ?raw wikibase:quantityAmount ?rv ; wikibase:quantityUnit ?ru .
  OPTIONAL { ?st ?psn ?node . ?node wikibase:quantityAmount ?v ; wikibase:quantityUnit ?unit . }
  OPTIONAL { ?st pqn:P2076 ?tn . ?tn wikibase:quantityAmount ?tempK . }
  OPTIONAL { ?st pqv:P2076 ?tq . ?tq wikibase:quantityAmount ?tRaw ; wikibase:quantityUnit ?tUnit . }
  OPTIONAL { ?st pq:P515 ?phase . }
  OPTIONAL { ?st prov:wasDerivedFrom ?ref . OPTIONAL { ?ref pr:P854 ?refurl . }
             OPTIONAL { ?ref pr:P248 ?stated . } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}"""

LABELS = """
SELECT ?item ?itemLabel ?itemDescription WHERE {
  VALUES ?item { %s }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}"""


def run(query):
    url = ENDPOINT + "?" + urllib.parse.urlencode({"query": query})
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)  # resume after a rate limit
    qids = sorted({m[5] for m in MATERIALS if m[5] and m[5].startswith("Q")})
    items = " ".join("wd:" + q for q in qids)
    props = " ".join("wd:" + p for p in PROPS)
    if not (out / "labels.json").exists():
        (out / "labels.json").write_bytes(run(LABELS % items))
    chunks = [qids[i:i + 120] for i in range(0, len(qids), 120)]
    for i, chunk in enumerate(chunks):
        if (out / f"values_{i}.json").exists():
            continue
        time.sleep(65)  # the endpoint allows one request a minute during its outage rule
        blob = run(QUERY % (" ".join("wd:" + q for q in chunk), props))
        (out / f"values_{i}.json").write_bytes(blob)
        print("chunk", i, len(blob))


if __name__ == "__main__":
    main(sys.argv[1])
