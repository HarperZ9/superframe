// SPDX-License-Identifier: FSL-1.1-MIT
// The GPU step for the 2D view: IF SSP RK3 on a 2/3-dealiased vorticity spectrum, the same scheme as Spectral2 with
// scheme "ssp3". One small program per job, flat loops only. Fields live in RGBA32F: RG holds one complex field and
// BA another, so one FFT pass transforms two fields at once. Index (x, y) in a texture is index y*nx + x on the CPU.
export const FLUID_VS = "#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0,1);}";
const HEAD = "#version 300 es\nprecision highp float;precision highp sampler2D;out vec4 o;\n";
const WAVE = "uniform float uN;vec2 kOf(ivec2 q){vec2 k=vec2(q);if(k.x>=uN*.5)k.x-=uN;if(k.y>=uN*.5)k.y-=uN;return k;}\nbool keep(vec2 k){return abs(k.x)<uN/3.&&abs(k.y)<uN/3.;}\n";
const C = "vec2 cm(vec2 a,vec2 b){return vec2(a.x*b.x-a.y*b.y,a.x*b.y+a.y*b.x);}\n";

/** One Stockham stage over both complex pairs. uSub is 2, 4, ..., N; uSign is -1 forward and +1 inverse. uScale applies on the last stage. */
export const FLUID_FFT = HEAD + C + `uniform sampler2D F;uniform int uAxis;uniform float uSub,uN,uSign,uScale;
void main(){ivec2 q=ivec2(gl_FragCoord.xy);float i=float(uAxis==0?q.x:q.y);
 float e=floor(i/uSub)*(uSub*.5)+mod(i,uSub*.5);int a=int(e),b=int(e+uN*.5);
 vec4 A=texelFetch(F,uAxis==0?ivec2(a,q.y):ivec2(q.x,a),0),B=texelFetch(F,uAxis==0?ivec2(b,q.y):ivec2(q.x,b),0);
 float th=uSign*6.283185307179586*i/uSub;vec2 w=vec2(cos(th),sin(th));
 o=vec4(A.xy+cm(w,B.xy),A.zw+cm(w,B.zw))*uScale;}`;
/** From the vorticity spectrum (RG) to u + i v in RG and w_x + i w_y in BA, spectral. */
export const FLUID_PREP = HEAD + WAVE + `uniform sampler2D W;
void main(){ivec2 q=ivec2(gl_FragCoord.xy);vec2 k=kOf(q),w=texelFetch(W,q,0).xy;float k2=dot(k,k);
 if(k2==0.||!keep(k)){o=vec4(0);return;}
 vec2 p=w/k2,u=vec2(-k.y*p.y,k.y*p.x),v=vec2(k.x*p.y,-k.x*p.x),wx=vec2(-k.x*w.y,k.x*w.x),wy=vec2(-k.y*w.y,k.y*w.x);
 o=vec4(u.x-v.y,u.y+v.x,wx.x-wy.y,wx.y+wy.x);}`;
/** Display fields from the spectrum: omega + i Sn in RG, Ss in B. Inverse transformed once per frame. */
export const FLUID_VIEW = HEAD + WAVE + `uniform sampler2D W;
void main(){ivec2 q=ivec2(gl_FragCoord.xy);vec2 k=kOf(q),w=texelFetch(W,q,0).xy;float k2=dot(k,k);
 if(k2==0.||!keep(k)){o=vec4(0);return;}
 vec2 p=w/k2,sn=-2.*k.x*k.y*p,ss=(k.x*k.x-k.y*k.y)*p;
 o=vec4(w.x-sn.y,w.y+sn.x,ss);}`;
