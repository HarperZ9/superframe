<!-- writing-profile: research -->
# Authored head passes: Ned Furrowe

2026-10-22. Each pass is one edit of `assets/heads/ned.sculpt.json` and `ned.paint.json`, a rebuild with
`tools/asset` in raw-native, then `proto/head_compare.mjs` (generated head on the top row, authored head below).
Captures are in `game/capture/authored-head-2026-10-22/` (not committed; the folder is ignored).

| Pass | Change | Verdict |
|:--|:--|:--|
| 1 | First blocking from ellipsoids and capsules, hair as one cap | Worse than the generated head: temple trenches, a mask edge at the midface, a helmet hairline, dab brows. |
| 2 | Rebuilt from planes: brow as one mass, zygomatic arch into the ear, shallow sockets, soft hairline, moustache as geometry | Trenches gone and the brows are continuous, but a rim runs from brow to jaw and the face still reads as a slab. Worse. |
| 3 | Pulled the brow wing, arch and ramus flush with the skull, softer cheek hollow, paler hat line | Rim reduced, forehead still flat in profile. Worse. |
| 4 | Sloped the forehead, mouth closed, upper lids lower, cheek hollow shrunk | Mouth and forehead read better. Vertical shadow lines down the cheeks remain. Still worse. |
| 5 | Tapered the lower face for a long head | Slightly leaner, same cheek lines. Still worse at portrait size, equal at best at play size. |

Reading across the passes. The generated head wins because its planes are blended by a tuned library of
shape records. Mine are ellipsoid and capsule unions, and where two of them meet the field makes a crease or a
ridge that the game's light turns into a vertical line. Each pass moved one defect and exposed the next.
The tool gaps that block quality are smooth blending across more than two strokes (a smoothing stroke kind),
displacement strokes for the planes between features, and adaptive density so a pass can be judged at the
play-size triangle budget. None of the passes met the bar "clearly beats the generated head".

## SDF kit passes, 2026-10-23 (raw-native PR 220)

| Pass | Change | Verdict |
|:--|:--|:--|
| 6 | Cubic (C2) smooth blends on 31 strokes, blend radii up 25 percent, forehead wrinkles as a masked ridge displacement on the cranium, built at the 40k, 9k, 3k adaptive budgets | The trench and rim lines are gone and the forehead wrinkles read at portrait size. The face is gaunt and in character, but vertical cheek shading lines remain and the hairline looks like a helmet. Still worse than the generated head at portrait and play size. |
| 7 | Smaller cheek hollow and masseter with wider blends, heavier brow, softer wrinkle amplitude | Jaw reads as a wide slab and the cheek lines are still there. Not better. That run ended at its turn limit. |
| 8 | Cheek hollow ellipsoid replaced by a shallow rounded-box plane with a small noise displacement, masseter as a rounded plane | The vertical cheek lines are gone. A horizontal shelf shows under the cheekbone. Face still wide. Better than pass 7, still worse than the generated head. |
| 9 | Hairline from relief displacement on the hair strokes, receding temples | Failed. The relief amplitude ate the hair and left a bald dome. |
| 10 | Hairline relief cut to 2 mm, smaller temples, jaw and masseter narrowed 12 percent, chin narrower | Hairline is ragged and natural, and the helmet shape is gone. Jaw is leaner. The face has character and a gaunt profile. The eyes bulge and the brow shelf is heavy. Still not clearly better than the generated head at portrait or play size. |
| 11 | Lids pulled back, orbit shallower, brow lightened | Failed. The eyes are separate parts at a fixed depth, so pulling the lids back left them bulging more. Reverted to the pass 10 sculpt. |

Reading. Cubic blends removed the union creases that stopped passes 1 to 5, and displacement now carries wrinkles and the hairline. The authored head has more individual character than the generated one, and it still loses on the read of the eyes and brow. The eye parts need their own depth tied to the lid strokes in the sculpt header. The assets in `assets/heads/out` are the pass 10 build. Adaptive LOD errors on that build: portrait 1.03 mm max (p99 0.20), play 3.45 mm max (p99 0.87), far 5.98 mm max (p99 2.45), all three inside the DESIGN.md bounds and at 40000, 9000 and 3000 triangles.

## Method change (coordinator, 2026-10-23, after pass 11)

Eleven blind passes each fixed one defect and exposed the next. The cause is the loop: an agent places strokes from text, looks at a render and guesses again. Two changes:

1. **Fit, then art-direct.** Add a landmark fit to tools/asset. The art bible gives each character a set of landmarks (front and profile: brow ridge, orbit, nasion, cheekbone apex, jaw angle, chin, ear position, hairline) taken from anthropometric proportions for their age and build, plus their cast idea. The tool optimises stroke parameters so the surface passes through the landmarks within a tolerance, and an artist pass then adds character on top. It is still authored in our own tool: the landmarks and strokes are the asset, and the fit is a tool feature. Bounds before code: landmark error at most 2 mm, with no new creases (a curvature check).
2. **Put quality where the player looks.** At play size a head is about 20 px tall, and it needs to read by silhouette, hat, hair and facial hair. The AAAA bar lands on the dialogue portraits. Portraits are painted in the Oil and Ink engine over the fitted head as underpainting, with authored brushwork layers, and judged at portrait size against the visual references.

