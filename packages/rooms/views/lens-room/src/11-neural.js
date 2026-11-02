// ======================================================================= Neural lens
// Cortex sheet x = log r, y = theta. Each step: a' = a + dt(-a + tanh(gain*(K*a) + input)), K a Mexican hat of two Gaussians, optionally stretched along an axis on the sheet. Stretch direction chooses rings, rays or spirals; no stretch gives labyrinths and, with the bias from the image, lattices.
let CX = null,
  cxProg = null,
  cxN = 0;
const cxReset = () => {
  cxN = 0;
};
function ensureCX() {
  if (CX) return;
  gl.getExtension("OES_texture_float_linear");
  const mk = () => {
    const t = tgt(256, 256);
    gl.bindTexture(gl.TEXTURE_2D, t.t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  };
  CX = { a: mk(), b: mk() };
  for (const x of [CX.a, CX.b]) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, x.f);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
  cxProg = prog(
    VS,
    `#version 300 es
precision highp float;uniform sampler2D a,img;uniform float uG,uRange,uAn,uAx,uSeed;uniform vec2 uR;out vec4 o;
float h(vec2 p){p=fract(p*vec2(123.34,456.21)+uSeed);p+=dot(p,p+45.32);return fract(p.x*p.y)-.5;}
void main(){ivec2 ip=ivec2(gl_FragCoord.xy);vec2 q=gl_FragCoord.xy/256.;float cur=texelFetch(a,ip,0).r;
 float sum=0.,se=2.*uRange*uRange,si=2.*4.*uRange*uRange;float cs=cos(uAx),sn=sin(uAx),k=1.+uAn;
 float ne=0.,ni=0.,e=0.,ii=0.;
 for(int y=-9;y<=9;y++)for(int x=-9;x<=9;x++){vec2 v=vec2(x,y);vec2 w=vec2(cs*v.x+sn*v.y,-sn*v.x+cs*v.y);w.x*=k;w.y/=k;float d=dot(w,w);float ge=exp(-d/se),gi=exp(-d/si);ne+=ge;ni+=gi;ivec2 c=ivec2(clamp(ip.x+x,0,255),(ip.y+y+256)%256);float s=texelFetch(a,c,0).r;e+=ge*s;ii+=gi*s;}
 float L=e/ne-ii/ni;
 // Input: the image through the eye's log-polar map, r = 0.01 exp(x ln 72).
 float rr=.01*exp(q.x*log(72.)),th=(q.y-.5)*6.28318;vec2 uv=vec2(rr*cos(th),rr*sin(th))*uR.y/uR+.5;vec3 c=texture(img,uv).rgb;float I=dot(c,vec3(.3,.6,.1));I=I/(1.+I)-.3;
 float nx=cur+.25*(-cur+tanh(uG*L*3.+.06*I+.012*h(q)));o=vec4(nx,I,L,1);}`
  );
}
function stepCortex() {
  ensureCX();
  if (cxN > 900) return true;
  const u = (n) => gl.getUniformLocation(cxProg, n);
  gl.useProgram(cxProg);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, A.t);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(u("a"), 0);
  gl.uniform1i(u("img"), 1);
  gl.uniform1f(u("uG"), S.nGain);
  gl.uniform1f(u("uRange"), S.nRange);
  gl.uniform1f(u("uAn"), S.nAnis);
  gl.uniform1f(u("uAx"), (S.nAxis * Math.PI) / 180);
  gl.uniform2f(u("uR"), W, H);
  const steps = rm.matches ? 4 : 3;
  for (let i = 0; i < steps; i++) {
    gl.uniform1f(u("uSeed"), (cxN * 0.137) % 1);
    gl.bindTexture(gl.TEXTURE_2D, CX.a.t);
    gl.bindFramebuffer(gl.FRAMEBUFFER, CX.b.f);
    gl.viewport(0, 0, 256, 256);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [CX.a, CX.b] = [CX.b, CX.a];
    cxN++;
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
  if (cxN % 30 < 3) {
    const px = new Float32Array(4 * 256 * 256);
    gl.bindFramebuffer(gl.FRAMEBUFFER, CX.a.f);
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.FLOAT, px);
    let s = 0;
    for (let i = 0; i < 256 * 256; i++) s += px[i * 4] * px[i * 4];
    last.cortexRms = Math.sqrt(s / (256 * 256));
    const e = $("nrms");
    if (e) e.textContent = last.cortexRms.toFixed(3);
  }
  return true;
}
