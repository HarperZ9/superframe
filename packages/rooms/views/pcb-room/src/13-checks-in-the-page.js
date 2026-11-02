// ======================================================================= Checks in the page
let chkTok = 0;
function runChecksUI() {
  const tok = ++chkTok,
    o = $("chkOut"),
    sum = $("chkSum");
  o.textContent = "";
  sum.textContent = "Running";
  const g = checksGen((k) => S.cache.get("0|" + EXAMPLES[k]));
  let done = 0,
    last;
  const t0 = performance.now();
  const show = (out) => {
    for (; done < out.length; done++) {
      const c = out[done],
        e = document.createElement("div");
      e.className = "chk";
      const got = typeof c.got === "number" ? (+c.got).toPrecision(5) : c.got,
        want = (+c.want).toPrecision(5);
      e.innerHTML =
        '<b class="' +
        (c.pass ? "ok" : "no") +
        '">' +
        (c.pass ? "pass" : "FAIL") +
        '</b><span></span><span class="n"></span>';
      e.children[1].textContent = c.name;
      e.children[2].textContent =
        "got " +
        got +
        ", expected " +
        want +
        " " +
        c.unit +
        ", error " +
        (c.err * 100).toFixed(2) +
        " percent" +
        (c.note ? ". " + c.note : "");
      o.appendChild(e);
    }
  };
  const tick = () => {
    if (tok !== chkTok) return;
    const t = performance.now();
    let r;
    for (;;) {
      r = g.next();
      if (r.done || performance.now() - t > 10) break;
    }
    if (!r.done && Array.isArray(r.value)) {
      last = r.value;
      show(last);
    }
    if (r.done) {
      last = r.value;
      show(last);
      const bad = last.filter((c) => !c.pass).length;
      sum.textContent =
        last.length -
        bad +
        " of " +
        last.length +
        " pass, in " +
        ((performance.now() - t0) / 1000).toFixed(1) +
        " s. Gerber not checked in a commercial viewer: none was available.";
      sum.style.color = bad ? "var(--bad)" : "var(--good)";
      if (S.d && S.d.arrayInfo) renderArray();
      return;
    }
    setTimeout(tick, 4);
  };
  tick();
}