The eye fix comes first, since pass 11 needs it: tie the eye parts' depth to the lid strokes.

## Landmark fit and eye seats, 2026-10-23 (raw-native PR 221, stacked on PR 220)

| Step | Change | Verdict |
|:--|:--|:--|
| Eye seat | The eye record is tied to the lid.ball stroke with a 1.6 mm gap, so lid moves carry the globe | The bulging eyes of passes 10 and 11 are gone. Kept. |
| Fit | 22 landmarks from ANSUR II, Farkas and Loomis proportions for age 42, narrow skull 0.95, jaw 0.94, lips 0.9; 21 strokes free; fit file `ned.fit.json`, report `ned.fit.report.json` | Landmark error before: max 17.9 mm, mean 5.25 mm. After: max 4.37 mm (jaw angle), mean 0.60 mm, 20 of 22 within 2 mm. Bound of 2 mm missed at the gonion pair. Crease p99 rose from 50.8 to 62.1 degrees. The render is worse than pass 10: the fit pulled the jaw in 15 mm, widened the brow wings and bent the nose. |
| Art pass | Restored brow wing, brow mass, nose bridge, ala, neck and masseter strokes from pass 10, kept the fitted jaw, cheek and chin | A narrower jaw and a seated eye on a gaunt face. A heavy brow shelf and a bent nose remain. Still worse than the generated head at portrait size and at play size, where the jaw and brow shelf read as noise. |

Reading. The fit does what it promises, and what it promises is too little. Twenty-two points constrain the surface where they sit and leave the stroke parameters between them free, so the optimiser trades features against each other. The next step is a prior: fit shape-level quantities (brow depth, jaw width ratio) with the stroke records tied to them, and add landmarks for the brow ridge and nose profile curve. The far LOD error reached 8.3 mm on this build against the 6 mm bound, a decimation bug to fix in raw-native.

## Shape-level fit, 2026-10-23 (raw-native PR 222 on top of 221)

| Step | Change | Verdict |
|:--|:--|:--|
| Rig fit | Ten shape scalars (jaw width, brow depth and height, nose depth and length, cheek width and depth, lower face height, chin depth, crown) drive the stroke entries. Landmarks grew to 30 with three brow ridge points per side and two nose dorsum points. Start is the pass 10 sculpt with the eye seat. | Landmark error before: max 17.9 mm, mean 4.85 mm. After: max 12.3 mm (trichion), mean 2.46 mm, 14 of 30 within 2 mm. Crease p99 50.8 to 60.5 degrees. The render is clearly worse than the generated head at portrait size and at play size: a long thin nose, a pinched mouth, loose pieces by the ears. Reverted to the pass 10 sculpt with the eye seat (assets rebuilt). |

Reading. The rig is the right size of fit and it still lost, so the problem is the landmark data and the starting sculpt, and not the number of parameters. Ned's forehead is more upright than the proportion table (trichion 12 mm off) and the table digits are unchecked against ANSUR II and Farkas (those sources could not be reached; the confidence labels stand). The landmarks also carry no information about the soft planes between them, which is where the generated head wins.
What to do next. (1) Fit only the skull, jaw and nose frame to a measured reference, and sculpt the soft planes by hand with displacement. (2) Get a licensed or self-made 3D reference of an older long-faced man and fit to scanned points. (3) Put the quality budget on the dialogue portrait: underpainting plus brushwork, since at play size a head is 20 px tall and reads by hat and silhouette. The generated head stays the shipping head until an authored one wins a side by side.
Far LOD note: the 8 mm max error comes from the 10 mm base extraction. The decimator fix keeps it from growing, and p99 is 2.4 mm against the 3 mm bound.

## Frame-only fit and hand-sculpted soft planes, 2026-10-23

| Step | Change | Verdict |
|:--|:--|:--|
| Frame fit | Six rig scalars (jaw width, brow depth, nose depth, cheek width, chin depth, crown), each limited to 8 mm, on 24 frame landmarks only (no mouth, nostril or hairline points) | Landmark error before: max 17.9 mm, mean 4.65 mm. After: max 13.3 mm (jaw angle, held back by the 8 mm limit), mean 3.71 mm. Crease p99 50.8 to 55.6 degrees. |
| Soft planes | Nasolabial fold and lower lid hollow as thin stroke grooves, relief displacement on the midface, a ridge displacement on the cheekbone | Render at portrait size: loses to the generated head. The nose reads as a beak in profile, the brow is a heavy shelf and the face is gaunt. The grooves are visible and the eyes are seated, but the frame is wrong and detail on a wrong frame does not help. Play size: loses, the shelf and beak are noise at 20 px. Reverted to the pass 10 sculpt with the eye seat. The frame-art sculpt is saved as `assets/heads/experiments/ned.frame-art.sculpt.json`. |

Reading. Three fit styles (all strokes, shape rigs, frame only) have each lost to the generated head, and the logic is the same each time. Proportion tables place landmarks well on an average head and say nothing about this face. The generated head carries a tuned library of shape records that encode how Ned's people differ from the average. The authored path needs a measured reference of the target face (or a hand sculpt guided by one) before a fit can add anything. The generated head stays the shipping head.
