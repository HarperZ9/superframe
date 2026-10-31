# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Tests for ingest, query and the no-new-notes-file refusal.

Run from the superframe root: python -m pytest -q -p no:cacheprovider packages/library/tests
Every fixture is synthetic and lives in a temp dir.
"""
import hashlib
import io
import datetime
import os
import sys
import tempfile
import time
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest import mock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from libcat import cli, ingest, inventory, query, schema  # noqa: E402


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return path


def sha(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


class Base(unittest.TestCase):
    def setUp(self):
        # hermetic: no registry, default project anchors, whatever the caller's shell holds
        env = mock.patch.dict(os.environ)
        env.start()
        self.addCleanup(env.stop)
        for k in ("LIBRARY_DB", "LIBRARY_LIVING_DOCS", "LIBRARY_PROJECT_ANCHORS"):
            os.environ.pop(k, None)
        self.tmp = tempfile.TemporaryDirectory()
        self.d = self.tmp.name
        self.db = os.path.join(self.d, "cat.sqlite")
        self.conn = schema.connect(self.db)
        self.intake = write(os.path.join(self.d, "intake", "INTAKE.md"), "# Reference intake\n")
        self.planned = os.path.join(self.d, "LOW-WATER.md")
        docs = [("REFERENCE-INTAKE", self.intake, "live", ["intake", "reference intake", "batch"]),
                ("LOW-WATER", self.planned, "proposed", ["low water", "sallow"])]
        for name, path, state, kws in docs:
            self.conn.execute("INSERT INTO living_docs VALUES (?,?,?,?)",
                              (name, path, state, "|".join(kws)))
        self.conn.commit()

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()


class TestInventoryImport(Base):
    def test_import_hashes_links_and_marks_missing(self):
        mc = os.path.join(self.d, "notes")
        note = write(os.path.join(mc, "2026-10-16-low-water", "PLAN.md"),
                     "# Low Water plan\nThe ferry scene uses a sodium lamp.\n")
        dup = write(os.path.join(mc, "2026-10-17-copy", "PLAN.md"),
                    "# Low Water plan\nThe ferry scene uses a sodium lamp.\n")
        mach = write(os.path.join(mc, "2026-09-14", "pytest-1", "out.txt"), "sodium lamp log\n")
        gone = os.path.join(mc, "2026-10-01-x", "GONE.md")
        hdr = "path\tscope\tsize_bytes\tdate\tmtime\tcluster\tcluster_basis\ttarget\tflags\tfirst_heading\ttopic\n"
        rows = [
            (note, "plan", "LOW-WATER", "dup:D0001", "Low Water plan"),
            (dup, "plan", "LOW-WATER", "dup:D0001", "Low Water plan"),
            (mach, "machine output (snapshot/test tree)", "stays: archive as-is (machine output)", "", "log"),
            (gone, "agent report", "FLYWHEEL", "", "Gone"),
        ]
        tsv = os.path.join(self.d, "INV.tsv")
        with open(tsv, "w", encoding="utf-8") as f:
            f.write("# comment line\n" + hdr)
            for p, cl, tg, fl, tp in rows:
                f.write(f"{p}\tnotes\t10\t2026-10-16\t2026-10-16\t{cl}\trule\t{tg}\t{fl}\t{tp}\t{tp}\n")
        st = inventory.import_inventory(self.conn, tsv)
        self.assertEqual(st["rows"], 4)
        self.assertEqual(st["hashed"], 3)
        self.assertEqual(st["missing"], 1)
        row = self.conn.execute("SELECT * FROM artifacts WHERE path=?", (note,)).fetchone()
        self.assertEqual(row["sha256"], sha(note))
        self.assertEqual((row["kind"], row["home"], row["project"], row["retention"]),
                         ("plan", "LOW-WATER", "low-water", "fold"))
        gone_row = self.conn.execute("SELECT status FROM artifacts WHERE path=?", (gone,)).fetchone()
        self.assertEqual(gone_row["status"], "missing")
        link = self.conn.execute(
            "SELECT l.dst_path FROM links l JOIN artifacts a ON a.id=l.src_id "
            "WHERE a.path=? AND l.rel='duplicate-of'", (dup,)).fetchone()
        self.assertEqual(link[0], note)
        hits = [r["path"] for r in query.search(self.conn, "sodium")]
        self.assertIn(note, hits)
        self.assertNotIn(mach, hits, "machine output bodies are not indexed")


class TestIngestAndRefusal(Base):
    def test_data_file_is_catalogued_with_sha256(self):
        p = write(os.path.join(self.d, "run", "results.json"), '{"intake": 1}')
        art = ingest.ingest(self.conn, p, session_id="s1")
        row = self.conn.execute("SELECT * FROM artifacts WHERE id=?", (art,)).fetchone()
        self.assertEqual((row["kind"], row["sha256"], row["session_id"]), ("data", sha(p), "s1"))

    def test_new_notes_file_on_live_topic_is_refused(self):
        p = write(os.path.join(self.d, "intake", "notes-22.md"), "# Reference intake, batch 22\n")
        with self.assertRaises(ingest.Refused) as cm:
            ingest.ingest(self.conn, p, session_id="s1")
        self.assertIn("REFERENCE-INTAKE", str(cm.exception))
        self.assertIn("append a dated section", str(cm.exception))
        self.assertIsNone(self.conn.execute("SELECT 1 FROM artifacts WHERE path=?", (p,)).fetchone())
        ref = self.conn.execute("SELECT living_doc, session_id FROM refusals").fetchone()
        self.assertEqual(tuple(ref), ("REFERENCE-INTAKE", "s1"))

    def test_refusal_names_planned_doc_and_says_create_it(self):
        p = write(os.path.join(self.d, "lw", "sallow-notes.md"), "# Sallow persona notes\n")
        with self.assertRaises(ingest.Refused) as cm:
            ingest.ingest(self.conn, p)
        self.assertIn("LOW-WATER", str(cm.exception))
        self.assertIn("create it at that path", str(cm.exception))

    def test_cli_refusal_exits_3(self):
        p = write(os.path.join(self.d, "intake", "notes-23.md"), "# Intake batch 23\n")
        err = io.StringIO()
        with redirect_stderr(err), redirect_stdout(io.StringIO()):
            code = cli.main(["--db", self.db, "ingest", p])
        self.assertEqual(code, 3)
        self.assertIn("refused", err.getvalue())

    def test_living_doc_itself_is_accepted(self):
        ingest.ingest(self.conn, self.intake)
        self.assertIsNotNone(self.conn.execute(
            "SELECT 1 FROM artifacts WHERE path=?", (os.path.abspath(self.intake),)).fetchone())

    def test_notes_with_no_living_doc_are_accepted(self):
        p = write(os.path.join(self.d, "misc", "kiln-notes.md"), "# Kiln firing temperatures\n")
        art = ingest.ingest(self.conn, p)
        self.assertGreater(art, 0)

    def test_prereg_and_data_kinds_are_never_refused(self):
        p = write(os.path.join(self.d, "intake", "PREREG-intake.md"), "# Intake study prereg\n")
        ingest.ingest(self.conn, p, kind="prereg")
        q = write(os.path.join(self.d, "intake", "batch-24.tsv"), "a\tb\n")
        ingest.ingest(self.conn, q)
        n = self.conn.execute("SELECT count(*) FROM artifacts").fetchone()[0]
        self.assertEqual(n, 2)

    def test_capture_catalogues_new_files_and_reports_refusals(self):
        start = time.time() - 1
        write(os.path.join(self.d, "sess", "out.json"), "{}")
        write(os.path.join(self.d, "sess", "intake-notes.md"), "# intake batch 30\n")
        done, refused = ingest.capture(self.conn, [os.path.join(self.d, "sess")], start, "s9")
        self.assertEqual(len(done), 1)
        self.assertEqual([r[1] for r in refused], ["REFERENCE-INTAKE"])


class TestTranscriptCapture(Base):
    def test_catalogues_written_files_and_applies_rule_only_to_new_ones(self):
        import json
        old_note = write(os.path.join(self.d, "intake", "old-intake-notes.md"), "# intake batch 1\n")
        transcript = os.path.join(self.d, "proj", "sess.jsonl")
        time.sleep(0.05)
        write(transcript, "")
        started = datetime.datetime.now(datetime.timezone.utc).isoformat()
        time.sleep(0.05)
        data = write(os.path.join(self.d, "out", "result.json"), "{}")
        new_note = write(os.path.join(self.d, "intake", "notes-40.md"), "# intake batch 40\n")
        sub = write(os.path.join(self.d, "proj", "sess", "subagents", "agent-1.jsonl"), "")

        def use(path, name="Write"):
            return json.dumps({"message": {"content": [
                {"type": "tool_use", "name": name, "input": {"file_path": path}}]}})
        with open(transcript, "w", encoding="utf-8") as f:
            f.write(json.dumps({"timestamp": started}) + "\n")
            f.write("\n".join([use(data), use(old_note, "Edit"), use(new_note),
                               use(os.path.join(self.d, "gone.md"))]) + "\n")
        with open(sub, "w", encoding="utf-8") as f:
            f.write(use(data) + "\n" + json.dumps({"message": {"content": "plain"}}) + "\n")
        done, refused, skipped = ingest.capture_transcript(self.conn, transcript, "s7")
        self.assertEqual(len(done), 2, "data file once, old note edited in place")
        self.assertEqual([os.path.basename(r[0]) for r in refused], ["notes-40.md"])
        self.assertEqual([os.path.basename(p) for p in skipped], ["gone.md"])


class TestQuery(Base):
    def setUp(self):
        super().setUp()
        self.a = write(os.path.join(self.d, "notes", "2026-10-02-mmbu", "r.json"), "{}")
        self.b = write(os.path.join(self.d, "notes", "2026-10-20-gpu", "k.py"), "x=1")
        ingest.ingest(self.conn, self.a, topic="MMBU contamination run", project="mmbu")
        ingest.ingest(self.conn, self.b, topic="wavefront kernel", project="gpu")
        self.conn.execute("UPDATE artifacts SET date='2026-10-02' WHERE path=?", (os.path.abspath(self.a),))
        self.conn.execute("UPDATE artifacts SET date='2026-10-20' WHERE path=?", (os.path.abspath(self.b),))
        self.conn.commit()

    def paths(self, **kw):
        return [os.path.basename(r["path"]) for r in query.search(self.conn, **kw)]

    def test_text_project_kind_and_date_filters(self):
        self.assertEqual(self.paths(text="contamination"), ["r.json"])
        self.assertEqual(self.paths(project="gpu"), ["k.py"])
        self.assertEqual(self.paths(kind="code"), ["k.py"])
        self.assertEqual(self.paths(since="2026-10-10"), ["k.py"])
        self.assertEqual(self.paths(until="2026-10-05"), ["r.json"])
        self.assertEqual(self.paths(text="kernel", kind="data"), [])

    def test_fts_syntax_in_user_text_does_not_crash(self):
        self.assertEqual(self.paths(text='kernel ("*'), ["k.py"])
        self.assertEqual(self.paths(text="***"), [])

    def test_plain_question_finds_file_by_rare_words(self):
        q = "Which run measured contamination for the MMBU project last month?"
        self.assertEqual(self.paths(text=q)[0], "r.json")

    def test_renamed_names_find_each_other(self):
        p = write(os.path.join(self.d, "x", "engine.md"), "# qdb engine notes\n")
        ingest.ingest(self.conn, p, kind="report")
        self.assertIn("engine.md", self.paths(text="BDB engine"))

    def test_path_words_are_searchable(self):
        self.assertEqual(self.paths(text="mmbu"), ["r.json"])


class TestConfig(Base):
    def test_registry_file_resolves_relative_paths_and_seeds(self):
        import json
        from libcat import living
        reg = write(os.path.join(self.d, "reg", "docs.json"), json.dumps({"docs": [
            {"name": "KILNS", "path": "kilns/KILNS.md", "state": "proposed", "keywords": ["kiln"]}]}))
        write(os.path.join(self.d, "reg", "kilns", "KILNS.md"), "# Kilns\n")
        os.environ["LIBRARY_LIVING_DOCS"] = reg
        docs = living.load_registry()
        self.assertEqual(docs[0][1], os.path.normpath(os.path.join(self.d, "reg", "kilns", "KILNS.md")))
        living.seed(self.conn)
        row = self.conn.execute("SELECT state FROM living_docs WHERE name='KILNS'").fetchone()
        self.assertEqual(row[0], "live", "a proposed doc that exists on disk is promoted")

    def test_no_registry_set_means_empty(self):
        from libcat import living
        self.assertEqual(living.load_registry(), [])

    def test_cli_without_db_exits_2(self):
        err = io.StringIO()
        with redirect_stderr(err), redirect_stdout(io.StringIO()):
            code = cli.main(["stats"])
        self.assertEqual(code, 2)
        self.assertIn("LIBRARY_DB", err.getvalue())


if __name__ == "__main__":
    unittest.main()
