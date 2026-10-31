// SPDX-License-Identifier: FSL-1.1-MIT
export const VS = `#version 300 es
in vec2 a;void main(){gl_Position=vec4(a,0,1);}`;
export const VIEWS_DS = `#version 300 es
precision highp float;uniform sampler2D t,cx;uniform int uF,uDich;uniform float uSweep,uDmax,uNA;uniform vec2 uR;out vec4 o;
// Turbo false colour, polynomial fit after Mikhailov, Google, 2019.
vec3 turbo(float x){x=clamp(x,0.,1.);vec4 v4=vec4(1.,x,x*x,x*x*x);vec2 v2=v4.zw*v4.z;return vec3(dot(v4,vec4(.13572138,4.6153926,-42.66032258,132.13108234))+dot(v2,vec2(-152.94239396,59.28637943)),dot(v4,vec4(.09140261,2.19418839,4.84296658,-14.18503333))+dot(v2,vec2(4.27729857,2.82956604)),dot(v4,vec4(.1066733,12.64194608,-60.58204836,110.36276771))+dot(v2,vec2(-89.90310912,27.34824973)));}
const mat3 PROT=mat3(.152286,.114503,-.003882,1.052583,.786281,-.048116,-.204868,.099216,1.051998),DEUT=mat3(.367322,.280085,-.01182,.860646,.672501,.04294,-.227968,.047413,.968881),TRIT=mat3(1.255528,-.078411,.004733,-.076749,.930809,.691367,-.178779,.147602,.3039);
void main(){vec4 s=texelFetch(t,ivec2(gl_FragCoord.xy),0);vec3 c=s.rgb;
 if(uF==30){c=mat3(3.2406,-.9689,.0557,-1.5372,1.8758,-.204,-.4986,.0415,1.057)*c;if(uDich==1)c=PROT*c;if(uDich==2)c=DEUT*c;if(uDich==3)c=TRIT*c;c=max(c,vec3(0));}
 // Machado, Oliveira and Fernandes, 2009, severity 1.0, applied in linear RGB.
 if(uF==1)c=PROT*c;if(uF==2)c=DEUT*c;if(uF==3)c=TRIT*c;
 // Rods: scotopic luminance from XYZ after Larson, Rushmeier and Piatko, 1997. One channel, because rods carry no colour.
 if(uF==4){float X=dot(c,vec3(.4124,.3576,.1805)),Y=dot(c,vec3(.2126,.7152,.0722)),Z=dot(c,vec3(.0193,.1192,.9505));float V=Y*(1.33*(1.+(Y+Z)/max(X,1e-4))-1.68);c=vec3(max(V,0.))*.8;}
 if(uF>=10&&uF<=13)c=turbo(s.a/uDmax);
 if(uF==15){float a=s.a-uSweep;c=c*exp(-a*a/(.5*.5))*2.2+.03*turbo(s.a/uDmax);}
 // Heat study: warmth read from absorbed light; assumption stated in the readout.
 if(uF==16){float Y=dot(c,vec3(.2126,.7152,.0722));float T=Y/(1.+Y);c=vec3(pow(T,.5),pow(T,1.6),pow(T,4.)*.9+.25*sin(T*3.14)*.4);}
 if(uF==20){vec2 uv=(gl_FragCoord.xy-.5*uR)/uR.y;float rr=length(uv)+1e-3,th=atan(uv.y,uv.x);float x=log(rr/.01)/log(1./.01*.72);vec2 q=vec2(x,th/6.28318+.5);float a=texture(cx,q).r;vec3 pat=vec3(.5+a,.5+a*.7,.5-a*.2);c=mix(c,c*(1.+1.6*a)+max(a,0.)*vec3(.5,.42,.6)*.5,clamp(uNA,0.,1.));}
 c=c*(2.51*c+.03)/(c*(2.43*c+.59)+.14);o=vec4(pow(clamp(c,0.,1.),vec3(1./2.2)),1);}`;
