// The talk panel's speaker header (the portrait slot's name and face; ui/play.mjs renderTalk).
//   talkSpeaker(log, talk) -> { speaker, face }   face: the log line that sets the face, or null
// Only the current node's lines count. A node reached by go: inside one beat keeps the earlier
// node's lines in the log, and the last named line there is not the speaker now (era 5's share,
// narration under TOM, came up headed LEON from the video before it; tests/talkspeaker.test.mjs).
export function talkSpeaker(log, talk) {
  if (!talk) return { speaker: "", face: null };
  const here = talk.node ? log.filter((l) => l.node === talk.node) : log;
  const said = [...here].reverse().find((l) => l.kind === "line" && l.who), speaker = said ? said.who : talk.speaker || "";
  const face = [...here].reverse().find((l) => l.face || (l.dir && l.who && String(l.who).toLowerCase() === String(speaker).toLowerCase())) || null;
  return { speaker, face };
}
