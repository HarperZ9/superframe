/* Page wiring: the living ground, then the chain, the axes and the working tables. */
(function (g) {
  "use strict";
  const T = g.Transducers, V = g.TView;
  g.Field.setHasher((d) => g.sha256hex(d));

  /* The ground is a live Turing field from the kernel itself, drawn as a halftone in the title's band. Still when the reader asks. */
  const hero = () => {
    const c = document.getElementById("hero"), N = 72, A = 4.5, Du = 2, Dv = 16, u = T.brusselatorInit(N, A, 8.2, 3, 0.05);
    let v = T.turing({ A, B: 8.2, Du, Dv, dt: 0.01, steps: 1500 }).forward(T.grid("x", N, N, u, "1", { components: 2 })).values, tick = 0;
    const paint = () => {
      const W = c.parentElement.clientWidth, H = Math.round(Math.min(220, W * 0.36)), x = V.setup(c, W, H), ink = V.css("--ink"), acc = V.css("--red"), cell = Math.max(5, W / 170), cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
      x.clearRect(0, 0, W, H);
      let a = Infinity, b = -Infinity; for (let i = 0; i < N * N; i++) { const q = v[2 * i]; if (q < a) a = q; if (q > b) b = q; }
      for (let y = 0; y < rows; y++) for (let k = 0; k < cols; k++) {
        const i = (y % N) * N + (k % N), t = (v[2 * i] - a) / (b - a + 1e-9), r = (cell / 2) * Math.sqrt(t) * 0.92;
        x.fillStyle = (k * 3 + y) % 61 === 0 ? acc : ink; x.beginPath(); x.arc((k + 0.5) * cell, (y + 0.5) * cell, r, 0, 2 * Math.PI); x.fill();
      }
    };
    const loop = () => {
      if (!g.Kit || !g.Kit.still()) {
        tick++;
        const B = 8.2 + 0.9 * Math.sin(tick / 120);
        v = T.turing({ A, B, Du, Dv, dt: 0.01, steps: 6 }).forward(T.grid("x", N, N, v, "1", { components: 2 })).values;
        paint();
      }
      setTimeout(() => requestAnimationFrame(loop), 40);
    };
    addEventListener("resize", paint); if (g.Kit) g.Kit.on(paint); paint(); loop();
  };
  const cell = (s, cls) => `<td${cls ? ` class="${cls}"` : ""}>${s}</td>`;
  const ledgerTable = (el, name, mk) => {
    const d = mk(), r = T.chain(d.src, d.kernels, d.opt);
    const rows = r.rows.map((x) => `<tr${x.overBudget ? ' class="is-over"' : ""}><th scope="row">${x.id}</th>${cell(x.grade || "-")}${cell(V.fmt(x.bytes), "n")}${cell(x.ms.toFixed(1), "n")}${cell(V.fmt(x.bitsLost), "n")}${cell(V.fmt(x.keptMeasured), "n")}${cell(V.fmt(x.budget.I), "n")}${cell(V.fmt(x.budget.signal), "n")}${cell(V.fmt(x.budget.noise), "n")}${cell(V.fmt(x.budget.sbw), "n")}${cell(V.fmt(x.budget.tbw), "n")}${cell(x.overBudget ? "over" : "inside")}${cell(x.status)}</tr>`).join("");
    el.insertAdjacentHTML("beforeend", `<h3>${name}</h3><div class="k-scroll"><table><thead><tr><th scope="col">step</th><th scope="col">grade</th><th scope="col">bytes</th><th scope="col">ms</th><th scope="col">lost</th><th scope="col">kept</th><th scope="col">budget</th><th scope="col">signal</th><th scope="col">floor</th><th scope="col">space modes</th><th scope="col">time modes</th><th scope="col">bound</th><th scope="col">values</th></tr></thead><tbody>${rows}</tbody></table></div>`);
  };
  const catalogue = (el) => {
    const G = [["lens and mirror", "thin lens, PSF, mirror, metamer"], ["transparency", "Beer-Lambert, index match, Porter-Duff, density stack, map"], ["pixels", "sample, quantise, dither, Bayer, Huffman, bit planes"], ["analog", "ADC, DAC, RC, Butterworth"], ["noise", "shot, Johnson, 1/f, film grain, stochastic resonance"], ["time", "shutter, persistence, film, delay, Gabor"], ["organic and biologic", "Hill, retina, cable, Hodgkin-Huxley, Turing, phyllotaxis, film curve"], ["machine", "tiny network, linear probe"], ["bioinformatic", "one DP for alignment and line breaks, k-mer, PWM, Felsenstein"], ["space", "modal basis, heat, sound, fog, Varadhan, SDF, lattices"], ["structure", "invariants, persistence, contact map, Milo z, the hollow"]];
    el.innerHTML = G.map(([a, b]) => `<tr><th scope="row">${a}</th><td>${b}</td></tr>`).join("");
  };
  addEventListener("DOMContentLoaded", () => {
    hero();
    g.TChain.init(document.getElementById("tr-list"), document.getElementById("tr-sum"));
    g.TAxes.init();
    const led = document.getElementById("tr-ledgers");
    ledgerTable(led, "Photon to pixel", g.TChain.PRESETS.camera);
    ledgerTable(led, "Photon to spike", g.TChain.PRESETS.retina);
    ledgerTable(led, "Text to motif spectrum", g.TChain.PRESETS.text);
    ledgerTable(led, "DNA to alignment", g.TChain.PRESETS.dna);
    catalogue(document.getElementById("tr-cat"));
  });
})(globalThis);
