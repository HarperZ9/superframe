// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= Shader assembly
export const COMMON = `#version 300 es
precision highp float;precision highp int;
uniform vec2 uRes;uniform int uFrame,uMode,uHasImg,uBounces,uSteps,uMarch,uBis,uFour,uSix,uMask,uData,uSpec,uFlip;
uniform float uFov,uAp,uFocus;uniform vec2 uCrop;uniform mat3 uCamR;uniform vec3 uCam,uLam;uniform sampler2D uImg,uPrev;out vec4 o;
const float PI=3.14159265;
uint st;float rnd(){st=st*747796405u+2891336453u;uint w=((st>>((st>>28u)+4u))^st)*277803737u;return float((w>>22u)^w)/4294967296.;}
float gCh=1.;float gData=0.;float gEdge=1.;uniform float uFacet;uniform int uRemap;
`;
// Camera ray, with thin lens depth of field. One call site in each program.
// Compound eye: the whole view is sampled once per hexagonal facet, one ommatidium direction, with an acceptance a third of the pitch.
export const CAM = `void camRay(out vec3 ro,out vec3 rd){vec2 jit=vec2(rnd(),rnd())-.5;vec2 uv=(gl_FragCoord.xy+uCrop+jit-.5*uRes)/uRes.y;
 if(uFacet>0.){vec2 v=uv/uFacet,sz=vec2(1.,1.732),a=mod(v,sz)-.5*sz,b=mod(v-.5*sz,sz)-.5*sz,g=dot(a,a)<dot(b,b)?a:b;float e=max(abs(g.x),dot(abs(g),vec2(.5,.866)));gEdge=smoothstep(.5,.42,e);uv=(v-g+(vec2(rnd(),rnd())-.5)*.33)*uFacet;}
 rd=normalize(uCamR*vec3(uv*2.*tan(uFov*.5),1.));float a=rnd()*6.283,rr=sqrt(rnd())*uAp;vec3 off=uCamR*vec3(rr*cos(a),rr*sin(a),0);
 vec3 fp=uCam+rd*uFocus/max(dot(rd,uCamR[2]),.05);ro=uCam+off;rd=normalize(fp-ro);}`;
export const ACC = `void emit(vec3 c){vec4 pv=texelFetch(uPrev,ivec2(gl_FragCoord.xy),0);o=mix(pv,vec4(min(c,vec3(30.)),gData),1./float(uFrame+1));}`;
