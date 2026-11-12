// What the game remembers of every conversation: nodes visited and how often, every option
// chosen (by key, with its words), the inner voices already heard, and the full history log of
// every line shown, with the clock and the node it came from.
//   state.memory = { visits: { node: n }, said: { key: label }, heard: { key: 1 }, log: [...] }
export function createMemory(G) {
  const M = () => (G.state.memory ||= { visits: {}, said: {}, heard: {}, log: [] });
  return {
    visit: (id) => { M().visits[id] = (M().visits[id] || 0) + 1; },
    visits: (id) => M().visits[id] || 0,
    say: (key, label) => { M().said[key] = label; },
    said: (key) => key in M().said,
    hear: (key) => { M().heard[key] = 1; },
    heard: (key) => !!M().heard[key],
    log: (entry) => { M().log.push({ at: G.clock(), ...entry }); },
    history: () => M().log,
  };
}
