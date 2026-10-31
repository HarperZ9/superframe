<!-- writing-profile: research -->
# Sound Room and PCB Room views against their source pages

Date: 2026-10-31. Run on this workstation in the built-in browser. The source pages are in the working notes, not this repo; their results are frozen in `tests/golden/pcb-page.json`.

## Verified

| What | How | Result |
|---|---|---|
| Sound field | 10 rooms, 400 steps of the GPU wave step, both float buffers and the microphone trace | 0 of 1,048,576 values differ in each room |
| Sound comparator | open air against rectangular room, planted | 556,573 differ |
| Sound page checks | `speed` and `modes` on both pages | byte equal JSON |
| PCB picture | 4 boards, 8 samples, canvas pixels at 485 by 204 | 0 of 395,760 bytes differ per board |
| PCB checks | the page's 34 known answers, from the modules, in CI | all pass, each number equal to the page's |
| PCB exports | every Gerber, drill and CSV file of 4 boards, in CI | byte equal to the page's |
| Code | AST of each top-level statement | sound 42 of 43, PCB 188 of 190 identical |

The changed statements read numbers from provenance rows: the sound speed and the copper and FR4 constants. Non-script page text is identical.

## A finding in the source page

The Sound Room `modes` check searches 15 percent around each expected mode. That window takes in a stronger neighbour: on the GPU it reads the (2,0) mode, expected 79.4 Hz, as 69.5 Hz, which is the (1,1) mode, and the (0,2) mode, expected 114.3 Hz, as 97.7 Hz, which is the (2,1) mode. The physics agrees with the formula; the search window is too wide. The view keeps the page's rule so the two match. The CPU test in `tests/solvers.test.mjs` uses a 3 percent window, where all six modes land within 2 percent.

The `speed` check reads 408 steps against 400.

## Limits

The CPU sound reference runs at a cell four times larger than the page, so CI can afford it. The pixel comparisons need WebGL and are not in CI, and they cover one GPU.
