import { GENERATOR_VERSION, normalizeConfig } from './config.js';
import { configHash, stableStringify } from './hash.js';
import {
  createShellyRuntimeConfig,
  SHELLY_RUNTIME_CONFIG_STORAGE_KEY
} from './runtimeConfig.js';
import { compactGeneratedShellyScript } from './scriptText.js';

export type ShellyScriptGeneratorMode = 'climate-engine-v1' | 'discovery-debug';

const COMPOSITE_MEASUREMENT_WINDOW_MS = 90_000;

const renderPersistentConfigLoader = (): string => `var E=0;
function vs(c){if(c.ss===undefined)return c.ag===undefined;if(!Array.isArray(c.ss)||c.ss.length<2||c.ss.length>8||typeof c.ag!="number"||c.ag<0||c.ag>3)return false;for(var i=0;i<c.ss.length;i++){var s=c.ss[i];if(!Array.isArray(s)||s.length!==3||typeof s[0]!="string"||typeof s[1]!="string"||(s[2]!==0&&s[2]!==1))return false;}return true;}
function vc(c){return c&&c.v===1&&(c.p===0||c.p===1)&&typeof c.a=="string"&&typeof c.fa=="string"&&typeof c.n=="string"&&typeof c.k=="string"&&typeof c.i=="number"&&c.i>=0&&typeof c.r=="number"&&c.r>=-100&&c.r<=-20&&typeof c.on=="number"&&typeof c.off=="number"&&(c.d===0||c.d===1)&&(c.m===0||c.m===1)&&typeof c.h=="number"&&c.h>=1&&c.h<=10&&typeof c.c=="number"&&c.c>0&&typeof c.s=="number"&&c.s>0&&typeof c.x=="number"&&c.x>0&&typeof c.vp=="number"&&c.vp>=0&&c.vp<=5&&(c.d?c.on>c.off:c.on<c.off)&&vs(c);}
function lc(d){if(typeof Script=="undefined"||!Script.storage||!Script.storage.getItem)return d;try{var x=Script.storage.getItem(${JSON.stringify(SHELLY_RUNTIME_CONFIG_STORAGE_KEY)});if(!x)return d;var c=JSON.parse(x);if(vc(c))return c;}catch(e){}E=1;return d;}
C=lc(C);`;

const renderThresholdHelper =
  (): string => `function cl(v,a,b){return Math.min(Math.max(v,a),b);}
function sv(t){return 0.6108*Math.exp((17.27*t)/(t+237.3));}
function vd(t,h){return t===null||h===null?null:sv(t)*(1-h/100);}
function vt(h){if(h===null||h>=100)return null;var f=1-h/100;if(f<=0)return null;var s=C.vp/f;if(s<=0)return null;var l=Math.log(s/0.6108);return l>=17.27?null:(237.3*l)/(17.27-l);}
function vh(t){if(t===null)return null;var s=sv(t);return s<=0?null:100*(1-C.vp/s);}
function th(t,h){if(!C.vp)return{o:C.on,f:C.off};var lo=Math.min(C.on,C.off),hi=Math.max(C.on,C.off),g=C.m?vh(t):vt(h);if(g===null)return{o:C.on,f:C.off};g=cl(g,lo,hi);var z=C.m?2:0.25;return C.d?{o:cl(g+z,lo,hi),f:cl(g-z,lo,hi)}:{o:cl(g-z,lo,hi),f:cl(g+z,lo,hi)};}`;

