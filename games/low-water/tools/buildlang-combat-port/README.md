# Low Water combat step in BuildLang

A port of the combat step (sim, brains, pilot, trace writer) to BuildLang 1.10.0, checked
against the JS sim: run the 40 corpus fights in both and compare the trace files byte for byte.

    tools/buildlang-combat-port/run.sh /path/to/buildc /tmp/lw-port

`export-step-inputs.mjs` writes each fight's starting world and the environment the step reads
(field terms at each refresh, the clock, the grip table). `src/main.bld` runs the fights, writes
`<work>/bl/*.jsonl` and prints per-record-kind line counts against `<work>/js/*.jsonl`.

`control/hits.bld` is a mutation control: heavy-hit force 3.0 instead of 2.0. Swapped into
`src/`, it must make the comparison report differences.

Result on 2026-10-23 (buildc 1.10.0, installed from crates.io): 40 of 40 files
byte-identical; cbegin 40/40, cin 20,290/20,290, cev 5,350/5,350, cstate 571/571, cend 40/40.
