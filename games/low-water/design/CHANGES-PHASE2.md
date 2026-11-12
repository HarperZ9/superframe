# Phase 2 changes: taking the audit out of the game

2026-10-16. The author's direction, relayed: "just continue improving, extending, and building ~ the
game does not need to be tied to verification in any way whatsoever." The game is judged by play and
look. These are the places where our working habits had leaked into the game's fiction, interface
or design docs, and what replaced them.

| Where | Before | After | Why |
|---|---|---|---|
| Fiction and UI | "the Ledger", a book of evidence and findings | **the Daybook**, Lamb's notebook with a cracked spine: notes, who said what, a sketch of the quay, the verdict | A ledger of evidence reads as an audit product; a notebook is a character's |
| Fiction and UI | "findings", "file a finding" | **verdict**; the Shelf asks for a **cause** | Insurers ask for a cause of loss; players give a verdict |
| Design | Fault apportioned in shares adding to 100, each capped by weighted evidence | Lamb can name one party or split the blame, but only blame someone Lamb has a case against | Same play, without the scoring sheet |
| Design rules | "Every outcome shows its reasons in words: what was read, what was held, what decided it" | When a claim lands or fails, the person tells you why, in their own voice; no tally is shown | The reasons belong in the scene, not in a readout |
| Claim presentation | CLAIM / HELD / RESULT block | The scene itself: Wenna smooths her coat; Marrow laughs at a flatfish | Same |
| LWD/0 format | The runtime prints the facts in a claim's condition as HELD or MISSING | The ok and fail scenes carry the reaction; nothing else is shown | Same |
| Saving | Command-log save with a state hash checked on load | Save anywhere; saves carry a version and old saves are upgraded; reloading changes nothing because there is no luck | Ordinary engineering sense (do not break saves), without the proof language |
| Engine map | Built / tested / merged statuses, GPU parity, hole-fraction measurements | Exists / not yet, and one practical note (paint three keyframes per place) | Planning, not evidence |
| Look bible | "Measurements" section; "Not claimed" | "Practical notes"; "Not done yet" | Same |
| Slice outline and pitch | Check record: walk counts, routes, control walk | Play notes; the pitch lists the prototype instead | The lint stays as a writers' tool in `slice/tools/`, out of the design docs |
| Frames | `kf8-dawn-ledger.png` | `kf8-dawn-daybook.png` | Name follows the fiction |
| Script | "your finding by dawn", "opens the Ledger", "until finding" | "your verdict by dawn", "opens the Daybook", "until verdict" | Same |

Kept, because they are the game: the mystery, the assessor and the house voice (a night assessor writing
the report as the night goes is a character, not an audit), the five instruments, the weather-driven
checks, the claim that arrived before the dark, and the Shelf's pneumatic tube.