const renderRuntimeParser =
  (): string => `function lb(d){if(!d)return 0;if(typeof d==="string")return d.length;if(d.length!==undefined)return d.length;return 0;}
function rb(d,o){if(o<0||o>=lb(d))return null;var v=typeof d==="string"?d.charCodeAt(o):d[o];if(typeof v==="string")v=v.charCodeAt(0);return v===undefined||v===null?null:v&255;}
function sl(d,a,b){return typeof d==="string"?d.slice(a,b):d.slice?d.slice(a,b):null;}
function ad(d){var l=lb(d),o=0;while(o<l){var n=rb(d,o);if(!n)return null;var s=o+1,e=s+n;if(e>l)return null;if(rb(d,s)===22&&rb(d,s+1)===210&&rb(d,s+2)===252)return sl(d,s+3,e);o=e;}return null;}
function sd(x){return x.advData?ad(x.advData):null;}
function r2(d,o,s){var a=rb(d,o),b=rb(d,o+1);if(a===null||b===null)return null;var v=a|(b<<8);return s&&v&32768?v-65536:v;}
function pb(x,j){var d=sd(x);if(!d){R.ds="bm";return;}var t=null,h=null,b=null,o=1,l=lb(d),k,v;while(o<l){k=rb(d,o++);if(k==0)o++;else if(k==1)b=rb(d,o++);else if(k==12)o+=2;else if(k==2){v=r2(d,o,1);if(v==null){R.ds="bs";return;}t=v/100;o+=2;}else if(k==3){v=r2(d,o,0);if(v==null){R.ds="bs";return;}h=v/100;o+=2;}else if(k==46){h=rb(d,o++);if(h==null){R.ds="bs";return;}}else if(k==69){v=r2(d,o,1);if(v==null){R.ds="bs";return;}t=v/10;o+=2;}else{R.ds="bo";break;}}meas(t,h,b,x.rssi,j);}
function mf(d){var l=lb(d),o=0;while(o<l){var n=rb(d,o);if(n===null||n===0)return null;var s=o+1,e=s+n;if(e>l)return null;if(rb(d,s)===255&&n>=7)return s+1;o=e;}return null;}
function pt(x,j){var d=x.advData;if(!d){R.ds="ta";return;}var p=mf(d);if(p===null){R.ds="tm";return;}var lo=rb(d,p+1),hi=rb(d,p+2),h=rb(d,p+3),b=rb(d,p+4);if(lo===null||hi===null||h===null||b===null){R.ds="ts";return;}var raw=lo|(hi<<8);if(raw&32768)raw-=65536;var t=raw/10;if(h>100||t<-50||t>100){R.ds="tr";return;}meas(t,h,b,x.rssi,j);}
function parse(x,p,j){return p===1?pt(x,j):pb(x,j);}`;

const renderRuntimeState = (): string =>
  'var R={ls:null,l:0,t:null,h:null,tt:null,ht:null,b:null,r:null,on:false,rs:"boot",ds:"boot",lc:0,os:null,nh:0,fh:0,cv:null,vp:null,eo:null,ef:null,m:0,sa:0,u:[],fc:0};';

const renderMeasurementHelper = (): string => {
  const commonDecision =
    'R.ds="ok";var T=th(t,h);R.eo=T.o;R.ef=T.f;R.vp=C.vp?vd(t,h):null;var go=C.d?v>T.o:v<T.o,stop=C.d?v<T.f:v>T.f,gr=C.d?"ab":"bl",sr=C.d?"bl":"ab";if(go){R.nh++;R.fh=0;if(R.nh<C.h){sw(R.on,gr+"h",false);return;}sw(true,gr,false);return;}if(stop){R.fh++;R.nh=0;sw(false,sr,false);return;}R.nh=0;R.fh=0;sw(R.on,"ib",false);';

  return `function fr(x,n){return x!==null&&n-x<=Math.min(${COMPOSITE_MEASUREMENT_WINDOW_MS},C.s);}
function av(v,t,n){var z=[],q,u,i;for(i=0;i<R.u.length;i++){u=R.u[i];if(u&&fr(u[t],n)&&u[v]!=null)z.push(u[v]);}R.fc=z.length;if(!z.length)return null;if(C.ag===3||C.ag===undefined)return z[0];q=z[0];if(C.ag===1){for(i=1;i<z.length;i++)q=Math.min(q,z[i]);return q;}if(C.ag===2){for(i=1;i<z.length;i++)q=Math.max(q,z[i]);return q;}q=0;for(i=0;i<z.length;i++)q+=z[i];return q/z.length;}
function meas(t,h,b,r,j){var n=nw(),u=R.u[j],p=t!=null||h!=null;R.r=r;if(b!=null)R.b=b;if(!p){R.ds="cv";return;}if(!u){u=[null,null,null,null,null,null,null];R.u[j]=u;}u[5]=r;u[6]=C.ss?C.ss[j][0]:C.a;if(b!=null)u[4]=b;if(t!=null){u[0]=t;u[2]=n;}if(h!=null){u[1]=h;u[3]=n;}var tf=av(0,2,n),hf=av(1,3,n),v=C.m?hf:tf;R.t=tf;R.h=hf;R.tt=n;R.ht=n;R.cv=v;if(C.vp){if(v==null||tf==null||hf==null){R.ds="cv";return;}t=tf;h=hf;}else{if(v==null){R.ds="cv";return;}t=tf;h=hf;}R.ls=n;${commonDecision}}`;
};

