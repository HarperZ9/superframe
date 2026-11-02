// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= Shapes
// Each shape is the body of float s(vec3 p,float c): c is Strength, r is length(p). Inside is negative.
// Only the selected body reaches the compiler, so a program's size does not grow with this table.
export const hyd = (ps, lv) =>
  `vec3 q=p*5.;float rr=length(q)+1e-4,ps=${ps},lv=${lv || "mix(.25,.04,c)"};return max(lv-abs(ps),r-1.4);`;
export const SH = {
  none: ["No lens", "return 1.;"],
  0: [
    "Biconvex",
    "float R=mix(4.,1.25,c),d=sqrt(max(R*R-1.44,0.));return max(length(p-vec3(0,0,d))-R,length(p+vec3(0,0,d))-R);",
  ],
  1: [
    "Biconcave",
    "float R=mix(4.,1.3,c),d=R+.07;return max(max(length(p.xy)-1.2,abs(p.z)-1.),-min(length(p-vec3(0,0,d))-R,length(p+vec3(0,0,d))-R));",
  ],
  2: [
    "Plano-convex",
    "float R=mix(4.,1.25,c),d=sqrt(max(R*R-1.44,0.));return max(length(p+vec3(0,0,d))-R,p.z);",
  ],
  3: [
    "Meniscus",
    "float R=mix(4.,1.3,c),d=sqrt(max(R*R-1.44,0.));return max(max(length(p+vec3(0,0,d-.3))-R,-(length(p+vec3(0,0,d-.05))-R)),length(p.xy)-1.2);",
  ],
  8: ["Axicon cone", "return max(length(p.xy)-1.2,p.z+.5-(1.2-length(p.xy))*mix(.2,1.,c));"],
  4: ["Torus", "return length(vec2(length(p.xy)-.85,p.z))-mix(.12,.42,c);"],
  5: ["Full globe", "return r-1.;"],
  6: ["Hollow sphere", "return abs(r-1.)-mix(.05,.3,c);"],
  7: ["Cylinder rod", "return max(length(p.xy)-mix(.3,.85,c),abs(p.z)-1.3);"],
  16: [
    "Möbius band",
    "float a=atan(p.z,p.x),m=mix(.1,.5,c);vec3 q=vec3(length(p.xz)-.8,p.y,0.);float b=a*.5;vec2 w=vec2(cos(b)*q.x+sin(b)*q.y,-sin(b)*q.x+cos(b)*q.y);return max(abs(w.x)-m*.9,abs(w.y)-.08);",
  ],
  9: ["Eye: globe with cornea", "return min(r-.9,length(p+vec3(0,0,.72))-.52);"],
  10: ["Tube eye: sphere with cylinder", "return min(max(length(p.xy)-.62,abs(p.z-.6)-.7),r-.75);"],
  11: [
    "Sunflower lenslets",
    "vec2 q=p.xy;float a=0.,d=1e3;for(int k=1;k<35;k++){float rr=sqrt(float(k)/34.)*1.1;a+=2.39996;d=min(d,length(vec3(q-rr*vec2(cos(a),sin(a)),p.z-.07))-.15);}return min(max(length(q)-1.2,abs(p.z)-.1),d);",
  ],
  12: [
    "Compound eye",
    "vec2 q=p.xy/.3,sz=vec2(1.,1.732),a=mod(q,sz)-.5*sz,b=mod(q-.5*sz,sz)-.5*sz;float dd=min(length(a),length(b))*.3;return max(length(p.xy)-1.2,p.z-.1-sqrt(max(.0225-dd*dd,0.))*2.*c)+max(0.,-p.z-.1);",
  ],
  13: [
    "Gyroid",
    "vec3 q=p*mix(3.,8.,c);float g=sin(q.x)*cos(q.y)+sin(q.y)*cos(q.z)+sin(q.z)*cos(q.x);return max(r-1.25,abs(g)-.5);",
  ],
  14: [
    "Icosahedron",
    "float t=1.618034;vec3 q=abs(p);return max(dot(q,normalize(vec3(0,1,t))),max(dot(q,normalize(vec3(1,t,0))),dot(q,normalize(vec3(t,0,1)))))-1.;",
  ],
  15: [
    "Dodecahedron",
    "float t=1.618034;vec3 q=abs(p);return max(dot(q,normalize(vec3(1,1,1))),max(dot(q,normalize(vec3(0,1./t,t))),max(dot(q,normalize(vec3(1./t,t,0))),dot(q,normalize(vec3(t,0,1./t))))))-1.;",
  ],
  17: ["Hydrogen 2s", hyd("(2.-rr)*exp(-rr/2.)*.5", "mix(.3,.05,c)")],
  18: ["Hydrogen 2p", hyd("q.z*exp(-rr/2.)*.5")],
  19: ["Hydrogen 3d z²", hyd("(3.*q.z*q.z-rr*rr)/rr*exp(-rr/3.)*.09")],
  20: ["Hydrogen 3d xy", hyd("q.x*q.y/rr*exp(-rr/3.)*.22")],
  21: ["Hydrogen 4f", hyd("q.z*(5.*q.z*q.z-3.*rr*rr)/(rr*rr)*exp(-rr/4.)*.03")],
  26: [
    "Spiral phase plate",
    "float a=atan(p.y,p.x)/PI;return max(length(p.xy)-1.2,max(-p.z-.2,p.z-.2-.25*c*a));",
  ],
  25: [
    "Airy cubic plate",
    "return max(length(p.xy)-1.2,max(-p.z-.5,p.z-.1-.45*c*(p.x*p.x*p.x+p.y*p.y*p.y)));",
  ],
  22: ["Butterworth profile", "float rr=length(p.xy)/.9;return rev(p,1./sqrt(1.+pow(rr,8.)),c);"],
  23: [
    "Chebyshev ripple",
    "float rr=length(p.xy)/.95;float T=rr<=1.?cos(4.*acos(rr)):cosh(4.*log(rr+sqrt(rr*rr-1.)));return rev(p,1./sqrt(1.+.5*T*T),c);",
  ],
  24: ["Fiber mode", "float rr=length(p.xy);return rev(p,exp(-rr*rr/.5),c);"],
  27: ["Wedge cone", "float rr=length(p.xy);return max(rr-1.2,max(-p.z-.1,p.z-.1-.5*c*(1.2-rr)));"],
  28: [
    "Smith chart plate",
    "vec2 g=p.xy/1.15;float dn=dot(g-vec2(1,0),g-vec2(1,0))+1e-3;vec2 z=vec2(1.-dot(g,g),2.*g.y)/dn;float l=.5+.5*cos(3.*log(z.x*z.x+.1))*cos(2.5*atan(z.y));return max(length(p.xy)-1.15,abs(p.z)-.1-.25*c*l);",
  ],
  29: [
    "Three-petal ring",
    "float a=atan(p.y,p.x)*3.,rr=length(p.xy),h=exp(-pow((rr-.7)/.25,2.))*(.6+.4*cos(a));return rev(p,h+.08,c);",
  ],
  // Extra bodies. Gomboc and pine cone are shape studies, named as approximations.
  40: ["Flat plate", "return max(length(p.xy)-1.2,abs(p.z)-mix(.08,.6,c));"],
  41: [
    "Pine cone scales",
    "vec3 q=p*vec3(1.,1.,.72);float a=atan(p.y,p.x),z=p.z*7.;float g=sin(8.*a+z*1.3)*sin(13.*a-z*2.1);return length(q)-(.9+.09*c*g)*(1.-.12*p.z);",
  ],
  42: [
    "Shell spiral",
    "float rho=length(p.xy),th=atan(p.y,p.x),b=.13,k=floor((log(max(rho,.02))/b-th)/6.28318+.5),a0=exp(b*(th+6.28318*k));float tube=a0*mix(.22,.42,c);return max(length(vec2(rho-a0,p.z-a0*.7))-tube,r-1.5);",
  ],
  43: [
    "Leaf vein plate",
    "float u=p.x,v=p.y+.15;float out0=abs(u)-(.95*sqrt(max(1.-v*v/1.3,0.)))*(1.-.25*v);float veins=exp(-pow(u/.035,2.))+.6*exp(-pow((fract(v*3.5-abs(u)*2.1)-.5)/.1,2.));return max(out0,abs(p.z)-.05-.14*c*veins);",
  ],
  44: [
    "Gomboc-like body (approximation)",
    "float th=acos(clamp(p.z/max(r,1e-3),-1.,1.)),ph=atan(p.y,p.x),s2=sin(th)*sin(th);float m=.28*c*s2*(cos(th)>0.?cos(2.*ph):-cos(2.*ph))*abs(cos(th));return r-(1.+m);",
  ],
  45: [
    "Reuleaux tetrahedron",
    "vec3 v1=vec3(1,1,1)*.612,v2=vec3(1,-1,-1)*.612,v3=vec3(-1,1,-1)*.612,v4=vec3(-1,-1,1)*.612;float W=1.731;return max(max(length(p-v1),length(p-v2)),max(length(p-v3),length(p-v4)))-W;",
  ],
  46: [
    "Meissner body",
    "vec3 v1=vec3(1,1,1)*.612,v2=vec3(1,-1,-1)*.612,v3=vec3(-1,1,-1)*.612,v4=vec3(-1,-1,1)*.612;float W=1.731;float d=max(max(length(p-v1),length(p-v2)),max(length(p-v3),length(p-v4)))-W;" +
      // Three edges at v1 are rounded: inside a wedge outward of edge AB the surface is the spindle swept by a radius W arc about AB (Meissner, 1911). Wedge planes hold AB and the other two vertices, by tangency.
      "for(int e=0;e<3;e++){vec3 B=e==0?v2:e==1?v3:v4,C=e==0?v3:e==1?v4:v2,D=e==0?v4:e==1?v2:v3;vec3 ax=normalize(B-v1);vec3 m=.5*(v1+B),q=p-m;float h=dot(q,ax);vec3 rad=q-ax*h;float rho=length(rad);vec3 cc=C-m;cc-=ax*dot(cc,ax);vec3 dd=D-m;dd-=ax*dot(dd,ax);if(dot(cross(cc,rad),ax)*dot(cross(cc,dd),ax)<0.&&dot(cross(dd,rad),ax)*dot(cross(dd,cc),ax)<0.){d=length(vec2(rho+.866*W,h))-W;}}return d;",
  ],
  47: [
    "Trefoil knot",
    "float d=1e3;for(int i=0;i<36;i++){float t=float(i)/36.*6.28318;vec3 c0=vec3(sin(t)+2.*sin(2.*t),cos(t)-2.*cos(2.*t),-sin(3.*t))*.36;d=min(d,length(p-c0));}return d-mix(.1,.2,c);",
  ],
  48: [
    "Figure eight knot",
    "float d=1e3;for(int i=0;i<40;i++){float t=float(i)/40.*6.28318;float rr2=(2.+cos(2.*t))*.38;vec3 c0=vec3(rr2*cos(3.*t),rr2*sin(3.*t),sin(4.*t)*.42);d=min(d,length(p-c0));}return d-mix(.09,.17,c);",
  ],
  49: [
    "Water drop with ripples",
    "float h=p.z;float tail=smoothstep(-1.3,.9,-h);float R=mix(.35,1.,tail);float rip=.04*c*sin(length(p.xy)*22.+p.z*9.)*exp(-length(p.xy)*1.2);return length(vec3(p.xy,(h+.1)*.8))-R*.95+rip;",
  ],
  50: [
    "Hanging droplet (Young-Laplace)",
    "float rr=length(p.xy),h=prof(rr*rr/1.44);return max(rr-1.2,max(-p.z,p.z-h));",
  ],
  51: [
    "Electrowetting liquid lens",
    "float rr=length(p.xy),cv=uLiq;float sag=cv*rr*rr/(1.+sqrt(max(1.-cv*cv*rr*rr,.01)));return max(rr-1.,max(-p.z-.5,p.z+sag));",
  ],
  52: [
    "Spinning liquid mirror",
    "float rr=length(p.xy);return max(rr-1.2,abs(p.z+rr*rr*uLiq)-.03);",
  ],
  60: [
    "Concave mirror",
    "float R=mix(4.,1.4,c);return max(length(p.xy)-1.2,abs(length(p+vec3(0,0,R))-R)-.03);",
  ],
  61: [
    "Convex mirror",
    "float R=mix(4.,1.4,c);return max(length(p.xy)-1.2,abs(length(p-vec3(0,0,R))-R)-.03);",
  ],
  62: [
    "Parabolic mirror",
    "float rr=length(p.xy),K=mix(.05,.5,c);return max(rr-1.2,abs(p.z+K*rr*rr)-.03);",
  ],
  63: ["Ellipsoid mirror", "return max(p.z-.8,abs(length(p*vec3(1.,1.,.55))-1.2)-.03);"],
  64: [
    "Toroidal mirror",
    "float K=mix(.05,.5,c);return max(length(p.xy)-1.2,abs(p.z+K*p.x*p.x+.06*p.y*p.y)-.03);",
  ],
  65: [
    "Corner cube",
    "vec3 q=p-vec3(0,0,.55);float g=max(dot(q,vec3(.816,0.,.577)),max(dot(q,vec3(-.408,.707,.577)),dot(q,vec3(-.408,-.707,.577))));return max(-g,length(p)-1.5);",
  ],
  67: ["Glass cube", "return max(abs(p.x),max(abs(p.y),abs(p.z)))-mix(.5,1.,c);"],
  66: ["Flat mirror", "return max(length(p.xy)-1.7,abs(p.z)-.03);"],
  33: ["Graded fiber rod", "return max(length(p.xy)-.6,abs(p.z)-1.3);"],
  30: ["Luneburg", "return r-1.;"],
  31: ["Maxwell fisheye", "return r-1.;"],
  32: ["Eaton (hydrogen potential)", "return r-1.;"],
};
// Graded index bodies: n squared at p, with r clamped. k rescales by the Index slider.
export const GR = {
  30: "return (2.-r*r)*k+1.-k;",
  31: "return (4./pow(1.+r*r,2.))*k+1.-k;",
  32: "return max(2./r-1.,.02)*k+1.-k;",
  33: "return gNA*gNA*(1.-.5*uCurve*dot(p.xy,p.xy));",
};
export const GROUPS = [
  ["Classic", [0, 1, 2, 3, 8]],
  ["Round and hollow", [4, 5, 6, 7, 16]],
  ["Eye and nature", [9, 10, 11, 12, 13]],
  ["Crystal", [14, 15, 40, 67]],
  ["Solids of constant width", [45, 46, 44]],
  ["Knots", [47, 48]],
  ["Living forms", [41, 42, 43, 49]],
  ["Liquid", [50, 51, 52]],
  ["Mirror forms", [60, 61, 62, 63, 64, 65, 66]],
  ["Wave functions", [17, 18, 19, 20, 21, 26, 25]],
  ["Engineering charts", [22, 23, 24, 27, 28, 29]],
  ["Curved light", [30, 31, 32, 33]],
  ["Empty", ["none"]],
  ["Typed", ["F"]],
];
export function shapeBody(id, St) {
  if (id === "F") return St.formula ? St.formula.body : "return 1.;";
  return SH[id][1];
}
export function grinBody(St) {
  if (St.mat || St.inv) return null;
  if (St.shape === "F") return St.formula && St.formula.grin;
  return GR[St.shape] || null;
}
export function lensKey(St) {
  return [
    "L",
    St.shape,
    St.shape === "F" && St.formula ? St.formula.text : "",
    St.two ? St.shape2 : "",
    St.morphOn ? St.shapeM : "",
    St.scene,
    grinBody(St) ? 1 : 0,
    polOn(St) ? 1 : 0,
    St.pt ? 1 : 0,
    St.mat == 2 ? 1 : 0,
    St.inner || "",
    St.scatOn ? "S" + St.fRho + St.fAbs : "",
    St.trOn ? "T" + St.fTr : "",
    St.lensTex ? 1 : 0,
  ].join("|");
}
export const polOn = (St) => !!(St.polA || St.polP);
