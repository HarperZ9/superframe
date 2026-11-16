// Every sound effect by name, with one signature: (dur, v, seed, opt, p) -> mono samples.
import { wind, frost, snowstep } from "./weather.mjs";
import { murmur, queue, cough, claps, stamp } from "./people.mjs";
import { train, press, chute, lamphum, chain, cart, millgrind } from "./machine.mjs";
import { stove, pen, bowlset, spoon, brazier } from "./house.mjs";
import { thud, drag, pour, creak, snap, snip, knock, breath, heart, latch, chair, drip } from "./body.mjs";
import { blow, guard, ring, breakguard, whoosh, fall } from "./strike.mjs";

export const SFX = { wind, frost, snowstep, murmur, queue, cough, claps, stamp, train, press, chute, lamphum, chain, cart, millgrind, stove, pen, bowlset, spoon, brazier, thud, drag, pour, creak, snap, snip, knock, breath, heart, latch, chair, drip, blow, guard, ring, breakguard, whoosh, fall };
