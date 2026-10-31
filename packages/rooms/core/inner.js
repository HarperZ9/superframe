// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= World inside the lens
// Objects live in the lens's own frame and are tested only while a ray is in the medium, so any part reaching past the surface is cut away by it. From outside, the same objects are met through the glass by the same trace.
export const I_COMMON = `bool sphI(vec3 ro,vec3 rd,vec4 s,inout float t){vec3 q=ro-s.xyz;float B=dot(q,rd),C=dot(q,q)-s.w*s.w,D=B*B-C;if(D<0.)return false;float a=-B-sqrt(D);if(a>1e-3&&a<t){t=a;return true;}return false;}
bool capI(vec3 ro,vec3 rd,vec4 a,vec3 b,inout float t,inout vec3 n){vec3 ba=b-a.xyz,oa=ro-a.xyz;float bb=dot(ba,ba),bd=dot(ba,rd),bo=dot(ba,oa),A=bb-bd*bd,B=bb*dot(oa,rd)-bo*bd,C=bb*dot(oa,oa)-bo*bo-a.w*a.w*bb,D=B*B-A*C;if(D<0.||A<1e-7)return false;float x=(-B-sqrt(D))/A,y=bo+x*bd;if(x>1e-3&&x<t&&y>0.&&y<bb){t=x;n=normalize(ro+rd*x-a.xyz-ba*y/bb);return true;}return false;}`;
export const I_SET = {
  spheres: `bool hitCore(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=false;
 for(int k=0;k<uNIO;k++){vec4 s=uIO[k];if(sphI(ro,rd,s,t)){n=normalize(ro+rd*t-s.xyz);al=.5+.42*cos(6.283*(float(k)*.19+vec3(0,.33,.67)));em=vec3(0);rg=mod(float(k),3.)<1.?.08:.9;h=true;}}
 if(abs(rd.y)>1e-4){float x=(uIP-ro.y)/rd.y;if(x>1e-3&&x<t){vec3 q=ro+rd*x;vec2 g=abs(fract(q.xz*2.5)-.5);if(max(g.x,g.y)>.455){t=x;n=vec3(0,1,0);al=vec3(.9,.8,.45);em=vec3(.12,.1,.05);rg=1.;h=true;}}}
 return h;}`,
  tree: `bool hitCore(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=false;
 for(int k=0;k<uNC;k++){vec4 a=uCa[k];vec4 b=uCb[k];if(capI(ro,rd,a,b.xyz,t,n)){al=mix(vec3(.3,.2,.11),vec3(.5,.34,.2),b.w);em=vec3(0);rg=1.;h=true;}if(b.w>.5&&sphI(ro,rd,vec4(b.xyz,a.w*4.),t)){n=normalize(ro+rd*t-b.xyz);al=vec3(.15,.48,.16)+.12*sin(float(k)*vec3(1.,2.,3.));em=vec3(0);rg=.9;h=true;}}
 return h;}`,
  crystals: `bool hitCore(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=false;
 for(int k=0;k<uNIO;k++){vec4 s=uIO[k];float an=float(k)*1.7,ca=cos(an),sa=sin(an),cb=cos(an*.6+.5),sb=sin(an*.6+.5);vec3 q=ro-s.xyz;
  q=vec3(ca*q.x+sa*q.z,q.y,-sa*q.x+ca*q.z);q=vec3(cb*q.x-sb*q.y,sb*q.x+cb*q.y,q.z);vec3 d=vec3(ca*rd.x+sa*rd.z,rd.y,-sa*rd.x+ca*rd.z);d=vec3(cb*d.x-sb*d.y,sb*d.x+cb*d.y,d.z);
  vec3 hs=vec3(.55,1.3,.55)*s.w,m=1./d,a=-m*q,b=abs(m)*hs,t1=a-b,t2=a+b;float tn=max(t1.x,max(t1.y,t1.z)),tf=min(t2.x,min(t2.y,t2.z));
  if(tn<tf&&tn>1e-3&&tn<t){t=tn;vec3 ln=t1.x>t1.y&&t1.x>t1.z?vec3(d.x>0.?-1.:1.,0,0):t1.y>t1.z?vec3(0,d.y>0.?-1.:1.,0):vec3(0,0,d.z>0.?-1.:1.);ln=vec3(cb*ln.x+sb*ln.y,-sb*ln.x+cb*ln.y,ln.z);n=vec3(ca*ln.x-sa*ln.z,ln.y,sa*ln.x+ca*ln.z);al=.55+.4*cos(6.283*(float(k)*.13+.55+vec3(0,.2,.4)));em=al*.05;rg=.06;h=true;}}
 return h;}`,
  cell: `bool hitCore(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=false;
 for(int k=0;k<uNIO;k++){vec4 s=uIO[k];if(sphI(ro,rd,s,t)){vec3 q=ro+rd*t-s.xyz;n=normalize(q);float v=.5+.5*sin(q.x*40./max(s.w*8.,.3)+float(k))*sin(q.y*38./max(s.w*8.,.3));al=k==0?vec3(.34,.2,.58):mix(vec3(.7,.34,.42),vec3(.86,.55,.5),v);em=vec3(.015,.005,.01);rg=.6;h=true;}}
 for(int k=0;k<uNC;k++){if(capI(ro,rd,uCa[k],uCb[k].xyz,t,n)){al=vec3(.85,.47,.18);em=vec3(0);rg=.5;h=true;}}
 return h;}`,
  room: `bool hitCore(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=false;vec4 r0=uIO[0];vec3 q=ro-r0.xyz,m=1./rd,a=-m*q,b=abs(m)*r0.w,t1=a-b,t2=a+b;float tn=max(t1.x,max(t1.y,t1.z)),tf=min(t2.x,min(t2.y,t2.z));
 if(tn<tf&&tf>1e-3){float x=tn>1e-3?tn:tf;if(x<t){vec3 w=(ro+rd*x-r0.xyz)/r0.w;bool win=abs(w.z)>.98&&abs(w.x)<.55&&abs(w.y)<.42;if(!win){t=x;vec3 aw=abs(w);n=aw.y>aw.x&&aw.y>aw.z?vec3(0,w.y>0.?-1.:1.,0):aw.x>aw.z?vec3(w.x>0.?-1.:1.,0,0):vec3(0,0,w.z>0.?-1.:1.);if(tn>1e-3)n=-n;float ck=step(0.,sin(w.x*12.)*sin(w.z*12.));al=w.y<-.97?mix(vec3(.5,.34,.2),vec3(.68,.5,.3),ck):w.y>.97?vec3(.85):vec3(.8,.72,.6);em=vec3(0);rg=1.;h=true;}}}
 for(int k=1;k<uNIO;k++){vec4 s=uIO[k];if(sphI(ro,rd,s,t)){n=normalize(ro+rd*t-s.xyz);al=k==1?vec3(.55,.2,.15):vec3(.2,.4,.6);em=vec3(0);rg=k==1?.2:.8;h=true;}}
 return h;}`,
};
export function innerCode(k) {
  return (
    I_COMMON +
    I_SET[k] +
    `
bool hitI(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=hitCore(ro,rd,t,n,al,em,rg);if(uLampI.w>0.&&sphI(ro,rd,vec4(uLampI.xyz,.12*sqrt(uLampI.w)),t)){n=-rd;al=vec3(0);em=vec3(1.,.86,.62)*14.;rg=-1.;h=true;}return h;}
// Diffuse or glossy bounce on an embedded body, with a shadow ray to the inner lamp. The shadow ray steps through the shape, so a lobe or wall of air between them blocks the lamp.
void innerBounce(vec3 q,vec3 n,vec3 al,vec3 em,float rg,vec3 wd,inout vec3 p,inout vec3 d,inout vec3 c,inout vec3 L,bool spec){L+=c*em;vec3 tn=dot(n,wd)>0.?-n:n;
 if(uLampI.w>0.){vec3 li=uLampI.xyz-q;float dl=length(li);li/=dl;float cs=dot(tn,li);if(cs>0.){bool ok=true;for(int i=0;i<uFive;i++){if(f(q+li*dl*(float(i)+.5)/float(uFive))>0.)ok=false;}
   if(ok){float t2=dl-.12*sqrt(uLampI.w),r2=1.;vec3 n2_=vec3(0),a2=vec3(0),e2=vec3(0);if(!hitCore(q+tn*.002,li,t2,n2_,a2,e2,r2))L+=c*al*vec3(1.,.86,.62)*uLampI.w*cs*2./(dl*dl+.0004);}}}
 vec3 sd=reflect(wd,tn),nd=rnd()<rg?normalize(tn+runit()*.999):normalize(sd+runit()*rg*rg);if(dot(nd,tn)<=0.)nd=normalize(nd+tn*1.01);c*=rg<.2?mix(al,vec3(1),.5):al;p=q+tn*.002;d=nd;}`
  );
}
export let hsh = (i) => {
  const x = Math.sin(i * 91.17) * 43758.5453;
  return x - Math.floor(x);
};
