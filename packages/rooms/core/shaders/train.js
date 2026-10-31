// SPDX-License-Identifier: FSL-1.1-MIT
import { ACC, COMMON } from "./common.js";
import { sceneCode } from "../scenes.js";
// Train program: sequential surfaces in a uniform array, one flat loop in each direction, no signed distance function.
// Local surface frame: vertex at (0,B.x,A.x), tilted about x by B.y. Conic sag: c(x^2+y^2+(1+k)z^2)-2z=0, plus A4 r^4 + A6 r^6.
export const MAXS = 36;
export function trainFS(c) {
  return (
    COMMON +
    `
uniform vec4 uA[${MAXS}],uB[${MAXS}],uC[${MAXS}];uniform int uNS,uSegI,uRowN,uNoAp;uniform float uN0,uObjZ,uObjK,uSegP,uSegPist,uSegTilt,uImgH,uField,uPup,uGain;
${sceneCode(c.scene)}
vec3 gP,gD;float gO=0.,gPi=0.;bool gHit=true;
vec3 toL(vec3 v,float cs,float sn){return vec3(v.x,cs*v.y+sn*v.z,-sn*v.y+cs*v.z);}
vec3 toW(vec3 v,float cs,float sn){return vec3(v.x,cs*v.y-sn*v.z,sn*v.y+cs*v.z);}
vec2 hexC(vec2 q,float s){vec2 u=vec2(q.x*2./(sqrt(3.)*s)*.5*sqrt(3.)/1.,0.);float qq=(sqrt(3.)/3.*q.x-1./3.*q.y)/s,rr=(2./3.*q.y)/s,xx=qq,zz=rr,yy=-xx-zz,rx=floor(xx+.5),ry=floor(yy+.5),rz=floor(zz+.5),dx=abs(rx-xx),dy=abs(ry-yy),dz=abs(rz-zz);if(dx>dy&&dx>dz)rx=-ry-rz;else if(dz>dy)rz=-rx-ry;return vec2(rx,rz);}
float hs(vec2 v){return fract(sin(dot(v,vec2(12.9898,78.233)))*43758.5453);}
bool surf(int i,float n1,float n2_){vec4 A=uA[i],B=uB[i],C=uC[i];float cs=cos(B.y),sn=sin(B.y);
 vec3 p=toL(gP-vec3(0,B.x,A.x),cs,sn),d=toL(gD,cs,sn);float cv=A.y,k1=1.+A.z;
 float a=cv*(d.x*d.x+d.y*d.y+k1*d.z*d.z),b=cv*(p.x*d.x+p.y*d.y+k1*p.z*d.z)-d.z,e=cv*(dot(p.xy,p.xy)+k1*p.z*p.z)-2.*p.z,D=b*b-a*e;if(D<0.)return false;
 float qq=b+(b<0.?-1.:1.)*sqrt(D),t=-e/qq;
 // Two roots: keep the one on the sheet through the vertex, judged against the sag formula, so hyperboloids behave.
 if(abs(a)>1e-9){float t2=-qq/a;vec3 q1=p+d*t,q2=p+d*t2;float r1=dot(q1.xy,q1.xy),r2=dot(q2.xy,q2.xy),d1=1.-k1*cv*cv*r1,d2=1.-k1*cv*cv*r2,e1=d1<0.?1e9:abs(q1.z-cv*r1/(1.+sqrt(d1))),e2=d2<0.?1e9:abs(q2.z-cv*r2/(1.+sqrt(d2)));if(e2<e1)t=t2;}
 if(C.z!=0.||C.w!=0.){for(int it=0;it<uFour;it++){vec3 q=p+d*t;float r2=dot(q.xy,q.xy),de=sqrt(max(1.-k1*cv*cv*r2,1e-5)),sg=cv*r2/(1.+de)+C.z*r2*r2+C.w*r2*r2*r2,ds=cv/de+4.*C.z*r2+6.*C.w*r2*r2;t-=(q.z-sg)/(d.z-ds*dot(q.xy,d.xy));}}
 if(t<-1e-4)return false;
 p+=d*t;float r2=dot(p.xy,p.xy);
 vec3 N=vec3(0,0,1);bool ap=true;
 if(uNoAp==0){if(r2>B.z*B.z||r2<B.w*B.w)ap=false;}
 if(!ap)return false;
 float de=sqrt(max(1.-k1*cv*cv*r2,1e-5)),sl=cv/de+4.*C.z*r2+6.*C.w*r2*r2;N=normalize(vec3(-p.xy*sl,1.));
 gO+=abs(n1)*abs(t);
 if(i==uSegI&&uNoAp==0){vec2 h=hexC(p.xy,uSegP/sqrt(3.));float ring=max(abs(h.x),max(abs(h.y),abs(h.x+h.y)));if(ring<.5||ring>3.5)return false;
  float h1=hs(h)*2.-1.,h2=hs(h+7.)*2.-1.,h3=hs(h+13.)*2.-1.;gO+=2.*uSegPist*h1;gPi+=2.*uSegPist*h1;N=normalize(N+vec3(h2,h3,0.)*uSegTilt);}
 float ty=A.w;
 if(ty<.5){vec3 Nf=dot(d,N)<0.?N:-N,r=refract(d,Nf,n1/n2_);if(dot(r,r)==0.)return false;d=r;}
 else if(ty<1.5)d=reflect(d,N);
 gP=toW(p,cs,sn)+vec3(0,B.x,A.x);gD=toW(d,cs,sn);return true;}
float nAt(int i){return uC[i].x+uC[i].y*(uLam[int(gCh)]>0.?1./(uLam[int(gCh)]*uLam[int(gCh)])-2.8962:0.);}
// Runs surfaces from i0 toward i1 inclusive. Same loop forward and backward.
bool run(int i0,int i1,int stepi,int stopRow){float nPrev=stepi>0?(i0==0?uN0:nAt(i0-1)):nAt(i0);
 for(int i=i0;stepi>0?i<=i1:i>=i1;i+=stepi){if(i==stopRow)return true;float nNext=stepi>0?nAt(i):(i==0?uN0:nAt(i-1));if(!surf(i,nPrev,nNext))return false;nPrev=nNext;}
 return true;}
vec3 specimen(vec2 q){vec2 g=q*uObjK;vec3 c=vec3(.92,.88,.8);for(int i=0;i<6;i++){vec2 k=vec2(cos(float(i)*2.4),sin(float(i)*2.4))*float(i)*.55;float d=length(g-k)-.45;c=mix(c,vec3(.75,.35,.55),smoothstep(.05,0.,d));c=mix(c,vec3(.25,.1,.35),smoothstep(.02,0.,abs(d)));float d2=length(g-k-.1)-.12;c=mix(c,vec3(.2,.15,.5),smoothstep(.03,0.,d2));}return c;}
${ACC}
void main(){st=uint(gl_FragCoord.x)*1973u+uint(gl_FragCoord.y)*9277u+uint(uFrame)*26699u;rnd();int ix=int(gl_FragCoord.x),iy=int(gl_FragCoord.y);
 int iLast=uNS-1;
 if(uMode==0){gCh=floor(rnd()*3.);
  // Backward from a pixel on the image surface toward a random point on the last optic, then out through every surface to the scene.
  vec2 uv=(gl_FragCoord.xy+vec2(rnd(),rnd())-.5-.5*uRes)/uRes.y*2.*uImgH;
  vec4 A=uA[iLast],B=uB[iLast];float cs=cos(B.y),sn=sin(B.y);gP=toW(vec3(uv,0),cs,sn)+vec3(0,B.x,A.x);
  int L=iLast-1;float a=rnd()*6.283,rr=sqrt(rnd())*uB[L].z;float cl=cos(uB[L].y),sl=sin(uB[L].y);vec3 tgt=toW(vec3(rr*cos(a),rr*sin(a),0.),cl,sl)+vec3(0,uB[L].x,uA[L].x);gD=normalize(tgt-gP);
  bool ok=run(L,0,-1,-1);vec3 c=vec3(0);
  if(ok){if(uObjK>0.){float t=(uObjZ-gP.z)/gD.z;vec3 q=gP+gD*t;c=specimen(q.xy);}else{c=shade(vec3(0,0,-.01),vec3(gD.x,gD.y,-gD.z));}c*=uGain;}
  vec3 w=vec3(0);w[int(gCh)]=3.;gData=gO;emit(c*w);return;}
 // Forward rays from the source: side fan and spot grid share this start.
 vec2 pu;
 if(uMode==1){int k=ix;pu=k==25?vec2(0,.02):vec2(0,(float(k)-12.)/12.*.985);}
 else pu=((vec2(ix,iy)+.5)/uRes*2.-1.)*1.0;
 float ap=uPup;vec3 s0=vec3(pu.x*ap,pu.y*ap,uA[0].x);
 if(uObjK>0.){vec3 src=vec3(0,uField,uObjZ);gP=src;gD=normalize(s0-src);}
 else{gD=vec3(0,sin(uField),cos(uField));gP=s0-gD*(ap*2.+1.);}
 if(uMode==1){int stopRow=iy-1;if(iy==0){o=vec4(gP,1);return;}
  bool ok=run(0,iLast,1,iy==uRowN?iLast+1:iy);o=iy==uRowN?vec4(gD,ok?1.:0.):vec4(gP,ok?1.:0.);return;}
 if(dot(pu,pu)>1.){o=vec4(0);return;}
 bool ok=run(0,iLast,1,iLast+1);vec4 A=uA[iLast],B=uB[iLast];vec3 q=toL(gP-vec3(0,B.x,A.x),cos(B.y),sin(B.y));o=vec4(q.xy,uMode==3&&uRowN<0?gO:gPi,ok?1.:0.);}`
  );
}
