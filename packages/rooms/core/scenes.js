// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= Far side scenes
// Each is one vec3 shade(ro,rd), selected at compile time. gT is the hit distance, used by depth and time of flight.
export const SKYFN = `uniform vec4 uMarkP;vec3 sun=normalize(vec3(.5,.9,-.35));float gT=1e3;
float box(vec2 q,vec2 c,vec2 s){return step(abs(q.x-c.x),s.x)*step(abs(q.y-c.y),s.y);}
bool hsph(vec3 ro,vec3 rd,vec3 c,float R,inout float t){vec3 q=ro-c;float B=dot(q,rd),C=dot(q,q)-R*R,D=B*B-C;if(D<0.)return false;float a=-B-sqrt(D);if(a>.001&&a<t){t=a;return true;}return false;}
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float h11(float x){return fract(sin(x*91.17)*43758.5453);}
#define S1(C,R,A,ROUGH) if(hsph(ro,rd,C,R,t)){n=normalize(ro+rd*t-(C));al=A;em=vec3(0);rg=ROUGH;h=true;}
#define L1(C,R,E) if(hsph(ro,rd,C,R,t)){n=normalize(ro+rd*t-(C));al=vec3(0);em=E;rg=1.;h=true;}
#define PL(COND,X,N) if(COND){float x=X;if(x>.001&&x<t){t=x;n=N;em=vec3(0);rg=1.;h=true;vec3 p=ro+rd*t;
#define PLE }}
#define DAY vec3 sky(vec3 rd){float k=clamp(rd.y*.7+.4,0.,1.);return mix(vec3(.75,.74,.7),vec3(.25,.42,.68),k)+pow(max(dot(rd,sun),0.),200.)*8.;}
`;
// Each world is hitS (nearest hit, may shrink t), sky (what a miss sees), air (what the medium adds along the first ray), LAMP (area light used by the path tracer, w=0 for none).
export const AIR0 = "vec3 air(vec3 ro,vec3 rd,float t,vec3 c){return c;}";
export const SCENES = {
  chart: {
    name: "Chart room",
    lamp: "vec4(2.4,5.2,-1.,1.1)",
    lc: "vec3(26.,24.,21.)",
    glsl: `DAY
${AIR0}
vec3 chart(vec2 q){vec3 col=vec3(.86,.85,.8);vec2 g=abs(fract(q)-.5);float l=step(.47,max(g.x,g.y));col=mix(col,vec3(.25),l*.7);
 float r=length(q-vec2(-3.2,1.1));col=mix(col,vec3(.08),step(.5,fract(r*2.2))*step(r,1.5));
 for(int i=0;i<6;i++){float x=float(i)-1.;vec3 c=.5+.5*cos(6.283*(float(i)/6.+vec3(0,.33,.67)));col=mix(col,c,box(q,vec2(x*.9+.3,-1.9),vec2(.42,.42)));}
 float F=max(box(q,vec2(2.7,1.1),vec2(.22,1.25)),max(box(q,vec2(3.3,2.1),vec2(.8,.22)),box(q,vec2(3.15,1.1),vec2(.65,.2))));col=mix(col,vec3(.75,.1,.1),F);
 float s=box(q,vec2(-.5,1.3),vec2(1.,1.));if(s>0.){float a=atan(q.y-1.3,q.x+.5);col=mix(col,vec3(step(0.,sin(a*18.))),s);}
 return col;}
bool hitS(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=false;
 PL(rd.y<0.,(-1.7-ro.y)/rd.y,vec3(0,1,0)) float k=step(0.,sin(p.x*1.57)*sin(p.z*1.57));al=mix(vec3(.22),vec3(.42),k);rg=.75; PLE
 PL(rd.z<0.,(-9.-ro.z)/rd.z,vec3(0,0,1)) al=mix(vec3(.5,.28,.1),vec3(.14,.2,.32),step(0.,sin(p.x*2.))); PLE
 if(rd.z>0.){float x=(6.-ro.z)/rd.z;if(x>.001&&x<t){vec3 p=ro+rd*x;if(abs(p.x)<6.&&p.y<4.3){t=x;n=vec3(0,0,-1);h=true;em=vec3(0);rg=1.;
   if(uHasImg==1){vec2 uv=vec2(p.x/12.+.5,1.-(p.y+1.7)/6.);al=pow(texture(uImg,uv).rgb,vec3(2.2));}else al=chart(p.xy-vec2(0,1.3));}}}
 S1(vec3(-2.6,-.9,1.5),.8,vec3(.85,.3,.15),.35) S1(vec3(2.4,-1.1,-1.),.6,vec3(.15,.55,.75),.08) S1(vec3(.2,-1.2,3.2),.5,vec3(.9,.75,.2),1.)
 L1(LAMP.xyz,LAMP.w,LAMPC)
 return h;}`,
  },
  grove: {
    name: "Grove",
    lamp: "vec4(0.)",
    lc: "vec3(0.)",
    glsl: `DAY
${AIR0}
bool hitS(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=false;
 PL(rd.y<0.,(-1.7-ro.y)/rd.y,vec3(0,1,0)) float k=step(0.,sin(p.x*1.57)*sin(p.z*1.57));al=mix(vec3(.13,.17,.08),vec3(.2,.24,.1),k); PLE
 for(int i=0;i<7;i++){float fi=float(i);vec2 c=vec2(-6.+fi*2.+sin(fi*2.3)*.7,4.+mod(fi*3.1,6.));vec2 q=ro.xz-c;float A=dot(rd.xz,rd.xz),B=dot(q,rd.xz),C=dot(q,q)-.09,D=B*B-A*C;
  if(D>0.){float x=(-B-sqrt(D))/A;if(x>.001&&x<t&&ro.y+rd.y*x<3.){t=x;vec3 p=ro+rd*t;n=normalize(vec3(p.x-c.x,0,p.z-c.y));al=vec3(.28,.19,.11)*(.8+.2*sin(p.y*30.));em=vec3(0);rg=1.;h=true;}}
  vec3 cc=vec3(c.x,3.3+mod(fi*1.7,1.),c.y);if(hsph(ro,rd,cc,1.4+.3*sin(fi),t)){vec3 p=ro+rd*t;n=normalize(p-cc);al=vec3(.13,.35,.12)+.1*sin(p*7.).yzx;em=vec3(0);rg=1.;h=true;}}
 return h;}`,
  },
};
// Forest with rain: the grove, a dim sky and frozen streaks along the first ray.
SCENES.rain = {
  name: "Forest in rain",
  lamp: "vec4(0.)",
  lc: "vec3(0.)",
  glsl: SCENES.grove.glsl.replace(
    "DAY\n" + AIR0,
    `vec3 sky(vec3 rd){return mix(vec3(.42,.45,.48),vec3(.2,.23,.27),clamp(rd.y,0.,1.));}
vec3 air(vec3 ro,vec3 rd,float t,vec3 c){c=mix(c,vec3(.33,.36,.38),1.-exp(-t*.05));for(int k=0;k<3;k++){float s=3.+float(k)*2.5;vec2 a=vec2(atan(rd.x,rd.z)*40./s,rd.y*5./s+rd.x*.2);vec2 id=floor(a);float h=h21(id+float(k)*9.);c+=vec3(.5)*step(.86,h)*smoothstep(.09,0.,abs(fract(a.x)-.5))*smoothstep(.5,.1,abs(fract(a.y)-.5));}return c;}`
  ),
};
SCENES.water = {
  name: "Under water",
  lamp: "vec4(0.)",
  lc: "vec3(0.)",
  glsl: `
vec3 sky(vec3 rd){vec3 c=mix(vec3(.01,.1,.16),vec3(.2,.65,.75),clamp(rd.y*1.1+.3,0.,1.));float sn=max(rd.y,0.);c+=vec3(.7,.9,.8)*pow(sn,14.)*(1.+.5*sin(rd.x*30.)*sin(rd.z*30.));return c;}
vec3 air(vec3 ro,vec3 rd,float t,vec3 c){vec3 ab=vec3(.32,.07,.04);vec3 f=c*exp(-ab*t);f+=(vec3(.02,.16,.2))*(1.-exp(-.09*t));
 float a=atan(rd.x,rd.z);float sh=pow(.5+.5*sin(a*19.+rd.y*3.)*sin(a*7.+1.3),3.);f+=vec3(.16,.3,.28)*sh*max(rd.y+.15,0.)*min(t*.1,1.);return f;}
bool hitS(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=false;
 PL(rd.y<0.,(-1.7-ro.y)/rd.y,vec3(0,1,0)) float c1=sin(p.x*2.1+sin(p.z*1.3)*2.)*sin(p.z*2.4+sin(p.x*1.1)*2.);al=vec3(.62,.56,.4)*(.7+1.3*pow(1.-abs(c1),6.)); PLE
 for(int i=0;i<6;i++){float fi=float(i);vec3 c=vec3(sin(fi*1.7)*5.,-1.3+.6*h11(fi),4.+fi*1.6);S1(c,.45+.5*h11(fi+3.),vec3(.45,.24,.3)+.2*sin(fi),1.)}
 for(int i=0;i<5;i++){float fi=float(i);vec3 c=vec3(sin(fi*2.9)*4.,.6+fi*.5,3.+fi*2.);S1(c,.16,vec3(.9,.55,.15),.2)}
 return h;}`,
};
SCENES.night = {
  name: "Night sky",
  lamp: "vec4(0.)",
  lc: "vec3(0.)",
  glsl: `${AIR0}
vec3 sky(vec3 rd){vec3 c=vec3(.004,.006,.014);vec3 mw=normalize(vec3(.2,.9,.35));float band=exp(-pow(dot(rd,mw)/.22,2.));c+=band*vec3(.05,.045,.06)*(.6+.4*sin(rd.x*19.+rd.z*23.)*sin(rd.y*31.));
 vec2 a=vec2(atan(rd.x,rd.z),asin(clamp(rd.y,-1.,1.)));
 for(int k=0;k<3;k++){float cell=k==0?.035:k==1?.004:.00035;vec2 g=a/cell,id=floor(g),f=fract(g)-.5;float h=h21(id+float(k)*17.);float keep=k==0?.28:k==1?.03:.12;
  if(h<keep){vec2 o=vec2(h21(id+3.1),h21(id+7.7))-.5;float rad=k==0?.05:k==1?.12:.03;float s=smoothstep(rad,0.,length(f-o*.7));float T=h21(id+1.3);c+=s*(k==0?22.:k==1?60.:900.)*mix(vec3(1.,.72,.5),vec3(.65,.8,1.),T);}}
 return c;}
bool hitS(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=false;vec3 mc=vec3(60,40,400);if(hsph(ro,rd,mc,12.,t)){n=normalize(ro+rd*t-mc);em=vec3(.8,.78,.7)*max(dot(n,normalize(vec3(.6,.3,-.7))),0.)*3.;al=vec3(0);h=true;}
 PL(rd.y<0.,(-1.7-ro.y)/rd.y,vec3(0,1,0)) al=vec3(.01,.012,.02); PLE
 return h;}`,
};
SCENES.cell = {
  name: "Cell interior",
  lamp: "vec4(1.2,3.,-.5,.9)",
  lc: "vec3(16.,15.,17.)",
  glsl: `${AIR0}
vec3 sky(vec3 rd){return vec3(.05,.02,.05);}
bool hitS(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=false;
 {vec3 q=ro;float B=dot(q,rd),C=dot(q,q)-81.,D=B*B-C;if(D>0.){float x=-B+sqrt(D);if(x>.001&&x<t){t=x;vec3 p=ro+rd*t;n=-normalize(p);al=vec3(.72,.34,.42)*(.7+.3*sin(p.x*5.+sin(p.y*4.)*2.)*sin(p.z*5.));em=vec3(.05,.015,.03);rg=.6;h=true;}}}
 S1(vec3(.6,.3,4.8),1.7,vec3(.32,.2,.55),.45)
 for(int i=0;i<9;i++){float fi=float(i);vec3 c=vec3(sin(fi*2.4)*4.5,cos(fi*1.9)*3.,2.+mod(fi*2.7,6.));vec3 d=vec3(.5*sin(fi),.5*cos(fi*1.3),.3);vec3 pa=ro-c;
  float m=dot(rd,d),ma=dot(pa,d),dd=dot(d,d);float A=dd-m*m,B=dd*dot(rd,pa)-ma*m,C=dd*dot(pa,pa)-ma*ma-.16*dd,D=B*B-A*C;if(D>0.&&A>1e-5){float x=(-B-sqrt(D))/A;float y=ma+x*m;if(x>.001&&x<t&&y>-dd&&y<dd){t=x;vec3 p=ro+rd*t;n=normalize(p-c-d*clamp(y/dd,-1.,1.));al=vec3(.85,.45,.2)*(.75+.25*sin(y*14.));em=vec3(0);rg=.5;h=true;}}}
 for(int i=0;i<14;i++){float fi=float(i);vec3 c=vec3(sin(fi*3.1)*6.,sin(fi*1.3)*4.,3.+mod(fi*1.9,7.));S1(c,.14+.1*h11(fi),vec3(.25,.65,.55),.3)}
 L1(LAMP.xyz,LAMP.w,LAMPC)
 return h;}`,
};
SCENES.cave = {
  name: "Crystal cave",
  lamp: "vec4(-1.5,2.5,4.,.5)",
  lc: "vec3(9.,18.,30.)",
  glsl: `${AIR0}
vec3 sky(vec3 rd){return vec3(.0);}
vec3 pn(float k){float a=k*2.39996,z=1.-2.*(k+.5)/22.,r=sqrt(max(1.-z*z,0.));return vec3(r*cos(a),z,r*sin(a));}
bool hitS(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=false;
 float best=1e9;float bk=0.;for(int i=0;i<22;i++){float k=float(i);vec3 a=pn(k);float dd=dot(rd,a);if(dd>1e-4){float x=(9.+1.5*h11(k)-dot(ro,a))/dd;if(x<best){best=x;bk=k;}}}
 if(best<t&&best>.001){t=best;h=true;n=-pn(bk);vec3 p=ro+rd*t;float v=h11(bk+2.);al=mix(vec3(.3,.22,.5),vec3(.25,.5,.6),v);rg=.12+.4*v;em=vec3(.0,.08,.13)*step(.72,v)+vec3(.09,.02,.13)*step(v,.14);float vn=abs(sin(dot(p,normalize(vec3(.7,.3,.5)))*3.));em*=.5+1.5*smoothstep(.9,1.,vn);}
 for(int i=0;i<7;i++){float fi=float(i);vec3 c=vec3(sin(fi*2.2)*4.,-1.2+h11(fi)*.5,3.+fi*.9);S1(c,.5+.4*h11(fi+4.),vec3(.5,.7,.9),.04)}
 L1(LAMP.xyz,LAMP.w,LAMPC)
 return h;}`,
};
SCENES.city = {
  name: "City street at night",
  lamp: "vec4(3.,4.2,3.,.4)",
  lc: "vec3(90.,64.,34.)",
  glsl: `${AIR0}
vec3 sky(vec3 rd){return mix(vec3(.05,.04,.08),vec3(.008,.012,.03),clamp(rd.y*2.,0.,1.));}
bool hitS(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=false;
 PL(rd.y<0.,(-1.7-ro.y)/rd.y,vec3(0,1,0)) float lane=step(abs(p.x),.1)*step(.5,fract(p.z*.25));al=mix(vec3(.05),vec3(.8,.75,.5),lane);rg=.14+.3*abs(sin(p.x*3.)*sin(p.z*2.3)); PLE
 for(int sd=0;sd<2;sd++){float X=sd==0?-7.:7.;if(rd.x*X>0.){float x=(X-ro.x)/rd.x;if(x>.001&&x<t){vec3 p=ro+rd*x;float hh=9.+6.*h11(floor(p.z/5.)+X);if(p.y<hh){t=x;n=vec3(sd==0?1.:-1.,0,0);h=true;rg=.9;al=vec3(.1,.1,.12);vec2 g=vec2(p.z,p.y)/vec2(1.1,1.5);vec2 id=floor(g),f=fract(g);float win=step(.2,f.x)*step(f.x,.8)*step(.25,f.y)*step(f.y,.75);float on=step(.45,h21(id+X));em=win*on*mix(vec3(1.1,.75,.35),vec3(.4,.7,1.1),step(.75,h21(id+1.)))*1.6;}}}}
 for(int i=0;i<6;i++){float z=float(i)*5.-6.;float X=mod(float(i),2.)<.5?-4.5:4.5;L1(vec3(X,3.6,z),.16,vec3(70.,48.,22.)) }
 for(int i=0;i<4;i++){float fi=float(i);L1(vec3(-2.+fi*1.3,-1.2,14.+fi*5.),.09,fi<2.?vec3(90.,6.,5.):vec3(70.,70.,55.))}
 L1(LAMP.xyz,LAMP.w,LAMPC)
 return h;}`,
};
export const sceneCode = (k) => {
  const c = SCENES[k];
  return (
    SKYFN +
    `\nconst vec4 LAMP=${c.lamp};const vec3 LAMPC=${c.lc};\n` +
    c.glsl +
    `
bool hitAll(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=hitS(ro,rd,t,n,al,em,rg);if(uMarkP.w>0.&&hsph(ro,rd,uMarkP.xyz,uMarkP.w,t)){vec3 q=ro+rd*t-uMarkP.xyz;n=normalize(q);h=true;rg=.1;em=vec3(0);al=vec3(.08);float a=dot(n,vec3(0,0,1));if(a>.75)al=vec3(.5,.7,.9);if(a>.9)al=vec3(.02);}return h;}
vec3 shade(vec3 ro,vec3 rd){float t=1e5,rg=1.;vec3 n=vec3(0),al=vec3(0),em=vec3(0);bool h=hitAll(ro,rd,t,n,al,em,rg);gT=h?t:60.;vec3 c=h?em+al*(max(dot(n,sun),0.)*1.15+.32):sky(rd);return air(ro,rd,gT,c);}`
  );
};
