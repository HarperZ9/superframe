<!-- writing-profile: research -->
# Character building: No Rest for the Wicked, with Elden Ring for comparison (clean-room spec)

Version 1, 2026-10-17. Written for the author's direction of the same day (verbatim): "leaning heavily
into the No Rest for the Wicked/Elden Ring style combat and character building".

Source tags:

- **[D]** data: read from No Rest for the Wicked's installed simulation database, analysed read-only in
  quarantine (early-access build, Unity 6000.1.15).
- **[S]** structure: from its decompiled class layout (fields and enums only).
- **[I]** my inference.
- **[R]** reported by a public source. Elden Ring is not installed, so every Elden Ring statement is [R],
  from the community wikis cited in section 11, and none comes from game files.
- **[P]** proposal for Low Water.

Combat timings live in `COMBAT-FEEL.md`; this file covers what the player builds.

## 1. Attributes

No Rest for the Wicked has eight attributes, each starting at 10 [D]. Each level grants 3 points [D].

| Attribute (described) | Drives | Curve (attribute value to result) |
|---|---|---|
| Health | maximum health | 10 to 100, 20 to 190, 30 to 280, 40 to 360, 50 to 440, 60 to 520, 70 to 600, 100 to 800 [D] |
| Stamina | maximum stamina | 10 to 50, 15 to 70, 25 to 100, 100 to 250; a flat +10 also applies [D] |
| Strength | weapon requirements and scaling | see section 3 [D][S] |
| Dexterity | weapon requirements and scaling | see section 3 [D][S] |
| Faith | weapon requirements and scaling (holy and caster weapons) | see section 3 [D][S] |
| Intelligence | weapon requirements and scaling (caster weapons) | see section 3 [D][S] |
| Load | maximum carry weight | 10 to 100, 50 to 500, 100 to 800 [D] |
| Focus | maximum focus (the resource for weapon special moves) | 10 to 100, 12 to 140, 16 to 200, 81 to 850, 100 to 900 [D] |

Character level also adds health on its own: +0 at level 1, +30 at level 3, +300 at level 30 [D].

Reading [I]: the curves are front-loaded. Health gains 9 per point up to 30 and then 8, and focus grows
fastest between 10 and 16. The first points in any attribute are worth the most.

**Elden Ring [R]:** eight attributes as well, but split differently. Health, a spell resource and
stamina-with-load are three "body" stats; four offence stats cover strength, dexterity and two magic
schools; an eighth stat covers status build-up, item discovery and a third damage school. Soft caps are
explicit and documented (for example health at 40 and 60, offence at about 18, 50 and 80). The hard cap is
99 per stat.

**Only No Rest for the Wicked:** a dedicated carry-weight attribute (Elden Ring folds load into its
stamina stat), and a dedicated focus attribute that powers weapon special moves rather than spells.
**Only Elden Ring:** a status and discovery stat, and spell schools that gate casting.

## 2. Levelling

| | No Rest for the Wicked |
|---|---|
| Level range | 1 to 100 in the data; the current release caps at 30 [D] |
| Points per level | 3 attributes [D] |
| XP to each level | level 2: 50; 3: 100; 4: 155; 5: 215; 10: 620; 15: 1,250; 20: 2,500; 25: 5,500; 30: 11,700 [D] |
| XP from enemies | per enemy type: from 8 (weakest) to 100 or more (strongest), paid in orbs of 2 to 5 XP each [D] |

Reading [I]: the XP curve roughly doubles every five levels after level 15, so the last five levels cost
as much as the first twenty-five.

**Elden Ring [R]:** levelling spends the same currency that buys items, and that currency is dropped on
death and can be lost. One point goes into one stat per level; there is no fixed points-per-level pool.

**Only No Rest for the Wicked:** XP is separate from money, and levels grant a pool of 3 points [D].
**Only Elden Ring:** the shared, losable currency for levels and shopping [R].

## 3. Weapon requirements and scaling

No Rest for the Wicked [D][S]:

- Each weapon names one or two attributes it depends on, stored as a bit field. Of 211 weapon
  definitions: one attribute (strength, dexterity, faith or intelligence) for most; two attributes
  (strength plus dexterity, strength plus faith, dexterity plus faith, strength plus intelligence,
  dexterity plus intelligence, faith plus intelligence) for 67; none for 6 [D].
- Requirements grow with the weapon's grade. A single-attribute weapon asks for 10 at grade 1, 22 at grade
  5 and 36 at grade 9. A two-attribute weapon asks for less in each: 10, 16 and 23. A three-attribute
  requirement curve also exists: 10, 14, 19 [D]. A separate item-level curve raises requirements between
  item levels 3 and 13 and holds after that [D]; exactly how item level maps onto the grade is unverified [U].
- **Falling short is harsh**: being 10% under a requirement already cuts the scaled stat by 65%, and
  being fully under cuts it by 80% [D].
- **Scaling above the requirement**: attribute points beyond it add to the weapon's core stats (damage
  and the like): +35% at 5 points, +65% at 10, +115% at 20, +355% at 80 [D][I on "beyond the requirement"].
