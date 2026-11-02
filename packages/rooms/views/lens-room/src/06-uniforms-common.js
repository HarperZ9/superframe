function setCommon(w, h, mode) {
  gl.uniform2f(U.uRes, w, h);
  sI("uMode", mode);
  sI("uFrame", frame);
  sI("uBounces", 12);
  sI("uSteps", 340);
  sI("uFour", 4);
  sI("uSix", 6);
  sI("uBis", mode == 0 ? 8 : 20);
  sI("uMarch", mode == 0 ? 360 : 900);
  if (U.uMarkP) gl.uniform4f(U.uMarkP, 0, 0, 0, 0);
  if (U.uFacet) gl.uniform1f(U.uFacet, 0);
  if (U.uCrop) gl.uniform2f(U.uCrop, 0, 0);
  sI("uRemap", 0);
  sI("uHasImg", hasImg);
  sI("uImg", 1);
  sI("uPrev", 0);
  sV("uLam", S.lam);
}
