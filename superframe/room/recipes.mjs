// room/recipes.mjs: the assistive room's transformations as superframe recipes. Each is an ordinary recipe, so the
// same chain runs from the CLI, the MCP tools or the studio. Intensity (1 calm to 5 vivid) sets style, motion pace
// and sound level; nothing is random beyond the seed, which comes from the input, so the same input gives the same
// result every time.
import { createHash } from 'node:crypto';

const seedOf = s => createHash('sha256').update(String(s)).digest('hex').slice(0, 12);
const STYLE = ['echo', 'echo', 'andamento', 'smalti', 'smalti'];
const PALETTE = [
  { ground: '#ebe5d8', ink: '#1d2a3a', accent: '#2f6f63' },
  { ground: '#ebe5d8', ink: '#15130f', accent: '#2f6f63' },
  { ground: '#f3efe6', ink: '#1d2a3a', accent: '#c4632b' },
  { ground: '#0e0f13', ink: '#e9e4d8', accent: '#d79e35' },
  { ground: '#08090c', ink: '#cfd6dd', accent: '#e2552c' },
];
export const KINDS = Object.freeze(['story', 'picture', 'sound', 'numbers-picture', 'numbers-sound', 'code-words']);

export function recipeFor(kind, input, intensity = 2) {
  const i = Math.max(1, Math.min(5, Math.round(intensity))) - 1, text = String(input ?? '').slice(0, 400);
  const base = { schema: 'superframe.recipe/1', seed: seedOf(`${kind}:${text}:${i}`), palette: PALETTE[i] };
  switch (kind) {
    case 'story': return { ...base, size: [480, 270], nodes: [
      { id: 'words', node: 'story.mosaic', params: { text, style: STYLE[i], framesPerBeat: 2 + Math.floor(i / 2), fps: 2 + i, maxBeats: 8, transition: i <= 1 ? 'ground' : i <= 3 ? 'cut' : 'flip', fadeFrames: i === 0 ? 3 : 2 } },
      { id: 'voice', node: 'story.voice', params: { text, beatSeconds: (2 + Math.floor(i / 2)) / (2 + i), voice: i < 2 ? 'pad' : 'pluck' } }],
      out: { motion: 'words', image: 'words', audio: 'voice' } };
    case 'picture': return { ...base, size: [640, 360], nodes: [
      { id: 'art', node: 'nameart.mosaic', params: { text: text.slice(0, 40), style: STYLE[i], phase: 0.3 } }], out: { image: 'art' } };
    case 'sound': return { ...base, size: [640, 240], nodes: [
      { id: 'voice', node: 'story.voice', params: { text, beatSeconds: 1.4 - i * 0.15, voice: i < 2 ? 'pad' : 'bell' } },
      { id: 'ruler', node: 'reveal.pitchruler', in: { events: 'voice' } }],
      out: { audio: 'voice', image: 'ruler' } };
    case 'numbers-picture': return { ...base, size: [640, 400], nodes: [
      { id: 'nums', node: 'core.numbers', params: { values: text } },
      { id: 'sweep', node: 'ledger.sweep', params: { inks: i >= 3 ? 'night' : 'ledger', maxLen: 2 + i }, in: { series: 'nums' } },
      { id: 'done', node: 'compose.finish', params: { scale: 0.8, grain: 1 + i * 0.5, depth: 0.04, shadow: 0.12 }, in: { subject: 'sweep' } }],
      out: { image: 'done' } };
    case 'numbers-sound': return { ...base, size: [640, 240], nodes: [
      { id: 'nums', node: 'core.numbers', params: { values: text } },
      { id: 'notes', node: 'data.sonify', params: { step: 0.5 - i * 0.07, voice: i < 2 ? 'bell' : 'pluck' }, in: { series: 'nums' } }],
      out: { audio: 'notes', image: 'nums' } };
    case 'code-words': return { ...base, size: [640, 360], nodes: [
      { id: 'code', node: 'core.text', params: { text, role: 'code' } },
      { id: 'words', node: 'language.explaincode', in: { text: 'code' } }],
      out: { text: 'words' } };
    default: throw new Error(`room: unknown transformation ${kind}`);
  }
}
