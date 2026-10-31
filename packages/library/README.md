# library (libcat)

One catalogue for every artifact you keep: a single SQLite file with an FTS5 index over paths,
topics and note bodies. Each row holds the path, kind, project, living document, dates, size,
sha256, status and retention. Standard library only.

It also enforces one rule: a new notes file whose topic already has a living document is refused,
and the refusal names the document to append a dated section to. Data, code, preregistrations,
evidence and media are never refused.

## Run it

```
export LIBRARY_DB=/path/to/catalogue.sqlite
python -I packages/library/library.py init
python -I packages/library/library.py ingest path/to/file --topic "kiln firing"
python -I packages/library/library.py query "kiln temperatures" --since 2026-10-01
python -I packages/library/library.py where "kiln notes"
python -I packages/library/library.py stats
python -I packages/library/library.py mcp      # MCP stdio server: library_query, _where, _ingest, _stats
```

`import-inventory TSV` loads a consolidation inventory with sha256s; `capture --session ID
--transcript FILE.jsonl` catalogues every file a session wrote through a file tool.

## Environment

| Variable | Meaning |
|---|---|
| `LIBRARY_DB` | catalogue file. Required, or pass `--db`; the tool will not guess a location. |
| `LIBRARY_LIVING_DOCS` | JSON registry of living documents (format: `living_docs.example.json`). Relative paths resolve against the registry file's folder. Unset means an empty registry; rows already in the database stay. |
| `LIBRARY_PROJECT_ANCHORS` | comma-separated folder names. A file's project is the folder under the first anchor found in its path, date prefix removed. Default `notes,public,dev`. |

## MCP registration

```json
"library": {
  "type": "stdio",
  "command": "python",
  "args": ["-I", "<superframe checkout>/packages/library/library.py", "mcp"],
  "env": {"LIBRARY_DB": "<catalogue file>", "LIBRARY_LIVING_DOCS": "<registry json>"}
}
```

## Tests

From the superframe root: `python -m pytest -q -p no:cacheprovider packages/library/tests`.
Every fixture is synthetic and lives in a temp dir.

## Limits

- Body text is indexed for note-like files only (`.md`, `.txt`, `.rst`, `.org`, `.markdown`),
  up to 256 KiB each. Other files are found by path and topic.
- A query miss means no catalogued path, topic or indexed body matched. Files outside the
  catalogue are not searched.
- Transcript capture sees files written through file tools only; files written by shell commands
  need the walk mode (`capture --since T ROOTS...`).

Licence: FSL-1.1-MIT (see the repository LICENSE).
