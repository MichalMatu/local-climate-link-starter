import {
  LCL_HISTORY_DEFAULT_FLUSH_INTERVAL_SEC,
  LCL_HISTORY_DEFAULT_SAMPLE_INTERVAL_SEC,
  LCL_HISTORY_DEFAULT_SLOT_COUNT,
  LCL_HISTORY_FORMAT_VERSION,
  LCL_HISTORY_KVS_META_KEY,
  LCL_HISTORY_KVS_PREFIX,
  LCL_HISTORY_MAX_SLOT_COUNT,
  LCL_HISTORY_MAX_VALUE_CHARS,
  LCL_HISTORY_MIN_FLUSH_INTERVAL_SEC
} from '@lcl/automation-core';
import { compactGeneratedShellyScript } from './scriptText.js';

export const SHELLY_DATALOGGER_RUNTIME_VERSION = 'datalogger-v1';
export const SHELLY_DATALOGGER_SCRIPT_MAX_BYTES = 8_000;

export interface ShellyDataloggerConfig {
  sourceScriptId: number;
  sampleIntervalSec?: number | undefined;
  flushIntervalSec?: number | undefined;
  slotCount?: number | undefined;
}

const integerInRange = (value: number, minimum: number, maximum: number): boolean =>
  Number.isInteger(value) && value >= minimum && value <= maximum;

const normalizeDataloggerConfig = (input: ShellyDataloggerConfig) => {
  const sourceScriptId = input.sourceScriptId;
  const sampleIntervalSec = input.sampleIntervalSec ?? LCL_HISTORY_DEFAULT_SAMPLE_INTERVAL_SEC;
  const flushIntervalSec = input.flushIntervalSec ?? LCL_HISTORY_DEFAULT_FLUSH_INTERVAL_SEC;
  const slotCount = input.slotCount ?? LCL_HISTORY_DEFAULT_SLOT_COUNT;

  if (!integerInRange(sourceScriptId, 0, 255)) {
    throw new Error('Datalogger sourceScriptId must be an integer from 0 to 255.');
  }
  if (!integerInRange(sampleIntervalSec, 5 * 60, 24 * 60 * 60)) {
    throw new Error('Datalogger sample interval must be between 5 minutes and 24 hours.');
  }
  if (
    !integerInRange(flushIntervalSec, LCL_HISTORY_MIN_FLUSH_INTERVAL_SEC, 24 * 60 * 60) ||
    flushIntervalSec < sampleIntervalSec
  ) {
    throw new Error(
      'Datalogger flush interval must be at least 1 hour and not shorter than sampling.'
    );
  }
  if (!integerInRange(slotCount, 8, LCL_HISTORY_MAX_SLOT_COUNT)) {
    throw new Error(`Datalogger slot count must be between 8 and ${LCL_HISTORY_MAX_SLOT_COUNT}.`);
  }

  return { sourceScriptId, sampleIntervalSec, flushIntervalSec, slotCount };
};

