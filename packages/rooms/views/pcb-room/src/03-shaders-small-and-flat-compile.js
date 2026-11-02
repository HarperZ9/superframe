// ======================================================================= Shaders. Small and flat, compile time is reported in Measured.
const VS = `#version 300 es
layout(location=0)in vec3 aP;layout(location=1)in vec3 aN;layout(location=2)in vec3 aC;layout(location=3)in vec2 aU;layout(location=4)in float aM;
uniform mat4 uVP;out vec3 vP,vN,vC;out vec2 vU;flat out int vM;
void main(){vP=aP;vN=aN;vC=aC;vU=aU;vM=int(aM+.5);gl_Position=uVP*vec4(aP,1.);}`;
const FS = `#version 300 es
precision highp float;precision mediump sampler2DShadow;
in vec3 vP,vN,vC;in vec2 vU;flat in int vM;
uniform sampler2D uL0,uL1,uL2,uL3,uD,uO;uniform sampler2DShadow uS;
uniform vec3 uE,uLd,uMk;uniform mat4 uLV;uniform float uCut,uCutV,uOA,uDim,uSeed,uZs,uDirect;uniform vec2 uTx;uniform vec4 uLz[4];uniform int uLn;
out vec4 o;
float h21(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+uSeed)*43758.5453);}
vec3 env(vec3 d,float r){float t=d.z*.5+.5,s=.03+r*.5;vec3 c=mix(vec3(.008,.009,.012),vec3(.09,.095,.115),t*t);
c+=vec3(1.7,1.65,1.55)*smoothstep(.93-s,.93+s*.2,dot(d,normalize(vec3(.35,-.3,.9))));c+=vec3(.5,.6,.8)*smoothstep(.86-s,.82+s*.3,dot(d,normalize(vec3(-.8,.25,.55))));return c*(1.-r*.35);}
vec3 shade(vec3 N,vec3 alb,vec3 F0,float r,float sh){vec3 V=normalize(uE-vP),H=normalize(V+uLd);float nl=max(dot(N,uLd),0.),nv=max(dot(N,V),.02),nh=max(dot(N,H),0.),a=r*r,a2=a*a,dn=nh*nh*(a2-1.)+1.;
float D=a2/(3.1416*dn*dn),G=.5/(nl*(nv*(1.-a)+a)+nv*(nl*(1.-a)+a)+.001);vec3 F=F0+(1.-F0)*pow(1.-max(dot(H,V),0.),5.),Fv=F0+(max(vec3(1.-r),F0)-F0)*pow(1.-nv,5.);
return (alb/3.1416+D*G*F)*nl*sh*vec3(3.,2.9,2.7)+alb*.3*env(N,1.)+Fv*env(reflect(-V,N),r);}
vec3 lay(int i,vec2 u){if(i==0)return texture(uL0,u).rgb;if(i==1)return texture(uL1,u).rgb;if(i==2)return texture(uL2,u).rgb;return texture(uL3,u).rgb;}
vec3 fr4(vec2 p){float w=.5+.5*sin(p.x*24.)*sin(p.y*24.);return mix(vec3(.26,.26,.09),vec3(.38,.37,.15),w);}
void main(){if(vM!=9&&vP.y<uCut)discard;vec3 N=normalize(vN);if(!gl_FrontFacing)N=-N;
if(vM<12&&vM!=11&&!gl_FrontFacing&&uCut>-1e4&&vM<2){o=vec4(vC*.25,1.);return;}
vec4 lc=uLV*vec4(vP+N*.02,1.);vec3 lp=lc.xyz*.5+.5;float sh=(lp.x<0.||lp.y<0.||lp.x>1.||lp.y>1.)?1.:texture(uS,vec3(lp.xy,lp.z-.0012));
vec3 c=vec3(0.);vec2 u=vU;
if(vM==0)c=shade(N,vC,vec3(.04),.45,sh);
else if(vM==1)c=shade(N,vec3(0.),vC,.28,sh);
else if(vM==2||vM==3){if(texture(uD,u).r>.5)discard;int i=vM==2?0:uLn-1;vec3 t=lay(i,u);float dx=lay(i,u+vec2(uTx.x,0.)).r-lay(i,u-vec2(uTx.x,0.)).r,dy=lay(i,u+vec2(0.,uTx.y)).r-lay(i,u-vec2(0.,uTx.y)).r;
 vec3 nb=normalize(vec3(-dx*.55,-dy*.55,1.))*vec3(1.,1.,vM==2?1.:-1.);float cu=t.r,op=smoothstep(.35,.65,t.g),sk=smoothstep(.35,.65,t.b);
 vec3 mk=mix(uMk*.82+vec3(.008,.012,.004),uMk*1.5+vec3(.03,.018,.012),cu);vec3 cm=shade(nb,mk,vec3(.045),.2,sh);
 vec3 cp=shade(nb,vec3(0.),vec3(1.,.78,.36),.33,sh);vec3 cb=shade(N,fr4(vP.xy),vec3(.04),.6,sh);vec3 cs=shade(nb,vec3(.86,.86,.82),vec3(.04),.65,sh);
 c=mix(cm,mix(cb,cp,cu),op);c=mix(c,cs,sk*(1.-op));if(uDim>0.)c*=1.-uDim;if(uOA>0.){vec4 ov=texture(uO,u);c=mix(c*(1.-.6*uOA),ov.rgb*1.1,ov.a*uOA);}}
else if(vM==4)c=shade(N,fr4(vP.xz*vec2(1.,1.5)),vec3(.04),.6,sh);
else if(vM==5){int i=int(vC.x+.5);if(lay(i,u).r<.5||texture(uD,u).r>.5&&vC.y>.5)discard;c=shade(N,vec3(.3,.11,.04),vec3(.82,.42,.22),.38,sh);}
else if(vM==6){if(texture(uD,u).r>.5)discard;if(h21(gl_FragCoord.xy)>vC.y)discard;c=shade(N,fr4(vP.xy),vec3(.04),.6,sh);}
else if(vM==7){int i=int(vC.x+.5);if(lay(i,u).g>.5||texture(uD,u).r>.5)discard;if(h21(gl_FragCoord.xy+7.)>.72)discard;c=shade(N,uMk*1.1,vec3(.045),.2,sh);}
else if(vM==8){if(lay(0,u).b<.5)discard;c=shade(N,vec3(.9),vec3(.04),.65,sh);}
else if(vM==9){vec2 q=vec2(u.x,uCutV);if(texture(uD,q).r>.5)discard;float z=vP.z/uZs;vec3 base=vec3(.5,.46,.26);bool hit=false;for(int i=0;i<uLn;i++){if(z<=uLz[i].x&&z>=uLz[i].y){hit=lay(i,q).r>.5;}}
 if(hit)c=shade(N,vec3(.75,.36,.18),vec3(.9,.55,.4),.5,1.);
 else if(z>uLz[0].x+.001||z<uLz[uLn-1].y-.001){if(lay(z>0.?0:uLn-1,q).g>.5)discard;c=shade(N,uMk*1.6,vec3(.045),.4,1.);}
 else c=shade(N,fr4(vec2(vP.x*2.,z*90.)),vec3(.04),.6,1.);}
else if(vM==10){vec4 ov=texture(uO,vec2(u.x,.5));c=ov.rgb*1.3;}
else if(vM==11)c=shade(N,vC,vec3(.02),.7,sh);
if(uDirect>.5){c=c*(2.51*c+.03)/(c*(2.43*c+.59)+.14);c=pow(clamp(c,0.,1.),vec3(1./2.2));}
o=vec4(c,1.);}`;
const VS2 = `#version 300 es
layout(location=0)in vec3 aP;uniform mat4 uVP;void main(){gl_Position=uVP*vec4(aP,1.);}`;
const FS2 = `#version 300 es
precision mediump float;void main(){}`;
const VQ = `#version 300 es
out vec2 u;void main(){vec2 p=vec2(float(gl_VertexID&1),float((gl_VertexID>>1)&1));u=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const FQ = `#version 300 es
precision highp float;in vec2 u;uniform sampler2D t;uniform float k,gr;out vec4 o;void main(){vec3 c=texture(t,u).rgb*k;if(gr>.5){c=c*(2.51*c+.03)/(c*(2.43*c+.59)+.14);c=pow(clamp(c,0.,1.),vec3(1./2.2));}o=vec4(c,1.);}`;
const GLS = {};
function mkProg(vs, fs, names) {
  const gl = GLS.gl,
    p = gl.createProgram();
  for (const [t, s] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ]) {
    const h = gl.createShader(t);
    gl.shaderSource(h, s);
    gl.compileShader(h);
    gl.attachShader(p, h);
    p["_" + t] = h;
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const m =
      gl.getProgramInfoLog(p) +
      "\n" +
      gl.getShaderInfoLog(p["_" + gl.VERTEX_SHADER]) +
      "\n" +
      gl.getShaderInfoLog(p["_" + gl.FRAGMENT_SHADER]);
    throw new Error("Shader failed: " + m);
  }
  const u = {};
  for (const n of names) u[n] = gl.getUniformLocation(p, n);
  return { p, u };
}
function initGL() {
  const c = $("gl"),
    gl = c.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
  if (!gl) throw new Error("This page needs WebGL2, and this browser did not provide it.");
  GLS.gl = gl;
  GLS.hdr = !!(
    gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float")
  );
  GLS.aniso = gl.getExtension("EXT_texture_filter_anisotropic");
  const t0 = performance.now();
  GLS.main = mkProg(VS, FS, [
    "uVP",
    "uL0",
    "uL1",
    "uL2",
    "uL3",
    "uD",
    "uO",
    "uS",
    "uE",
    "uLd",
    "uMk",
    "uLV",
    "uCut",
    "uCutV",
    "uOA",
    "uDim",
    "uSeed",
    "uZs",
    "uDirect",
    "uTx",
    "uLz",
    "uLn",
  ]);
  GLS.dep = mkProg(VS2, FS2, ["uVP"]);
  GLS.q = mkProg(VQ, FQ, ["t", "k", "gr"]);
  gl.finish();
  GLS.compileMs = performance.now() - t0;
  GLS.empty = gl.createVertexArray();
  const sm = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, sm);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.DEPTH_COMPONENT24,
    2048,
    2048,
    0,
    gl.DEPTH_COMPONENT,
    gl.UNSIGNED_INT,
    null
  );
  for (const [k, v] of [
    [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
    [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
    [gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE],
    [gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL],
    [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
    [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
  ])
    gl.texParameteri(gl.TEXTURE_2D, k, v);
  GLS.smTex = sm;
  GLS.smFB = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, sm && GLS.smFB);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, sm, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  GLS.tex = {};
  for (const n of ["L0", "L1", "L2", "L3", "D", "O"]) {
    GLS.tex[n] = gl.createTexture();
  }
}
function setupTargets() {
  const gl = GLS.gl,
    c = $("gl"),
    r = c.getBoundingClientRect(),
    dpr = Math.min(devicePixelRatio || 1, 2),
    w = Math.max(2, Math.round(r.width * dpr)),
    h = Math.max(2, Math.round(r.height * dpr));
  if (c.width === w && c.height === h && GLS.tW === w) return false;
  c.width = w;
  c.height = h;
  GLS.tW = w;
  GLS.tH = h;
  for (const k of ["msFB", "rsFB", "acFB"]) if (GLS[k]) gl.deleteFramebuffer(GLS[k]);
  for (const k of ["msC", "msD"]) if (GLS[k]) gl.deleteRenderbuffer(GLS[k]);
  for (const k of ["rsT", "acT"]) if (GLS[k]) gl.deleteTexture(GLS[k]);
  const fmt = GLS.hdr ? gl.RGBA16F : gl.RGBA8;
  GLS.msC = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, GLS.msC);
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 4, fmt, w, h);
  GLS.msD = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, GLS.msD);
  gl.renderbufferStorageMultisample(gl.RENDERBUFFER, 4, gl.DEPTH_COMPONENT24, w, h);
  GLS.msFB = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, GLS.msFB);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, GLS.msC);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, GLS.msD);
  const mk = () => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return [t, f];
  };
  [GLS.rsT, GLS.rsFB] = mk();
  [GLS.acT, GLS.acFB] = mk();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return true;
}