- Most enchantments carry a flag that doubles their effect on two-handed weapons [D][I].

**Elden Ring [R]:** requirements per stat, letter grades (S to E) for scaling, and an affinity system that
changes which stats a weapon scales with when a swappable skill is applied. Falling short of a requirement
cripples the weapon in a similar way.

**Only Elden Ring:** affinities that re-route a weapon's scaling to another stat [R].
**Only No Rest for the Wicked:** the explicit single, double and triple requirement curves that make
two-attribute weapons cheaper per attribute [D].

## 4. Weapon classes and movesets

36 weapon classes in No Rest for the Wicked's enum, with about 160 weapon definitions spread across them
(for example 15 for gauntlets, 15 wands, 12 greatbows, 11 straight swords, 11 great swords, 11 staves, 10
great axes) [D]. Each class has its own moveset: up to four alternative light strings, charged versions of
every step, running, quick-step and roll follow-ups, plunges, parries and blocks (see `COMBAT-FEEL.md`
section 3) [D]. Individual weapons inherit the class moveset and may override damage or cost per step [D].

Base stats per class come from one base value times a class multiplier [D]: for example damage 14 for a
straight sword, 20 for a hammer, 24 for a halberd, 10 for a rapier; stamina per swing 9 to 18; weight 10
to 40 (full table in `COMBAT-FEEL.md` section 3.4). Weapon damage grows with upgrade level, up to +580% at
level 30 over level 1 [D].

**Elden Ring [R]:** many more classes, each with a class moveset, plus a swappable weapon skill that can
be moved between weapons.

**Only Elden Ring:** skills detached from the weapon and moved between weapons [R].
**Only No Rest for the Wicked:** special moves (section 6) roll with the item and can be re-rolled, and each
class carries four alternative light strings chosen per weapon [D].

## 5. Gear slots, weight and defence

No Rest for the Wicked slots [S]: helmet, body, legs, gloves; three weapon sets per hand (three main-hand
and three off-hand slots, plus unarmed); three rings; one quick item (more unused in the data); food;
arrows and bolts; a seed bag; six tool slots (gathering tools).

**Weight bands** [D]: under 35% of load is fast, 35 to 60% normal, 60 to 100% heavy, above 100%
encumbered. Stamina regeneration is x1.2, x1.0, x0.8 and x0.6 across those bands, and the band sets the
dodge form (`COMBAT-FEEL.md` section 1).

**Armour** [D]: a full-weight piece has 40 armour, 1 poise defence, weight 10 and durability 100 at base; a
lighter piece type has half the armour and poise (20, 0.5) and half the weight (5). Pieces also carry fire,
cold, lightning and plague armour, focus gain and stamina regeneration, and four material classes (cloth,
leather, mesh, plate) modify the base [D][S]. The per-piece and per-material table was not fully decoded
in this pass [U].

**Armour to damage reduction** [D]: 50 armour blocks 20%, 200 blocks 50%, 400 blocks 70%. Enemy armour
penetration grows with enemy level: 50% at level 11, 66% at 21, 75% at 31 [D].

**Poise defence** (section 7 of `COMBAT-FEEL.md` for the meters): resistance to interruption reaches 90%
at poise defence 5; stagger resistance is 10% at 1, 20% at 2, 35% at 3, rising further [D].

**Elden Ring [R]:** four armour slots, four talisman slots (passive effect items), two or three weapons per
hand, and the same idea of weight bands: under 30% light, 30 to 70% medium, 70 to 100% heavy (shorter roll,
slower recovery, about 20% slower stamina regeneration), 100% or more overloaded (no roll). Its fastest roll
has 13 invulnerable frames at 30 fps.

**Only No Rest for the Wicked:** tools as equipment slots, a food slot tied to a hunger meter, rings as the
passive slot. **Only Elden Ring:** talismans as the main passive-build slot, and an overloaded state that
removes the roll entirely [R].

## 6. Rarity, enchantments, runes and gems

No Rest for the Wicked's items roll their properties [D]:

| Rarity (described) | Drop weight | Enchantments | Gem slots | Re-rolls | Notes |
|---|---|---|---|---|---|
| Common | 50 | none | 4 | 0 | the plain item has the most gem sockets |
| Uncommon | 35 (from item level 5) | 1 to 3 | 1 | 5 | |
| Rare | 15 (from item level 15) | 2 to 4, plus 1 from a special group | 1 | 10 | |
| Unique | not dropped randomly | 1 to 4 fixed | 1 | 0 | |

- The number of enchantments also grows with item level: 1 at level 1, 2 at 4, 3 at 9, 4 at 16 [D].
- 536 enchantments exist, in groups (321 general, the rest in about ten specialised groups) [D].
- **Runes**: weapon special moves are runes slotted into the weapon and paid for in focus. Rune slots per
  weapon roll 1 to 4 (20% one, 50% two, 20% three, 10% four); common items allow up to 4, uncommon and
  rare up to 2, unique none [D]. A starting setup also gives a utility rune slot [D].