export const generateShellyDataloggerScript = (input: ShellyDataloggerConfig): string => {
  const config = normalizeDataloggerConfig(input);
  const runtimeConfig = JSON.stringify({
    s: config.sourceScriptId,
    i: config.sampleIntervalSec,
    f: config.flushIntervalSec,
    n: config.slotCount,
    m: LCL_HISTORY_KVS_META_KEY,
    x: LCL_HISTORY_KVS_PREFIX
  });

  const body = `var C=${runtimeConfig};
var B=null,P=null,H=0,N=0,W=0,Q=0,F=0,E="";
function up(){return Math.floor(Shelly.getUptimeMs()/1000);}
function ky(i){return C.x+(i<10?"0":"")+i;}
function sc(v,m){return typeof v==="number"&&isFinite(v)?Math.round(v*m):null;}
function sm(d){if(!d||!Array.isArray(d.g)||!Array.isArray(d.y)||d.g.length<13)return null;var y=d.y,g=d.g,u=d.u,b,t;if(typeof y[1]==="number"&&y[1]>0){b=0;t=Math.floor(y[1]);}else if(typeof y[2]==="number"&&y[2]>=0){b=1;t=Math.floor(y[2]);}else return null;if(typeof g[5]!=="boolean")return null;var q=typeof g[6]==="string"?g[6].slice(0,16):null;var f=Array.isArray(u)&&typeof u[0]==="number"?Math.floor(u[0]):null;return{b:b,t:t,r:[sc(g[1],10),sc(g[2],10),sc(g[12],100),f,g[5]?1:0,q]};}
function nb(s){B=[${LCL_HISTORY_FORMAT_VERSION},N,s.b,s.t,[]];}
function nx(){if(P&&!W){var s=P;P=null;ad(s);}}
function fl(){if(W||!B||!B[4].length)return;var z=JSON.stringify(B);if(z.length>${LCL_HISTORY_MAX_VALUE_CHARS}){E="segment-too-large";return;}W=1;Shelly.call("KVS.Set",{key:ky(H),value:z},function(r,e){if(e){E="segment-write";W=0;return;}H=(H+1)%C.n;N++;B=null;F=up();var m=JSON.stringify([${LCL_HISTORY_FORMAT_VERSION},C.n,H,N,C.i,C.f]);Shelly.call("KVS.Set",{key:C.m,value:m},function(r2,e2){E=e2?"meta-write":"";W=0;nx();});});}
function ad(s){if(W){P=s;return;}if(!B)nb(s);if(B[2]!==s.b||s.t<B[3]){P=s;fl();return;}var r=[s.t-B[3],s.r[0],s.r[1],s.r[2],s.r[3],s.r[4],s.r[5]];B[4].push(r);if(JSON.stringify(B).length>${LCL_HISTORY_MAX_VALUE_CHARS}){B[4].pop();P=s;fl();}}
function pl(){if(Q||W)return;if(B&&up()-F>=C.f)fl();if(W)return;Q=1;Shelly.call("Script.Eval",{id:C.s,code:"diag()"},function(r,e){Q=0;if(e||!r||typeof r.result!=="string"){E="source-read";return;}var d;try{d=JSON.parse(r.result);}catch(x){E="source-json";return;}var s=sm(d);if(!s){E="source-shape";return;}E="";ad(s);if(B&&up()-F>=C.f)fl();});}
function im(v){try{var m=JSON.parse(v);if(Array.isArray(m)&&m.length===6&&m[0]===${LCL_HISTORY_FORMAT_VERSION}&&m[1]===C.n&&typeof m[2]==="number"&&m[2]>=0&&m[2]<C.n&&typeof m[3]==="number"&&m[3]>=0){H=Math.floor(m[2]);N=Math.floor(m[3]);}}catch(e){}}
function historyStatus(){return JSON.stringify({v:${LCL_HISTORY_FORMAT_VERSION},s:C.s,n:C.n,i:C.i,f:C.f,h:H,q:N,p:B?B[4].length:0,e:E});}
function go(){F=up();Timer.set(C.i*1000,true,pl);Timer.set(5000,false,pl);}
Shelly.call("KVS.Get",{key:C.m},function(r,e){if(!e&&r&&typeof r.value==="string")im(r.value);go();});`;

  const compactBody = compactGeneratedShellyScript(body);
  const script = `// LCL
// m: ${SHELLY_DATALOGGER_RUNTIME_VERSION}
${compactBody}
`;
  const scriptBytes = new TextEncoder().encode(script).length;
  if (scriptBytes > SHELLY_DATALOGGER_SCRIPT_MAX_BYTES) {
    throw new Error(
      `Generated Shelly datalogger script is ${scriptBytes} bytes; maximum is ${SHELLY_DATALOGGER_SCRIPT_MAX_BYTES}.`
    );
  }
  return script;
};
