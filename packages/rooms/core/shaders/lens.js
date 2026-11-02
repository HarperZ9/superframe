// SPDX-License-Identifier: FSL-1.1-MIT
import { ACC, CAM, COMMON } from "./common.js";
import { F_HELP } from "../formula.js";
import { PATFN, scatCode, typed } from "../scatter.js";
import { sceneCode } from "../scenes.js";
import { innerCode } from "../inner.js";
// Lens program: one flat loop over surfaces met along a path, with one call site of f in march, one in nor,
// one at the start of a path, one in section mode. Loop bounds are uniforms, so the HLSL compiler cannot unroll them.
export function lensFS(c) {
  const G = c.grin;
  return (
    COMMON +
    `
uniform float uNA,uBA,uNB,uBB,uCurve,uCurve2,uSize,uS2,uSp,uMorph,uSpan,uZc,uLiq,uMirT,uMirR,uMl,uFilm,uNe,uStopR,uZr,uStress;uniform vec3 uAbsA,uAbsB,uOff,uAxis,uSunD,uPolA,uPolP;uniform mat3 uRot;uniform int uMat,uInv,uBire,uBireF,uPA,uPP,uFan;uniform vec3 uFanP,uFanD,uFanU;uniform float uFanA;
${c.inner ? "uniform vec4 uIO[14],uLampI,uCa[24],uCb[24];uniform int uNIO,uNC,uInner,uFive;uniform float uIP;" : ""}
${c.prof ? "uniform float uProf[33];float prof(float x){float u=clamp(x,0.,1.)*32.;int i=int(u);return mix(uProf[i],uProf[min(i+1,32)],u-float(i));}" : ""}
float gNA=1.5,gNB=1.5;bool gB=false;int gBand=0;float gScat=0.;
${c.fhelp && !c.scat && !c.tr ? F_HELP : ""}${c.scat ? scatCode(c.St) : ""}${c.tr ? (c.scat ? "" : F_HELP) + typed(c.St.fTr, "trn") : ""}${c.pat ? PATFN : ""}${sceneCode(c.scene)}
float rev(vec3 p,float h,float c){return max(length(p.xy)-1.2,abs(p.z)-.5*c*2.*h-.02);}
float shA(vec3 p,float c){float r=length(p);${c.a}}
${c.m ? `float shM(vec3 p,float c){float r=length(p);${c.m}}` : ""}
${c.b ? `float shB(vec3 p,float c){float r=length(p);${c.b}}` : ""}
float f(vec3 p){float d=1e3;if(uMask!=2){d=shA(p,uCurve);${c.m ? "d=mix(d,shM(p,uCurve),uMorph);" : ""}if(uInv==1)d=max(length(p)-1.5,-d);}
 ${c.b ? "if(uMask!=1){float e=shB((p-vec3(0,0,uSp))/uS2,uCurve2)*uS2;gB=e<d;d=min(d,e);}else gB=false;" : ""}return d;}
vec3 nor(vec3 p){vec3 n=vec3(0);for(int i=0;i<uFour;i++){vec3 k=vec3(i==0||i==3?1.:-1.,i==1||i==3?1.:-1.,i==2||i==3?1.:-1.);n+=k*f(p+k*.0025);}return normalize(n);}
${
  G
    ? `float n2(vec3 p){float r=max(length(p),.03);float k=(gNA/1.5)*(gNA/1.5);${c.grin}}
vec3 gn2(vec3 p){vec3 g=vec3(0);for(int i=0;i<uSix;i++){int j=i/2;float s=(i%2==0)?1.:-1.;vec3 ax=vec3(j==0?1.:0.,j==1?1.:0.,j==2?1.:0.);g+=ax*s*n2(p+ax*s*.002);}return g/.004;}`
    : ""
}
bool sph(vec3 ro,vec3 rd,float R,out float a,out float b){float B=dot(ro,rd),C=dot(ro,ro)-R*R,D=B*B-C;a=1e9;b=-1e9;if(D<0.)return false;D=sqrt(D);a=-B-D;b=-B+D;return b>0.;}
// Single state loop: linear search, gap skipping and bisection share one f call.
bool march(vec3 ro,vec3 rd,float sgn,out float t){float a,b,a2=1e9,b2=-1e9;t=0.;bool h1=sph(ro,rd,1.75,a,b),h2=false;
 ${c.b ? "h2=uMask!=1&&sph(ro-vec3(0,0,uSp),rd,1.75*uS2,a2,b2);if(uMask==2)h1=false;" : ""}
 if(!h1){a=1e9;b=-1e9;}if(!h2){a2=1e9;b2=-1e9;}if(!h1&&!h2)return false;
 float x=max(min(a,a2),0.)+.0005,pt=x,l=0.,h=0.,dt=.035*min(1.,${c.b ? "uS2" : "1."});bool bis=false;int nb=0;
 for(int i=0;i<uMarch;i++){
  if(!bis&&!((x>=a&&x<=b)||(x>=a2&&x<=b2))){float nx=1e9;if(a>x)nx=min(nx,a);if(a2>x)nx=min(nx,a2);if(nx>1e8)return false;x=nx+.0005;pt=x;continue;}
  float v=sgn*f(ro+rd*x);
  if(!bis){if(v<0.){bis=true;l=pt;h=x;x=.5*(l+h);}else{pt=x;x+=dt;}}
  else{if(v<0.)h=x;else l=x;nb++;if(nb>=uBis){t=h;return true;}x=.5*(l+h);}}
 return false;}
float fres(float c,float a,float b){float r=(a-b)/(a+b);r*=r;float m=1.-c;return r+(1.-r)*m*m*m*m*m;}
vec3 runit(){float z=rnd()*2.-1.,a=rnd()*6.28318,r=sqrt(max(1.-z*z,0.));return vec3(r*cos(a),r*sin(a),z);}
vec3 gEnt,gEx,gExD,gW1,gW2,gTr;vec3 gQ=vec3(0);float gSt,gIn,gOpl,gNbn,gFirst=-1.,gHitI=0.,gT1=-1.,gF1=0.,gTir1=0.,gN0=1.;
float fExact(float ci,float n1,float n2_){float st2=(n1/n2_)*(n1/n2_)*(1.-ci*ci);if(st2>=1.)return 1.;float ct=sqrt(1.-st2),a=(n1*ci-n2_*ct)/(n1*ci+n2_*ct),b=(n2_*ci-n1*ct)/(n2_*ci+n1*ct);return .5*(a*a+b*b);}
${c.inner ? innerCode(c.inner) : ""}
${
  c.pol
    ? `
// Polarisation: a complex 3-vector (Jones vector in the ray's own frame), updated from the full Fresnel amplitudes at every surface (Born and Wolf, section 1.5), including the total internal reflection phase.
vec3 gEr=vec3(1,0,0),gEi=vec3(0);float gPolI=1.;
void jones(vec3 d,vec3 Nf,vec3 dn,float n1,float n2_,bool refl,float P){vec3 s=cross(d,Nf);float sl=length(s);if(sl<1e-5)s=normalize(cross(d,vec3(.31,.53,.79)));else s/=sl;vec3 pi=cross(s,d),pt=cross(s,dn);
 float ci=clamp(-dot(d,Nf),0.,1.),si2=1.-ci*ci,eta=n1/n2_,st2=eta*eta*si2;vec2 as,ap;
 if(st2>=1.){float q=sqrt(max(si2-1./(eta*eta),0.));float ps=-2.*atan(q,ci),pp=-2.*atan(q*eta*eta,ci);as=vec2(cos(ps),sin(ps));ap=vec2(cos(pp),sin(pp));}
 else{float ct=sqrt(1.-st2),rs=(n1*ci-n2_*ct)/(n1*ci+n2_*ct),rp=(n2_*ci-n1*ct)/(n2_*ci+n1*ct);as=refl?vec2(rs,0.):vec2(sqrt(max(1.-rs*rs,0.)),0.);ap=refl?vec2(rp,0.):vec2(sqrt(max(1.-rp*rp,0.)),0.);}
 float w=1./sqrt(max(P,.02));vec2 Es=vec2(dot(gEr,s),dot(gEi,s)),Ep=vec2(dot(gEr,pi),dot(gEi,pi));
 vec2 a=vec2(as.x*Es.x-as.y*Es.y,as.x*Es.y+as.y*Es.x)*w,b=vec2(ap.x*Ep.x-ap.y*Ep.y,ap.x*Ep.y+ap.y*Ep.x)*w;gEr=a.x*s+b.x*pt;gEi=a.y*s+b.y*pt;}
// Stress retarder over one inside segment: fast axis radial at the segment midpoint, Delta n growing with r squared, as in a thermally stressed disc. Lengths are read as millimetres, wavelength in micrometres.
void retard(vec3 mid,vec3 d,float L){if(uStress<=0.)return;vec3 ax=vec3(mid.xy,0.);ax-=d*dot(ax,d);float la=length(ax);if(la<1e-4)return;ax/=la;float dn=uStress*(.2+dot(mid.xy,mid.xy));float de=6.28318*dn*L*1000./uLam[int(gCh)];
 float fr=dot(gEr,ax),fi=dot(gEi,ax);vec3 sr=gEr-ax*fr,si=gEi-ax*fi;float c0=cos(de),s0=sin(de);gEr=sr+ax*(fr*c0-fi*s0);gEi=si+ax*(fr*s0+fi*c0);}
`
    : ""
}
${CAM}${ACC}
vec3 trace(vec3 ro,vec3 rd){mat3 Ri=transpose(uRot);vec3 p=Ri*(ro-uOff)/uSize,d=Ri*rd,c=vec3(1),L=vec3(0),wv=vec3(0);
 gEnt=gW1=gW2=vec3(0);gSt=0.;gIn=0.;gOpl=0.;gNbn=0.;${G ? "gN0=sqrt(max(n2(p),.001));" : "gN0=gNA;"}bool ins=f(p)<0.&&uMat==0,curB=gB,alive=true,first=true,spec=true,isE=uBireF==2||(uBireF==0&&uBire==1&&rnd()<.5);int nx=0;float nCur=gNA;
 for(int b=0;b<uBounces;b++){
  ${
    G
      ? `if(ins&&uInv==0&&uMat==0&&!curB){vec3 v=d*sqrt(max(n2(p),.001));bool out_=false,gotI=false;float seg=0.;${c.inner ? "float ts=0.,irg=1.;vec3 in_=vec3(0),ia=vec3(0),ie=vec3(0),idd=vec3(0,0,1),ipp=p;" : ""}
   for(int i=0;i<uSteps;i++){float dt=(.006+.012*min(1.,length(p)*2.))*(uMode==5?.2:1.);vec3 g=.5*gn2(p),pp=p;v+=g*dt;p+=v*dt;float nv=sqrt(max(n2(p),.001));v=normalize(v)*nv;float ds=nv*dt*uSize;seg+=ds;gIn+=ds;gOpl+=nv*ds;c*=exp(-ds*uAbsA);${c.scat ? "if(uScat>0.&&rnd()<(1.-exp(-uScat*rho(p)*nv*dt))){c*=mix(1.,uAlb,abf(p));gScat+=1.;v=hgDir(v/nv,uHG,rnd(),rnd())*nv;}" : ""}
    ${c.inner ? "if(uInner>0){ts=length(p-pp);idd=(p-pp)/max(ts,1e-6);ipp=pp;if(hitI(pp,idd,ts,in_,ia,ie,irg)){gotI=true;break;}}" : ""}if(f(p)>0.){out_=true;break;}}
   ${c.inner ? `if(gotI){if(uMode!=0){gHitI=1.;alive=false;break;}gNbn+=1.;if(gFirst<0.)gFirst=seg;vec3 q0=ipp+idd*ts;if(dot(ia,ia)==0.){if(irg>=0.||spec)L+=c*ie;alive=false;break;}innerBounce(q0,in_,ia,ie,irg,idd,p,d,c,L,spec);spec=false;continue;}` : ""}
   if(!out_){alive=false;break;}
   float nh=length(v);vec3 N=nor(p),r=refract(v/nh,-N,nh);if(gT1<0.){gT1=seg;gTir1=dot(r,r)==0.?1.:0.;gF1=fExact(abs(dot(v/nh,N)),nh,1.);}if(dot(r,r)==0.){d=reflect(v/nh,-N);p-=N*.01;gNbn+=1.;continue;}d=r;p+=N*.006;gNbn+=1.;ins=false;continue;}`
      : ""
  }
  float t;bool hl=march(p,d,ins?-1.:1.,t);
  ${c.inner ? `if(ins&&uInner>0){float ts=hl?t:1e5,irg=1.;vec3 in_=vec3(0),ia=vec3(0),ie=vec3(0);if(hitI(p,d,ts,in_,ia,ie,irg)){if(uMode!=0){gHitI=1.;alive=false;break;}float w0=ts*uSize;gIn+=w0;gOpl+=w0*nCur;c*=exp(-w0*(curB?uAbsB:uAbsA));gNbn+=1.;if(gFirst<0.)gFirst=w0;vec3 q0=p+d*ts;if(dot(ia,ia)==0.){if(irg>=0.||spec)L+=c*ie;alive=false;break;}innerBounce(q0,in_,ia,ie,irg,d,p,d,c,L,spec);spec=false;continue;}}` : ""}
  ${
    c.scat
      ? `if(ins&&uScat>0.){float xs=0.,tl=hl?t:1e3;bool col=false;for(int i=0;i<uDelta;i++){xs-=log(max(1.-rnd(),1e-6))/uScat;if(xs>=tl)break;if(rnd()<rho(p+d*xs)){col=true;break;}}
   if(col){vec3 ps=p+d*xs;float w1=xs*uSize;gIn+=w1;gOpl+=w1*nCur;c*=exp(-w1*(curB?uAbsB:uAbsA))*mix(1.,uAlb,abf(ps));gScat+=1.;p=ps;d=hgDir(d,uHG,rnd(),rnd());spec=false;if(max(c.r,max(c.g,c.b))<.01){alive=false;break;}continue;}}`
      : ""
  }
  if(ins&&!hl){alive=false;break;}
  ${
    c.pt
      ? `if(!ins&&uMode==0){vec3 wo=uRot*p*uSize+uOff,wd=uRot*d;float ts=hl?t*uSize:1e5,rg=1.;vec3 n=vec3(0),al=vec3(0),em=vec3(0);bool hs=hitAll(wo,wd,ts,n,al,em,rg);
   // Path tracer: a surface hit gathers its area light through a shadow ray, then continues along a rough lobe. A shadow ray whose line crosses the lens bound is not sent to the lamp: that light arrives only when a later bounce through the glass finds the lamp, so caustics are real paths.
   if(hs){if(gFirst<0.)gFirst=ts;gOpl+=ts;L+=c*(spec?em:min(em,vec3(1.5)));
    vec3 x=wo+wd*ts,tn=dot(n,wd)>0.?-n:n;spec=false;
    if(LAMP.w>0.&&dot(al,al)>0.){vec3 lp=LAMP.xyz+runit()*LAMP.w,li=lp-x;float dl=length(li);li/=dl;float cs=dot(tn,li);if(cs>0.){float t2=dl-LAMP.w-.02,rg2=1.;vec3 n2_=vec3(0),a2=vec3(0),e2=vec3(0);bool blk=hitS(x+tn*.003,li,t2,n2_,a2,e2,rg2);
      vec3 oc=(x-uOff)/uSize;float Bb=dot(oc,li),Cb=dot(oc,oc)-3.06,Db=Bb*Bb-Cb;bool inB=Db>0.&&(-Bb+sqrt(Db))>0.;
      if(inB)spec=true;else if(!blk){float solid=4.*LAMP.w*LAMP.w/(dl*dl);L+=c*al*LAMPC*cs*min(solid,6.)*.32;}}}
    else if(LAMP.w<=0.)spec=true;
    vec3 sd=reflect(wd,tn),nd=rnd()<rg?normalize(tn+runit()*.999):normalize(sd+runit()*rg*rg);if(rg<.2)spec=true;if(dot(nd,tn)<=0.)nd=normalize(nd+tn*1.01);
    if(dot(al,al)==0.)break;c*=rg<.2?mix(al,vec3(1),.5):al;float q=max(c.r,max(c.g,c.b));if(b>3){if(rnd()>q)break;c/=max(q,.05);}
    p=Ri*(x+tn*.003-uOff)/uSize;d=Ri*nd;continue;}
   if(!hl){vec3 sk=sky(wd);if(gFirst<0.)gFirst=60.;gOpl+=60.;L+=c*(spec?sk:min(sk,vec3(4.)));break;}}`
      : "if(!ins&&!hl)break;"
  }
  if(!hl)break;
  vec3 q=p+d*t;float w=t*uSize;
  if(ins){gIn+=w;gOpl+=w*nCur;c*=exp(-w*(curB?uAbsB:uAbsA));${c.pol ? "retard(p+d*t*.5,d,w);" : ""}}else{gOpl+=w;if(gFirst<0.)gFirst=w;}
  vec3 N=nor(q);bool hb=gB;gNbn+=1.;
  if(!ins&&first){gEnt=uRot*q*uSize+uOff;first=false;gSt=1.;${c.tr ? "c*=trn(q);" : ""}${c.ltex ? "c*=mix(.08,1.,pat(q.xy*4.));" : ""}}
  if(uMat==1&&!ins){if(uMirT>0.&&rnd()<uMirT){p=q+d*.01;spec=true;continue;}vec3 dn=reflect(d,N);${c.pol ? "jones(d,N,dn,1.,3.,true,1.);" : ""}d=dn;if(uMirR>0.)d=normalize(d+runit()*uMirR);p=q+N*.004;
   if(uMl>0.){float cs=abs(dot(d,N));c*=.04+.96*pow(.5+.5*cos(6.28318*2.*1.6*uMl*sqrt(max(1.-(1.-cs*cs)/2.56,.1))/vec3(.63,.532,.465)),vec3(4.));}else c*=vec3(.95,.96,.97);
   spec=true;gSt=2.;continue;}
  ${
    c.soap
      ? `if(uMat==2){float ci=abs(dot(d,N)),nf=1.33,ct=sqrt(1.-(1.-ci*ci)/(nf*nf)),tk=uFilm*(.3+.7*(.5-.5*q.y/1.5));float rr=(ci-nf*ct)/(ci+nf*ct),r2=rr*rr,de=12.56637*nf*tk*ct/uLam[int(gCh)],R=2.*r2*(1.-cos(de))/(1.+r2*r2-2.*r2*cos(de));R=clamp(R*2.5,0.,1.);
   if(rnd()<R){d=reflect(d,N);p=q+N*.004;spec=true;continue;}p=q+d*.006;spec=true;continue;}`
      : ""
  }
  if(!ins)curB=hb;
  float nn=curB?gNB:gNA;${G ? "if(!ins&&uInv==0&&!curB)nn=sqrt(max(n2(q),.001));" : ""}
  vec3 Nf=ins?-N:N,inD=d;
  // Calcite and friends: the extraordinary index follows the angle to the optic axis, and the ray walks off the wave normal (Born and Wolf, section 15.3). Each path picks o or e once.
  if(uBire==1&&!curB){if(ins){if(isE){inD=normalize(d-wv);nn=nCur;}else nn=gNA;}
   else if(isE){float ca=dot(d,uAxis),c2=ca*ca,ne=gNA+uNe;nn=1./sqrt(c2/(gNA*gNA)+(1.-c2)/(ne*ne));}}
  float n1=ins?nn:1.,n2_=ins?1.:nn;vec3 r=refract(inD,Nf,n1/n2_);bool tir=dot(r,r)==0.;
  if(ins&&gT1<0.){gT1=w;gTir1=tir?1.:0.;gF1=fExact(abs(dot(inD,N)),n1,n2_);}float fr=tir?1.:(uMode==0?fres(abs(dot(d,N)),n1,n2_):0.);bool reflectIt=tir||rnd()<fr;
  ${c.pol ? "jones(inD,Nf,reflectIt?reflect(inD,Nf):r,n1,n2_,reflectIt,reflectIt?max(fr,.0001):1.-fr);" : ""}
  if(reflectIt){d=reflect(d,Nf);p=q+Nf*.004;spec=true;}
  else{gQ=uRot*q*uSize+uOff;nCur=nn;if(ins){nx++;if(nx==1)gW1=uRot*q*uSize+uOff;}else if(nx==1&&dot(gW2,gW2)==0.)gW2=uRot*q*uSize+uOff;d=r;p=q-Nf*.004;
   if(uBire==1&&!ins&&isE){float ca=dot(d,uAxis),sa2=max(1.-ca*ca,1e-6),no2=gNA*gNA,ne=gNA+uNe,ne2=ne*ne;float tt=sqrt(sa2)/max(abs(ca),.02);float rho=(no2-ne2)*tt/(ne2+no2*tt*tt);vec3 ap=uAxis-d*ca;float lap=length(ap);if(lap>1e-4){ap/=lap;if(ca<0.)ap=-ap;wv=ap*rho;d=normalize(d+wv);}}
   ins=!ins;spec=true;}}
 if(ins)alive=false;gTr=c;gEx=uRot*p*uSize+uOff;gExD=uRot*d;if(!alive){gSt=-1.;return L;}
 ${c.pol ? `{vec3 wr=uRot*gEr,wi=uRot*gEi;float I=dot(wr,wr)+dot(wi,wi);if(uPP==1){vec3 pa=uPolP-gExD*dot(uPolP,gExD);float pl=length(pa);if(pl>1e-5)pa/=pl;float a=dot(wr,pa),b=dot(wi,pa);I=a*a+b*b;}gPolI=(uPA==1)?.5*I:I;}` : ""}
 if(uMode!=0)return vec3(0);${c.pt ? `return L${c.pol ? "*gPolI" : ""};` : `vec3 s=shade(gEx,gExD);gOpl+=gT;if(gFirst<0.)gFirst=gT;${c.pol ? "s*=gPolI;" : ""}return L+c*s;`}}
void main(){st=uint(gl_FragCoord.x)*1973u+(uMode==5?0u:uint(gl_FragCoord.y)*9277u)+uint(uFrame)*26699u;rnd();gNA=uNA;gNB=uNB;
 if(uMode==2){vec2 q=(gl_FragCoord.xy-.5*uRes)/uRes.y*uSpan;vec3 p=transpose(uRot)*(vec3(0,q.y,q.x+uZc)-uOff)/uSize;float d=f(p);vec3 c=vec3(.02,.025,.035);
  if(d<0.){c=vec3(.14,.34,.5);if(uMat==1)c=vec3(.5);}c+=vec3(.3,.45,.6)*smoothstep(.02,.0,abs(d));o=vec4(c,1);return;}
 vec3 ro,rd;int ix=int(gl_FragCoord.x),iy=int(gl_FragCoord.y);float z0=2.3*uSize+.5;
 if(uMode==6){int v=iy*256+ix;vec3 vp=(vec3(float(v%32),float((v/32)%32),float(v/1024))+.5)/16.-1.;vp*=1.75;o=vec4(f(vp),vp);return;}
 if(uMode==7){o=vec4(f(transpose(uRot)*(uFanP-uOff)/uSize));return;}
 if(uMode==1){int k=ix%12;float h=(float(k)+.5)/12.*1.1*uSize;ro=ix<12?vec3(0,h,-z0):vec3(h,0,-z0);rd=vec3(0,0,1);if(uFlip==1){ro.z=uSp*uSize+z0;rd=-rd;}ro+=uOff;}
 else if(uMode==3){vec2 g=((vec2(ix,iy)+.5)/uRes*2.-1.)*uStopR;ro=vec3(g,-z0)+uOff;rd=vec3(0,0,1);}
 else if(uMode==5){float kf=float(ix)+.5,wf=uRes.x;ro=uFanP;if(uFan==0){float z=1.-2.*kf/wf,a=kf*2.39996,rr=sqrt(max(1.-z*z,0.));rd=vec3(rr*cos(a),rr*sin(a),z);}else if(uFan==1){float th=kf/wf*uFanA;rd=cos(th)*uFanD+sin(th)*uFanU;}else{ro=uFanP+uFanU*kf/wf*uFanA;rd=uFanD;}}
 else if(uMode==4){vec3 u=normalize(cross(uSunD,vec3(0,0,1))),v=cross(uSunD,u);vec2 g=((vec2(ix,iy)+.5)/uRes*2.-1.)*uStopR;ro=vec3(0,0,uSp*uSize*.5)+uOff+u*g.x+v*g.y+uSunD*(z0+uSp*uSize);rd=-uSunD;}
 else{camRay(ro,rd);float ch=1.;${c.meta ? "gBand=(uFrame+ix*7+iy*13)%16;{float l=.34+.024*float(gBand);float q=1./(l*l)-2.8962;gNA=uNA+uBA*q;gNB=uNB+uBB*q;}" : ""}if(uSpec==1){ch=floor(rnd()*3.);gCh=ch;float l=uLam[int(ch)];float q=1./(l*l)-2.8962;gNA=uNA+uBA*q;gNB=uNB+uBB*q;}}
 ${c.pol ? `{float ra=rnd()*6.28318;vec3 a0=uPA==1?uPolA:(uMode==0?vec3(cos(ra),sin(ra),0.):uPolP);a0-=rd*dot(a0,rd);float la=length(a0);a0=la>1e-5?a0/la:vec3(1,0,0);gEr=transpose(uRot)*a0;}` : ""}
 vec3 c=trace(ro,rd);
 if(uMode==1){vec4 r0=vec4(0);if(iy==0)r0=vec4(gEnt,gSt);if(iy==1)r0=vec4(gEx,gSt);if(iy==2)r0=vec4(gExD,gSt);if(iy==3)r0=vec4(gTr,gIn);if(iy==4)r0=vec4(${c.pol ? "gPolI" : "1."},gOpl,gNbn,gFirst);if(iy==5)r0=vec4(gW1,gSt);if(iy==6)r0=vec4(gW2,gSt);o=r0;return;}
 if(uMode==5){o=iy==0?vec4(gQ,gSt):iy==1?vec4(gExD,gHitI):iy==2?vec4(gT1,gF1,gTir1,gN0):vec4(gNbn,gIn,gScat,0);return;}
 if(uMode==3){float A=(gSt<0.||gExD.z<=.01)?0.:1.;float op=gOpl+(uZr-gEx.z)/max(gExD.z,.01);o=vec4(op,A,gExD.x,gExD.y);return;}
 if(uMode==4){float T=gSt<0.?0.:(gTr.r+gTr.g+gTr.b)/3.;float x=(-1.7-gEx.y)/min(gExD.y,-.001);vec3 fl=gEx+gExD*x;o=vec4(fl.x,fl.z,T,gExD.y<0.&&gSt>=0.?1.:0.);return;}
 ${c.meta ? "c=uCmf[gBand]*c.r*uEll[gBand];" : ""}if(uRemap==1)c=vec3(c.g,c.b,max(0.,1.6*c.b-.6*c.g));
 if(uSpec==1){vec3 w=vec3(0);w[int(gCh)]=3.;c*=w;}
 c*=gEdge;gData=uData==1?gIn:uData==2?gNbn:uData==3?gFirst:gOpl;emit(c);}`
  );
}
