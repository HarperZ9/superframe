// Exchange Square at the same dawn with the siding empty (the wide lens's second state).
import { square } from "../worlds/square.mjs";
import S from "./q_square_wide.mjs";
const R = square({ train: false });
export default { ...S, name: "q_square_wide_quiet", world: R.world, lights: R.lights, marks: R.marks, variants: { dawn: S.variants.dawn }, notes: "The Quota slice, the wide lens: the siding empty." };
