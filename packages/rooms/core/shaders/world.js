// SPDX-License-Identifier: FSL-1.1-MIT
import { ACC, CAM, COMMON } from "./common.js";
import { F_HELP } from "../formula.js";
import { scatCode } from "../scatter.js";
import { sceneCode } from "../scenes.js";
// World program: the whole scene sits in an index field, with no lens surface. One flat leapfrog loop,
// stepping in equal optical path, because on a 3-sphere picture that is the arc length.
export function worldFS(c) {
  const St = c.St || {};
  const SC = St.scatOn;
  return (
    COMMON +
    `
uniform float uK,uHH,uOplMax,uBg;uniform vec3 uFanP;uniform vec4 uObj[8];uniform int uNObj,uRoom,uNoHit,uRowN;uniform float uM,uLay,uA2;
${c.fhelp && !SC ? F_HELP : ""}${SC ? scatCode(St) : ""}vec3 gWc=vec3(1);${sceneCode("night")}
float n2f(vec3 p){float r=length(p);float x=p.x,y=p.y,z=p.z;${c.body}}
vec3 objCol(int i,vec3 q,vec3 n){vec3 a=i==0?vec3(1.,.75,.2):i==7?vec3(.9,.9,.85):.55+.42*cos(6.283*(float(i)*.21+vec3(0,.33,.67)));a*=.65+.35*step(0.,sin(q.x*9.)*sin(q.y*9.)*sin(q.z*9.));return a*(.3+1.1*max(dot(n,sun),0.));}
vec3 gP;vec3 gV;float gO2=0.;int gIt=0;
// Advances gP and gV until optical path uOplMax, a hit, or the step limit.
vec3 walk(vec3 p,vec3 d,float oplMax){int hit=-1;vec3 v=d;float n0=0.;vec3 col=vec3(-1.);float o2=0.;float n2v=1.;
 for(int i=0;i<uSteps;i++){vec3 g=vec3(0);float sum=0.;float e=.0015*(1.+length(p));
  for(int j=0;j<uSix;j++){int jj=j/2;float sg=(j%2==0)?1.:-1.;vec3 ax=vec3(jj==0?1.:0.,jj==1?1.:0.,jj==2?1.:0.);float m=n2f(p+ax*sg*e);sum+=m;g+=ax*sg*m;}
  g/=2.*e;n2v=max(sum/6.,1e-6);if(i==0)v=d*sqrt(n2v);
  float hh=uHH*(1.+uK*length(p));float dt=hh/n2v;
  v+=.5*g*dt;p+=v*dt;v=normalize(v)*sqrt(n2v);o2+=hh;gIt=i;${SC ? "if(uMode==0&&uScat>0.&&rnd()<1.-exp(-uScat*rho(p)*hh/sqrt(n2v))){gWc*=mix(1.,uAlb,abf(p));v=hgDir(normalize(v),uHG,rnd(),rnd())*sqrt(n2v);}" : ""}
  if(uNoHit==0){
   for(int k=0;k<uNObj;k++){if(k==7&&o2<1.2)continue;vec3 q=p-uObj[k].xyz;if(dot(q,q)<uObj[k].w*uObj[k].w)hit=k;}
   if(uRoom>0&&(p.y<-1.7||abs(p.x)>uBg||abs(p.z)>uBg||p.y>uBg)){hit=100;}
  }
  if(hit>=0||o2>=oplMax)break;}
 gO2=o2;gP=p;gV=v;
 if(hit==100){vec3 a=abs(p);vec3 n=vec3(0,-1,0);if(a.x>uBg)n=vec3(p.x>0.?-1.:1.,0,0);if(a.z>uBg&&a.z>a.x)n=vec3(0,0,p.z>0.?-1.:1.);vec3 c0=vec3(.25,.3,.42),c1=vec3(.7,.72,.78);if(p.y<-1.7){n=vec3(0,1,0);c0=vec3(.3,.28,.24);c1=vec3(.6,.56,.48);}float ck=step(0.,sin(p.x*3.14)*sin(p.y*3.14+.5)*sin(p.z*3.14));return mix(c0,c1,ck)*(.45+.8*max(dot(n,sun),0.));}
 if(hit>=0){vec3 q=p-uObj[hit].xyz;return objCol(hit,q,normalize(q));}
 return col;}
${CAM}${ACC}
void main(){st=uint(gl_FragCoord.x)*1973u+uint(gl_FragCoord.y)*9277u+uint(uFrame)*26699u;rnd();int ix=int(gl_FragCoord.x),iy=int(gl_FragCoord.y);
 vec3 ro,rd;float om=uOplMax;
 // One call of walk: probes only choose a different start.
 if(uMode==1){float k=float(ix);if(uFlip==0){float a=(k+.5)/uRes.x*6.28318;rd=vec3(cos(a),0.,sin(a));ro=uFanP;}else{ro=uFanP;rd=vec3(0,0,1);}om=uOplMax*(float(iy)+1.)/uRes.y;}
 else camRay(ro,rd);
 vec3 c=walk(ro,rd,om);
 if(uMode==1){o=uData==1?vec4(normalize(gV),gO2):vec4(gP,gO2);return;}
 if(c.x<0.){vec3 dir=normalize(gV);c=shade(vec3(0),dir);if(uBg<0.)c=mix(vec3(.02,.03,.05),vec3(.2,.3,.45),.5+.5*dir.y);if(uBg>800.)c=mix(vec3(.85,.82,.75),vec3(.25,.45,.8),clamp(dir.y*6.+.2,0.,1.));}
 gData=gO2;emit(c*gWc);}`
  );
}