export const generateShellyThermostatScript = (input: unknown): string => {
  const config = normalizeConfig(input);
  const mode: ShellyScriptGeneratorMode = 'climate-engine-v1';
  const hash = configHash(config);
  const cfgJson = stableStringify(createShellyRuntimeConfig(config, hash));
  const body = `var C=${cfgJson};
${renderPersistentConfigLoader()}
${renderRuntimeState()}
function nw(){return Shelly.getUptimeMs();}
function na(a){if(a===undefined||a===null)return"";var s=String(a).toUpperCase(),o="";for(var i=0;i<s.length;i++){var c=s.charAt(i);if(c!==":"&&c!=="-")o+=c;}return o;}
function fv(o,k){return o&&o[k]!==undefined?o[k]:null;}
function s(o,c){Shelly.call("Switch.Set",{id:C.i,on:o},c)}
function sw(o,q,f){if(R.m)return;var n=nw(),c=R.on!=o;if(o&&!f&&c&&n-R.lc<C.c){R.rs="mc";return;}s(o,function(r,e){if(R.m)return s(false);if(e){R.rs="se";s(false);R.on=false;return;}R.on=o;R.rs=q;if(c)R.lc=n;R.os=o?n:null;});}
function stale(){var n=nw();if(R.ls===null||n-R.ls>C.s){R.ds="st";R.nh=0;R.fh=0;sw(false,"st",true);return;}if(R.on&&R.os!==null&&n-R.os>=C.x){R.nh=0;R.fh=0;sw(false,"mx",true);}}
${renderThresholdHelper()}
${renderMeasurementHelper()}
${renderRuntimeParser()}
function pd(){var n=nw(),s=C.ss,a=[],i,u,x,l,f;for(i=0;i<(s?s.length:1);i++){x=s?s[i][0]:C.a;u=R.u[i];if(!u||u[6]!==x){a.push([x,null,null,null,null,null,0]);continue;}l=u[2];if(u[3]!==null&&(l===null||u[3]>l))l=u[3];f=C.vp?fr(u[2],n)&&fr(u[3],n):fr(C.m?u[3]:u[2],n);a.push([x,u[0],u[1],u[4],u[5],l,f?1:0]);}return a;}
function diag(){var y=Shelly.getComponentStatus("sys"),w=Shelly.getComponentStatus("switch:0");return JSON.stringify({v:C.v,z:C.k,s:[C.fa,C.n],q:[C.m,C.d,C.on,C.off,C.s/1000,C.r],y:y?[y.time||null,y.unixtime||null,y.uptime||null]:null,p:w?[!!w.output,fv(w,"apower"),fv(w,"voltage"),fv(w,"current"),w.aenergy?fv(w.aenergy,"total"):null,w.temperature?fv(w.temperature,"tC"):null]:null,g:[R.ls,R.t,R.h,R.b,R.r,R.on,R.rs,R.lc,R.os,R.nh,R.fh,R.cv,R.vp,R.eo,R.ef,R.l,R.ds],d:pd(),u:[R.fc,C.ss?C.ss.length:1,C.ag===undefined?3:C.ag]});}
if(typeof HTTPServer!=="undefined"&&HTTPServer.registerEndpoint){HTTPServer.registerEndpoint("diag",function(q,p){p.code=200;p.headers=[["Content-Type","application/json"]];p.body=diag();p.send();});}
function ix(a){var z=na(a),s=C.ss;if(!s)return z===C.a?0:-1;for(var i=0;i<s.length;i++)if(z===s[i][0])return i;return-1;}
function ev(e,x){if(e!==BLE.Scanner.SCAN_RESULT||!x)return;var j=ix(x.addr);if(j<0)return;R.l=nw();if(x.rssi!==undefined&&x.rssi<C.r){R.r=x.rssi;R.ds="rl";return;}var p=C.ss?C.ss[j][2]:C.p;parse(x,p,j);}
var bt=BLE.Scanner.stop||BLE.Scanner.Stop;
function bs(){if(bt)bt.call(BLE.Scanner);R.sa=nw();var f=BLE.Scanner.start||BLE.Scanner.Start;if(!f||f.call(BLE.Scanner,{duration_ms:-1,active:false,interval_ms:241,window_ms:61,rssi_thr:0})==null)sw(false,"bf",true);}
function bw(){if(R.sa&&nw()-(R.l||R.sa)>9e4)bs();}
if(E){R.ds="cf";sw(false,"cf",true);}else{sw(false,"b",true);BLE.Scanner.subscribe(function(e,x){ev(e,x);});Timer.set(1000,false,bs);Timer.set(30000,true,function(){stale();bw();});}`;
  const compactBody = compactGeneratedShellyScript(body);

  return `// LCL
// g: ${GENERATOR_VERSION}
// m: ${mode}
// h: ${hash}
${compactBody}
`;
};

export { generateShellyBleDiscoveryScript } from './discovery.js';
