function setScat(St) {
  if (!U.uScat) return;
  sF("uScat", St.scatOn ? St.sig : 0);
  sF("uHG", St.hg);
  sF("uAlb", St.alb);
  sI("uDelta", 96);
}
