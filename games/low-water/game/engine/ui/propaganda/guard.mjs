// What the propaganda may and may not draw (the UI art lead's, 2026-10-22; author direction: the real faces
// of the Tarn, Hesh and Vell distinct and dignified, caricature only in the in-world printed matter, invented
// features only, nothing from real-world racist caricature). A caricature is made from parameters, and every
// parameter set passes this check before anything is drawn; a test holds the check with a control that fails.
//   checkCaricature(params) -> [] (fine) or ["why", ...]
//
// The propaganda's cruelty is in what it says the people do (the town's myths drawn literally: grain in holes
// under the goats, the tallow, the tide), in the leer it gives every face alike, and in the labels. It never
// exaggerates a body's colour or a face's features, and it never draws people as animals or vermin: those are
// the vocabulary of real racist caricature, and the game does not borrow it.
export const BANNED = {
  skin: "no change to skin colour or tone",
  nose: "no exaggerated nose", lips: "no exaggerated lips or mouth shape", eyes: "no changed eye shape or size",
  ears: "no exaggerated ears", skull: "no changed head or skull shape", hair: "no hair texture as a racial marker",
  animal: "no animal or vermin bodies (rats, apes, insects, dogs)", blood: "no blood libel or child harm",
  disease: "no people as disease (the myth is drawn as a rumour on a placard, not as a body)",
};
// what a caricature may be built from: the peoples' invented dress and customs, and the myths as props
export const ALLOWED = new Set(["people", "myth", "props", "pose", "grin", "crowd", "label", "dress", "seed", "w", "h", "era"]);

export function checkCaricature(p = {}) {
  const why = [];
  for (const k of Object.keys(p)) {
    if (BANNED[k]) why.push(`${k}: ${BANNED[k]}`);
    else if (!ALLOWED.has(k)) why.push(`${k}: not an allowed parameter (allowed: ${[...ALLOWED].join(", ")})`);
  }
  for (const prop of p.props || []) if (/rat|ape|monkey|insect|louse|vermin|dog|pig|blood|child/i.test(prop)) why.push(`props.${prop}: ${BANNED.animal}`);
  return why;
}
