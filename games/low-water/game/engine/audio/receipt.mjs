// Renders out through superstack (vendor/superstack.mjs, v0.2.0, pinned in vendor/SUPERSTACK.sha256): its
// s16le quantiser and WAV writer, its BS.1770 meter, and a sealed receipt per file. The score's own targets
// sit below superstack's music target of -14 LUFS on purpose (design/audio/SCORE.md section 8): a game score
// plays under speech, which superstack itself puts at -16 LUFS, so the score's listening renders sit at -16
// to -20 and the receipt records both the score's target and superstack's music verdict.
import * as ss from "./vendor/superstack.mjs";
import { truePeak } from "./lib/analysis.mjs";
import { SR } from "./lib/dsp.mjs";

const interleave = (pair) => { const n = pair[0].length, out = new Float32Array(n * 2); for (let i = 0; i < n; i++) { out[2 * i] = pair[0][i]; out[2 * i + 1] = pair[1][i]; } return out; };

export function sealRender({ id, title, pair, seed, target, game, producerVersion = "2026-10-22" }) {
  const pcm = ss.quantizeS16(interleave(pair)), frames = pair[0].length;
  const floats = new Float64Array(pcm.length >> 1), dv = new DataView(pcm.buffer);
  for (let i = 0; i < floats.length; i++) floats[i] = dv.getInt16(i * 2, true) / 32767;
  const lufs = ss.integratedLufs(floats, SR, 2), tp = truePeak(pair);
  const scene = { kind: "superstack.sound/1", seed: `low-water-score/${id}/${seed}`, rate: SR, channels: 2, duration_samples: frames };
  const media = { kind: "audio", content: "music", rate: SR, channels: 2, format: "s16le", frames, duration_flicks: frames * ss.flicksPerSample(SR),
    access: { autoplay: false, captions: null, transcript: false, reduced_sound: "silent" } };
  const receipt = ss.makeReceipt({
    producer: "low-water-score", version: producerVersion, backend: "node-float32", scene, media, content: pcm, seedRule: "fnv1a32-mulberry32",
    outputs: { title, meter: ss.METER, integrated_lufs: lufs == null ? null : ss.round6(lufs), true_peak_dbtp: ss.round6(tp),
      score_target_lufs: target, in_game_offset_db: game, superstack_music_check: ss.loudnessCheck("music", lufs, tp),
      target_reason: "A game score sits under dialogue (superstack speech target -16 LUFS), so it is mastered below the -14 LUFS music target." },
    doesNotProve: ["A PCM hash says nothing about how the piece sounds or whether it is good music.",
      "The loudness is of this listening render; the game plays the stems through its own mixer at the in-game offset.",
      "Synthesised instruments are measured against design targets, not against recordings."],
  });
  const errors = ss.verifyReceipt(receipt);
  return { wav: ss.wavS16(pcm, SR, 2), receipt, errors, lufs, tp };
}
