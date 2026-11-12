<!-- writing-profile: research -->
# Characters: visible gear (plan)

2026-10-17. Author direction relayed by the coordinator the same day: the style must not change
between exploring, talking and fighting; combat and builds move toward No Rest for the Wicked and
Elden Ring; builds change what Lamb carries and wears, and the gear must show it. This page is the
plan for that, against what exists today.

## 1. One look in every mode

The same actors, mesh, shading and camera draw Lamb on the quay, in a conversation and in a fight:
`runtime/actor.mjs` takes the walk and talk states outside a fight and combat's `poseOf()` in one
(`drive()`), and `runtime/draw2d.mjs` puts it on the painted plate at the gameplay camera. Fights
happen on the plate; combat's arena placeholders (`game/engine/combat/arena/figure.mjs`) retire
once the engine page draws through `draw2d.mjs` (offered to the combat engineer, NOTES A2).
The look target is the environment art lead's design/LOOK-UNIFIED.md. That file does not exist as
of this writing; when it lands I fit the shading rig (`render/rigs.mjs`, `render/shade.mjs`) to it.

## 2. Slots

| Slot | What it holds | Where it hangs | Today |
|---|---|---|---|
| Weapon | one tool of a class | right fist, on the class's grip | 10 tools: stick, case, boathook, pole, knife, hammer, crowbar, hands, hook, crook, priest |
| Off hand | lantern, the claims case, a second blade, the left hand of a two-handed grip | left fist or IK onto the shaft | lantern, case; IK for two-handed |
| Coat | the outer layer: weight, length, stiffness | skirt panels on spring joints | per-character coat record (`info.coat`) drives the springs |
| Body | what is under the coat: waistcoat, mail, plates | torso tube | per character, not swappable yet |
| Head | hat, hood, helm | head joint | per character, not swappable yet |
| Legs and boots | trousers, waders, greaves | legs | per character |
| Kit | the case on the hip, the instruments | pelvis | Lamb's case |

## 3. Weapons: grips and movesets per class

- **Clip lookup** (built): a weapon's own clip first, then its class's, then the generic one
  (`w.boathook` playing `heavy` tries `boathook.heavy`, then `long.heavy`, then `heavy`). A weapon
  special is a clip under the weapon's name; nothing else changes.
- **Grips** (planned): today every tool lies on one grip axis of the right fist. Each class gets its
  own: one-handed forward grip (stick, crowbar), reverse grip (knife), choked two-handed grip with
  both hands near the head (hammer), spread two-handed grip (pole, boathook), shield grip on the
  forearm (the case, later a buckler). A grip is a hand-frame axis, an offset and an optional left
  hand target; the IK already in `rig/ik.mjs` serves the two-handed ones.
- **Movesets** (built for seven classes, per combat's names): light string, heavy, charged heavy,
  catch, plus the body moves. To add as combat adds them: `<class>.heavy_charge` hold (combat holds
  the frame at `charge.at` while charging; the clip's windup end is the hold pose), running attacks
  `<class>.run_light`, `<class>.run_heavy`, and weapon specials `<weapon>.special_<name>`, all
  phased so combat's warp lands them on its frames. Combat's numbers stay authoritative.

## 4. Weight that shows

Weight is drawn three ways, so a heavy build reads as heavy before it moves:

1. **Silhouette.** Heavier coats and armour add bulk at the shoulders and hem (costume parts take a
   weight band: light, medium, heavy).
2. **Cloth.** The coat's springs come from its weight and stiffness (`coatSpring`, built): a light
   cape swings fast and flares; a heavy coat swings slow and hangs.
3. **Body.** A style layer per load band (planned): heavy lowers the stance, widens the arms, slows
   the head; light keeps the stoop high and quick. Combat's load bands already change the dodge
   form (dash, roll, hop); the art shows the same band in idle and walk.

## 5. Order of work

1. Grips per class and the reverse knife grip; the hammer's choked grip.
2. Coat and armour as swappable parts with weight bands (Lamb first: greatcoat, oilskin, a waxed
   coat with plates sewn in, a Lamplighter's coat as a guise).
3. The load-band style layer.
4. Running attacks and charge holds when combat names them; weapon specials as they are designed.
5. LOOK-UNIFIED.md fitting when it lands.
