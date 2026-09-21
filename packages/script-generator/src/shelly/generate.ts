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
function vc(c){return c&&c.v===1&&(c.p===0||c.p===1)&&typeof c.a==="string"&&typeof c.fa==="string"&&typeof c.n==="string"&&typeof c.k==="string"&&typeof c.i==="number"&&c.i>=0&&typeof c.r==="number"&&c.r>=-100&&c.r<=-20&&typeof c.on==="number"&&typeof c.off==="number"&&(c.d===0||c.d===1)&&(c.m===0||c.m===1)&&typeof c.h==="number"&&c.h>=1&&c.h<=10&&typeof c.c==="number"&&c.c>0&&typeof c.s==="number"&&c.s>0&&typeof c.x==="number"&&c.x>0&&typeof c.vp==="number"&&c.vp>=0&&c.vp<=5&&(c.d?c.on>c.off:c.on<c.off);}
function lc(d){if(typeof Script==="undefined"||!Script.storage||!Script.storage.getItem)return d;try{var x=Script.storage.getItem(${JSON.stringify(SHELLY_RUNTIME_CONFIG_STORAGE_KEY)});if(x===null||x==="")return d;var c=JSON.parse(x);if(vc(c))return c;}catch(e){}E=1;return d;}
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
function pb(x){var d=sd(x);if(!d){R.ds="bm";return;}var t=null,h=null,b=null,o=1,l=lb(d),k,v;while(o<l){k=rb(d,o++);if(k==0)o++;else if(k==1)b=rb(d,o++);else if(k==12)o+=2;else if(k==2){v=r2(d,o,1);if(v==null){R.ds="bs";return;}t=v/100;o+=2;}else if(k==3){v=r2(d,o,0);if(v==null){R.ds="bs";return;}h=v/100;o+=2;}else if(k==46){h=rb(d,o++);if(h==null){R.ds="bs";return;}}else if(k==69){v=r2(d,o,1);if(v==null){R.ds="bs";return;}t=v/10;o+=2;}else{R.ds="bo";break;}}meas(t,h,b,x.rssi);}
function mf(d){var l=lb(d),o=0;while(o<l){var n=rb(d,o);if(n===null||n===0)return null;var s=o+1,e=s+n;if(e>l)return null;if(rb(d,s)===255&&n>=7)return s+1;o=e;}return null;}
function pt(x){var d=x.advData;if(!d){R.ds="ta";return;}var p=mf(d);if(p===null){R.ds="tm";return;}var lo=rb(d,p+1),hi=rb(d,p+2),h=rb(d,p+3),b=rb(d,p+4);if(lo===null||hi===null||h===null||b===null){R.ds="ts";return;}var raw=lo|(hi<<8);if(raw&32768)raw-=65536;var t=raw/10;if(h>100||t<-50||t>100){R.ds="tr";return;}meas(t,h,b,x.rssi);}
function parse(x){return C.p===1?pt(x):pb(x);}`;

const renderRuntimeState = (): string =>
  'var R={ls:null,l:0,t:null,h:null,tt:null,ht:null,b:null,r:null,on:false,rs:"boot",ds:"boot",lc:0,os:null,nh:0,fh:0,cv:null,vp:null,eo:null,ef:null,m:0,sa:0};';

const renderMeasurementHelper = (): string => {
  const commonDecision =
    'R.ds="ok";var T=th(t,h);R.eo=T.o;R.ef=T.f;R.vp=C.vp?vd(t,h):null;var go=C.d?v>T.o:v<T.o,stop=C.d?v<T.f:v>T.f,gr=C.d?"ab":"bl",sr=C.d?"bl":"ab";if(go){R.nh++;R.fh=0;if(R.nh<C.h){sw(R.on,gr+"h",false);return;}sw(true,gr,false);return;}if(stop){R.fh++;R.nh=0;sw(false,sr,false);return;}R.nh=0;R.fh=0;sw(R.on,"ib",false);';

  return `function fr(x,n){return x!==null&&n-x<=Math.min(${COMPOSITE_MEASUREMENT_WINDOW_MS},C.s);}
function meas(t,h,b,r){var n=nw(),p=t!=null||h!=null,ct=C.m?h:t;R.r=r;if(b!=null)R.b=b;if(t!=null){R.t=t;R.tt=n;}if(h!=null){R.h=h;R.ht=n;}if(!p){R.ds="cv";return;}var tf=fr(R.tt,n)?R.t:null,hf=fr(R.ht,n)?R.h:null,v=C.m?hf:tf;R.cv=v;if(C.vp){if(v==null||tf==null||hf==null){R.ds="cv";return;}t=tf;h=hf;}else{if(ct==null){R.ds=v==null?"cv":"pt";return;}if(v==null){R.ds="cv";return;}t=tf;h=hf;}R.ls=n;${commonDecision}}`;
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
function diag(){var y=Shelly.getComponentStatus("sys"),w=Shelly.getComponentStatus("switch:0");return JSON.stringify({v:C.v,z:C.k,s:[C.fa,C.n],q:[C.m,C.d,C.on,C.off,C.s/1000,C.r],y:y?[y.time||null,y.unixtime||null,y.uptime||null]:null,p:w?[!!w.output,fv(w,"apower"),fv(w,"voltage"),fv(w,"current"),w.aenergy?fv(w.aenergy,"total"):null,w.temperature?fv(w.temperature,"tC"):null]:null,g:[R.ls,R.t,R.h,R.b,R.r,R.on,R.rs,R.lc,R.os,R.nh,R.fh,R.cv,R.vp,R.eo,R.ef,R.l,R.ds]});}
if(typeof HTTPServer!=="undefined"&&HTTPServer.registerEndpoint){HTTPServer.registerEndpoint("diag",function(q,p){p.code=200;p.headers=[["Content-Type","application/json"]];p.body=diag();p.send();});}
function ev(e,x){if(e!==BLE.Scanner.SCAN_RESULT||!x)return;if(na(x.addr)!==C.a)return;R.l=nw();if(x.rssi!==undefined&&x.rssi<C.r){R.r=x.rssi;R.ds="rl";return;}parse(x);}
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