/** Physical fields to the nonlinear term (R) and wall force (BA). U: u,v,w_x,w_y. V: omega in R. S: flow ux,uy, chi, div. T: wall target. */
export const FLUID_NL = HEAD + `uniform sampler2D U,V,S,T;uniform float uEta;uniform vec2 uMean;
void main(){ivec2 q=ivec2(gl_FragCoord.xy);vec4 g=texelFetch(U,q,0),f=texelFetch(S,q,0);
 vec2 vel=g.xy+f.xy+uMean;float w=texelFetch(V,q,0).r;
 vec2 force=f.z>0.?-f.z/uEta*(g.xy+uMean-texelFetch(T,q,0).xy):vec2(0);
 o=vec4(-(vel.x*g.z+vel.y*g.w)-w*f.w,0,force);}`;
/** Spectral right side: the transformed nonlinear term, the curl of the wall force, and Kolmogorov drive. */
export const FLUID_RHS = HEAD + WAVE + `uniform sampler2D N;uniform float uDrive,uKf;
void main(){ivec2 q=ivec2(gl_FragCoord.xy);vec2 k=kOf(q);if(!keep(k)||dot(k,k)==0.){o=vec4(0);return;}
 vec4 a=texelFetch(N,q,0),b=texelFetch(N,(ivec2(int(uN))-q)%int(uN),0);
 vec2 fx=.5*vec2(a.z+b.z,a.w-b.w),fy=.5*vec2(a.w+b.w,b.z-a.z);
 vec2 d=vec2(0);if(k.x==0.&&abs(k.y)==uKf)d=vec2(uDrive,0);
 o=vec4(a.xy+vec2(-k.x*fy.y+k.y*fx.y,k.x*fy.x-k.y*fx.x)+d,0,0);}`;
/** One SSP RK3 stage with the integrating factor: a E^p w0 + b E^q (wc + dt r). Heun grows at the cut-off under weak viscosity; this does not, below 1.73. */
export const FLUID_UPDATE = HEAD + WAVE + `uniform sampler2D W0,Wc,R;uniform float uNu,uDt,uDrag,uA,uP,uB,uQ;
void main(){ivec2 q=ivec2(gl_FragCoord.xy);vec2 k=kOf(q);float k2=dot(k,k);if(!keep(k)||k2==0.){o=vec4(0);return;}
 float l=-(uNu*k2+uDrag)*uDt;
 o=vec4(uA*exp(l*uP)*texelFetch(W0,q,0).xy+uB*exp(l*uQ)*(texelFetch(Wc,q,0).xy+uDt*texelFetch(R,q,0).xy),0,0);}`;
/** Adds a Gaussian vortex at uAt to the spectrum: the analytic transform of a stir. */
export const FLUID_STIR = HEAD + WAVE + `uniform sampler2D W;uniform vec2 uAt;uniform float uAmp,uR;
void main(){ivec2 q=ivec2(gl_FragCoord.xy);vec2 k=kOf(q),w=texelFetch(W,q,0).xy;if(!keep(k)||dot(k,k)==0.){o=vec4(w,0,0);return;}
 float g=uAmp*uN*uN*uR*uR/(4.*3.141592653589793)*exp(-dot(k,k)*uR*uR/4.),th=-dot(k,uAt);
 o=vec4(w+g*vec2(cos(th),sin(th)),0,0);}`;
/** Semi-Lagrangian dye on its own grid, Catmull-Rom with clamping in one flat loop. A display transport: numerically diffusive, and not the reference. */
export const FLUID_DYE = HEAD + `uniform sampler2D D,U,S;uniform float uDt;uniform vec2 uRes;
float w4(int i,float t){return i==0?(-t+2.*t*t-t*t*t)*.5:i==1?(2.-5.*t*t+3.*t*t*t)*.5:i==2?(t+4.*t*t-3.*t*t*t)*.5:(t*t*t-t*t)*.5;}
void main(){vec2 p=gl_FragCoord.xy/uRes,vel=texture(U,p).xy+texture(S,p).xy,sz=vec2(textureSize(D,0));
 vec2 x=fract(p-uDt*vel/6.283185307179586)*sz-.5,f=fract(x),b=floor(x)-1.;vec4 s=vec4(0),lo=vec4(1e9),hi=vec4(-1e9);
 for(int n=0;n<16;n++){int i=n%4,j=n/4;vec4 v=texture(D,(b+vec2(float(i),float(j))+.5)/sz);s+=w4(i,f.x)*w4(j,f.y)*v;lo=min(lo,v);hi=max(hi,v);}
 o=clamp(s,lo,hi);}`;