- **Gems** socket into items for extra effects (players report on-parry bursts from glove gems) [R].
- **Upgrades**: an upgrade template per item family has 15 or 16 steps; gold costs step from 25 to 50, 100,
  150 and 200 with materials at each step [D]. The global maximum upgrade level is 30 [D].
- **Durability** [D]: dying costs 1 to 10 durability on gear (100% chance); dealing a hit has a 20%
  chance and taking one a 50% chance to roll durability loss (amounts set to zero in this build); repair
  costs gold per item level [D].

**Elden Ring [R]:** no random item properties. Weapons upgrade with smithing stones to +25 (normal
weapons) or +10 (special weapons); skills and affinities are applied by a smith and moved freely.

**Only No Rest for the Wicked:** random enchantments, rarity tiers, re-rolls, runes as rollable special
moves, gem sockets that trade against rarity, durability and repair [D]. **Only Elden Ring:** fixed
weapons whose identity never rolls, and the two-track upgrade (normal and special) [R].

## 7. Consumables and recovery

No Rest for the Wicked [D]:

- **Food and hunger**: food fills a hunger capacity of 5 (upgradable to 10, +1 per upgrade); each food
  costs 1 hunger; hunger recovers 0.25 per second after a 1-second delay. Food is the healing and buff
  system [D][I].
- **Health rally**: after taking damage, 4% of it can be won back by hitting; life steal 15%; thorns 1:1
  [D].
- **Out-of-combat regeneration** starts 10 s after leaving combat at 15 m [D] (enemies).

**Elden Ring [R]:** refillable flasks split between health and spell resource, refilled at rest points,
with a customisable flask of combined buffs.

**Only No Rest for the Wicked:** food plus a hunger cap instead of flasks [D]. **Only Elden Ring:** fixed
refillable flasks and a craftable buff flask [R].

## 8. Status build-up and resistances

No Rest for the Wicked has six build-up effects (fire, cold, lightning, plague, bleed and a frozen state)
[S][D]. Each fills a meter that drains after a 3 s delay at about 0.1 per second and triggers at 30 to 50%
thresholds; some effects stay active and drain more slowly (0.05 per second) [D]. Armour pieces carry an
elemental armour value per school [D].

**Elden Ring [R]:** five or more build-up statuses with resistance stats per status, raised by the health,
endurance and status attributes.

## 9. How builds diverge

No Rest for the Wicked [D][I]:

1. **Weight first.** The load band sets dodge form, stamina regeneration and poise, so armour weight is the
   first build decision.
2. **Requirement attributes.** One-attribute weapons demand a lot of one stat (36 at the top grade);
   two-attribute weapons ask 23 of each. Hybrid builds are cheap per stat.
3. **Focus for runes.** Investing in focus turns the build toward special moves; rune slots and rolls add a
   loot-driven layer.
4. **Rolls and gems.** Enchantments and gems give builds their character; common items with four gem
   sockets are a real alternative to rare items with enchantments.
5. **No hard class.** A soft class tag exists on items and starting setups [D][S], but any character can use
   any weapon that meets requirements.

Elden Ring [R]: divergence comes from stat spread, weapon and affinity choice, the swappable skill,
talismans, spells and the buff flask.

## 10. Proposals for Low Water [P]

Low Water's compartments and voices (`design/SYSTEMS-FULL.md` section 2) are its attributes. If the author
wants this style of building in the game:

1. **Front-loaded curves** for compartments: the first points matter most, as in both references.
2. **A carry-weight band** as the first build decision: what Lamb carries (salvage, a wet coat, the Kit)
   sets footing and breath recovery, with the reference thresholds 35 / 60 / 100% as a start.
3. **Requirements with a harsh shortfall**: a Kit instrument fitted beyond Lamb's skill loses most of its
   effect, as a weapon does 10% under its requirement.
4. **Two-track items**: fixed, named instruments (Elden Ring's way) for the Kit, and rolled salvage
   fittings (No Rest for the Wicked's way) that change an instrument's level and voice, with re-rolls paid
   in time at the bench.
5. **Food as recovery**: the Brine's stove and bread as a hunger-capped recovery system matches the
   reference and the setting.

## 11. Sources

- No Rest for the Wicked: installed early-access build, simulation database and class layout, analysed
  read-only in quarantine, 2026-10-16 and 2026-10-17.
- Elden Ring wiki (Fextralife), "Equip Load", page last edited 2026-08-10, read 2026-10-17:
  https://eldenring.wiki.fextralife.com/Equip+Load
- Elden Ring wiki (Fextralife), "Stats", page last edited 2025-05-03, read 2026-10-17:
  https://eldenring.wiki.fextralife.com/Stats
- Elden Ring wiki (wiki.gg), weapon skill items and special upgrade stones, read 2026-10-17:
  https://eldenring.wiki.gg/wiki/Ash_of_War ; https://eldenring.wiki.gg/wiki/Somber_Smithing_Stone
- Twinfinite, poise guide (undated), read 2026-10-17: https://twinfinite.net/guides/what-does-poise-do-in-elden-ring-answered/
