// Every cast member the figure drawer can draw, by id: the drawer and the figure workers read the same map.
import * as lamb from "../cast/lamb.mjs";
import * as fennick from "../cast/fennick.mjs";
import * as marrow from "../cast/marrow.mjs";
import * as warden from "../cast/warden.mjs";
import * as salvor from "../cast/salvor.mjs";
import * as keel from "../cast/keel.mjs";
import * as sabine from "../cast/sabine.mjs";
import * as wenna from "../cast/wenna.mjs";
import * as merrow from "../cast/merrow.mjs";
import { GORM, HOBB, FEWELL, STRAND, BRIGHT, COE } from "../cast/lamplighter.mjs";
import * as FOLK from "../cast/folk.mjs";
// The Quota's slice cast (cast/quota.mjs); the Requisition Captain is HOLT in the script
import { NED, MARY, ABEL, ABEL_ERA1, PELL, PELL_ADULT, WILL, TOMAS, AARON, ANNI, ANNI_ADULT, CAPTAIN } from "../cast/quota.mjs";
// and the rest of its speakers (cast/quota2.mjs); Krall has none yet and stands in as the folk set's pardew
import { EDIE, DAVEY, ROSE, BET, ILO, TESK, LIL, GEDGE, PASK, MOTT } from "../cast/quota2.mjs";
const QUOTA = { ned: NED, mary: MARY, abel: ABEL, abel_era1: ABEL_ERA1, pell: PELL, pell_adult: PELL_ADULT, will: WILL, tomas: TOMAS, aaron: AARON, anni: ANNI, anni_adult: ANNI_ADULT, holt: CAPTAIN,
  edie: EDIE, davey: DAVEY, rose: ROSE, bet: BET, ilo: ILO, tesk: TESK, lil: LIL, gedge: GEDGE, pask: PASK, mott: MOTT };
export const CAST = { lamb, fennick, marrow, warden, salvor, keel, sabine, wenna, merrow, gorm: GORM, hobb: HOBB, fewell: FEWELL, strand: STRAND, bright: BRIGHT, coe: COE, ...Object.fromEntries(Object.entries(FOLK).map(([k, m]) => [k.toLowerCase(), m])), ...QUOTA };
