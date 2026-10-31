// SPDX-License-Identifier: FSL-1.1-MIT
import { F_HELP, fGLSL, fParse } from "./formula.js";
import { AIR0, SCENES } from "./scenes.js";
// ======================================================================= Scattering medium, transmission gradient
// Density rho(p) and absorption weight are typed in the same strict grammar as the formula lens. Free flights use Woodcock delta tracking (Woodcock et al. 1965); direction after a collision uses Henyey-Greenstein (1941).
export function typed(text, name) {
  const ast = fParse(text, ["x", "y", "z", "r"]);
  return `float ${name}(vec3 p){float v_x=p.x,v_y=p.y,v_z=p.z,v_r=length(p);return clamp(${fGLSL(ast)},0.,1.);}`;
}
export function scatCode(St) {
  return (
    F_HELP +
    typed(St.fRho, "rho") +
    typed(St.fAbs, "abf") +
    `
uniform float uScat,uHG,uAlb;uniform int uDelta;
vec3 hgDir(vec3 d,float g,float u1,float u2){float ct;if(abs(g)<.001)ct=1.-2.*u1;else{float q=(1.-g*g)/(1.-g+2.*g*u1);ct=(1.+g*g-q*q)/(2.*g);}float st_=sqrt(max(1.-ct*ct,0.)),a=u2*6.28318;vec3 u=normalize(abs(d.x)>.7?cross(d,vec3(0,1,0)):cross(d,vec3(1,0,0))),v=cross(d,u);return normalize(d*ct+(u*cos(a)+v*sin(a))*st_);}`
  );
}
export const PATFN = `uniform float uMoA,uMoP;uniform int uPatK;uniform sampler2D uTur;
float pat(vec2 q){if(uPatK==0){float ca=cos(uMoA*.5),sa=sin(uMoA*.5);float g1=step(.5,fract((ca*q.x+sa*q.y)/uMoP)),g2=step(.5,fract((ca*q.x-sa*q.y)/uMoP));return g1*g2;}
 if(uPatK==1){float rr=length(q),th=atan(q.y,q.x),c0=.11,k0=floor(rr*rr/(c0*c0)),b=1.;for(int i=-9;i<=9;i++){float k=k0+float(i);if(k<0.)continue;float a=k*2.39996,r0=c0*sqrt(k);b=min(b,length(q-r0*vec2(cos(a),sin(a))));}return smoothstep(.055,.04,b);}
 if(uPatK==2){vec2 s=q/.28,sz=vec2(1.,1.732),a=mod(s,sz)-.5*sz,b=mod(s-.5*sz,sz)-.5*sz,g=dot(a,a)<dot(b,b)?a:b;float e=max(abs(g.x),dot(abs(g),vec2(.5,.866)));return smoothstep(.44,.47,e)*.9+.08;}
 if(uPatK==3)return texture(uTur,q*.09).r;
 vec2 w=q*1.3;float c=0.;for(int i=0;i<4;i++){float fi=float(i);w+=.6*vec2(sin(w.y*1.3+fi*2.1),cos(w.x*1.1+fi));c+=pow(1.-abs(sin(w.x+w.y*.7)),6.);}return min(c*.5,1.);}`;
SCENES.patterns = {
  name: "Patterns",
  lamp: "vec4(0.)",
  lc: "vec3(0.)",
  glsl:
    AIR0 +
    `
vec3 sky(vec3 rd){return vec3(.03);}
bool hitS(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=false;if(rd.z>0.){float x=(6.-ro.z)/rd.z;if(x>.001&&x<t){vec3 p=ro+rd*x;t=x;n=vec3(0,0,-1);h=true;rg=1.;al=vec3(0);float v=pat(p.xy);em=mix(vec3(.04,.05,.09),vec3(.95,.92,.82),v);}}return h;}`,
};