/** Display. uView 0 vorticity, 1 speed, 2 Q, 3 dye. Ink on a calm ground. */
export const FLUID_SHOW = HEAD + `uniform sampler2D A,P,D,S;uniform int uView;uniform vec2 uRes;uniform float uGain;
vec3 div(float v){v=clamp(v,-1.,1.);vec3 c=vec3(.035,.04,.055);return v>0.?mix(c,vec3(1.,.62,.28),pow(v,.75)):mix(c,vec3(.25,.62,1.),pow(-v,.75));}
void main(){vec2 p=gl_FragCoord.xy/uRes;vec4 f=texture(A,p);vec3 c;
 if(uView==0)c=div(f.r*uGain);
 else if(uView==1)c=mix(vec3(.035,.04,.055),vec3(.95,.93,.86),clamp(length(texture(P,p).xy)*uGain*.6,0.,1.));
 else if(uView==2)c=div(.25*(f.r*f.r-f.g*f.g-f.b*f.b)*uGain*uGain*.3);
 else{vec3 d=texture(D,p).rgb;c=mix(vec3(.93,.91,.85),vec3(.07,.09,.13),clamp(d.r,0.,1.));c=mix(c,vec3(.72,.16,.13),clamp(d.g,0.,1.));c=mix(c,vec3(.08,.36,.62),clamp(d.b,0.,1.));}
 o=vec4(mix(c,vec3(.12,.13,.16),clamp(texture(S,p).b,0.,1.)*.85),1);}`;
/** Volume ray march of one scalar in a 3D texture: one flat loop, fixed steps. */
export const FLUID_VOLUME = "#version 300 es\nprecision highp float;precision highp sampler3D;out vec4 o;\n" + `uniform sampler3D V;uniform vec2 uRes;uniform float uGain,uYaw,uPitch;uniform int uSigned;
void main(){vec2 p=(gl_FragCoord.xy-.5*uRes)/min(uRes.x,uRes.y);float cy=cos(uYaw),sy=sin(uYaw),cp=cos(uPitch),sp=sin(uPitch);
 vec3 ro=vec3(0,0,-1.55),rd=normalize(vec3(p*1.05,1.));
 ro=vec3(ro.x,cp*ro.y-sp*ro.z,sp*ro.y+cp*ro.z);rd=vec3(rd.x,cp*rd.y-sp*rd.z,sp*rd.y+cp*rd.z);
 ro=vec3(cy*ro.x+sy*ro.z,ro.y,-sy*ro.x+cy*ro.z);rd=vec3(cy*rd.x+sy*rd.z,rd.y,-sy*rd.x+cy*rd.z);
 vec3 t0=(-.5-ro)/rd,t1=(.5-ro)/rd,a=min(t0,t1),b=max(t0,t1);float tn=max(max(a.x,a.y),a.z),tf=min(min(b.x,b.y),b.z);
 vec3 col=vec3(.035,.04,.055);float T=1.;
 if(tf>max(tn,0.)){float dt=(tf-tn)/96.;for(int i=0;i<96;i++){float v=texture(V,ro+rd*(tn+(float(i)+.5)*dt)+.5).r*uGain,d=smoothstep(.25,1.,uSigned==1?abs(v):v);
   if(d<=0.)continue;float al=1.-exp(-d*dt*22.);col+=T*al*(uSigned==1&&v<0.?vec3(.25,.62,1.):vec3(1.,.62,.28));T*=1.-al;}}
 o=vec4(col,1);}`;
