import {
  LCL_HISTORY_DEFAULT_SLOT_COUNT,
  LCL_HISTORY_FORMAT_VERSION,
  LCL_HISTORY_KVS_META_KEY,
  LCL_HISTORY_KVS_PREFIX,
  LCL_HISTORY_MAX_SLOT_COUNT,
  LCL_HISTORY_MAX_VALUE_CHARS
} from '@lcl/automation-core';
import { compactGeneratedShellyScript } from './scriptText.js';

export const SHELLY_DATALOGGER_RUNTIME_VERSION = 'tail-v1';
export const SHELLY_DATALOGGER_SCRIPT_MAX_BYTES = 3_000;
export const SHELLY_DATALOGGER_DEFAULT_POLL_INTERVAL_SEC = 5 * 60;
export const SHELLY_DATALOGGER_DEFAULT_FLUSH_INTERVAL_SEC = 60 * 60;

export interface ShellyDataloggerConfig {
  sourceScriptId: number;
  pollIntervalSec?: number | undefined;
  flushIntervalSec?: number | undefined;
  slotCount?: number | undefined;
  temperatureDeltaC?: number | undefined;
  humidityDeltaPct?: number | undefined;
}

const integerInRange = (value: number, minimum: number, maximum: number): boolean =>
  Number.isInteger(value) && value >= minimum && value <= maximum;

const normalizeDataloggerConfig = (input: ShellyDataloggerConfig) => {
  const sourceScriptId = input.sourceScriptId;
  const pollIntervalSec = input.pollIntervalSec ?? SHELLY_DATALOGGER_DEFAULT_POLL_INTERVAL_SEC;
  const flushIntervalSec = input.flushIntervalSec ?? SHELLY_DATALOGGER_DEFAULT_FLUSH_INTERVAL_SEC;
  const slotCount = input.slotCount ?? LCL_HISTORY_DEFAULT_SLOT_COUNT;
  const temperatureDeltaC = input.temperatureDeltaC ?? 0.3;
  const humidityDeltaPct = input.humidityDeltaPct ?? 1;

  if (!integerInRange(sourceScriptId, 0, 255)) {
    throw new Error('Datalogger sourceScriptId must be an integer from 0 to 255.');
  }
  if (!integerInRange(pollIntervalSec, 60, 60 * 60)) {
    throw new Error('Datalogger poll interval must be between 1 minute and 1 hour.');
  }
  if (!integerInRange(flushIntervalSec, 60 * 60, 24 * 60 * 60)) {
    throw new Error('Datalogger flush interval must be between 1 hour and 24 hours.');
  }
  if (!integerInRange(slotCount, 8, LCL_HISTORY_MAX_SLOT_COUNT)) {
    throw new Error(`Datalogger slot count must be between 8 and ${LCL_HISTORY_MAX_SLOT_COUNT}.`);
  }
  if (!Number.isFinite(temperatureDeltaC) || temperatureDeltaC <= 0 || temperatureDeltaC > 10) {
    throw new Error('Datalogger temperature delta must be greater than 0 and at most 10 C.');
  }
  if (!Number.isFinite(humidityDeltaPct) || humidityDeltaPct <= 0 || humidityDeltaPct > 25) {
    throw new Error('Datalogger humidity delta must be greater than 0 and at most 25%.');
  }

  return {
    sourceScriptId,
    pollIntervalSec,
    flushIntervalSec,
    slotCount,
    temperatureDeltaDeciC: Math.max(1, Math.round(temperatureDeltaC * 10)),
    humidityDeltaDeciPct: Math.max(1, Math.round(humidityDeltaPct * 10))
  };
};

export const generateShellyDataloggerScript = (input: ShellyDataloggerConfig): string => {
  const config = normalizeDataloggerConfig(input);
  const runtimeConfig = JSON.stringify({
    s: config.sourceScriptId,
    p: config.pollIntervalSec,
    f: config.flushIntervalSec,
    n: config.slotCount,
    t: config.temperatureDeltaDeciC,
    h: config.humidityDeltaDeciPct,
    m: LCL_HISTORY_KVS_META_KEY,
    x: LCL_HISTORY_KVS_PREFIX
  });

  const body = `var C=${runtimeConfig};
var B=[],L=null,H=0,V=0,W=0,Q=0,F=0,A=0,P=null,E="";
function up(){return Math.floor(Shelly.getUptimeMs()/1000);}
function ky(i){return C.x+(i<10?"0":"")+i;}
function sc(v,m){return typeof v==="number"&&isFinite(v)?Math.round(v*m):null;}
function sm(d){if(!d||!Array.isArray(d.g)||d.g.length<6)return null;var g=d.g,p=d.p,o=Array.isArray(p)&&typeof p[0]==="boolean"?p[0]:g[5];if(typeof o!=="boolean")return null;return[sc(g[1],10),sc(g[2],10),o?1:0];}
function df(a,b,n){if(a===null||b===null)return a!==b;return Math.abs(a-b)>=n;}
function ch(s){return!L||L[2]!==s[2]||df(L[0],s[0],C.t)||df(L[1],s[1],C.h)||up()-A>=C.f;}
function nx(){if(P&&!W){var s=P;P=null;ad(s);}}
function fl(){if(W||!B.length)return;var z=JSON.stringify([${LCL_HISTORY_FORMAT_VERSION},B]);if(z.length>${LCL_HISTORY_MAX_VALUE_CHARS}){E="segment-too-large";return;}W=1;Shelly.call("KVS.Set",{key:ky(H),value:z},function(r,e){if(e){E="segment-write";W=0;return;}H=(H+1)%C.n;V=Math.min(V+1,C.n);B=[];F=up();var m=JSON.stringify([${LCL_HISTORY_FORMAT_VERSION},C.n,H,V]);Shelly.call("KVS.Set",{key:C.m,value:m},function(r2,e2){E=e2?"meta-write":"";W=0;nx();});});}
function ad(s){if(!ch(s))return;if(W){P=s;return;}B.push(s);if(JSON.stringify([${LCL_HISTORY_FORMAT_VERSION},B]).length>${LCL_HISTORY_MAX_VALUE_CHARS}){B.pop();P=s;fl();return;}L=s;A=up();if(A-F>=C.f)fl();}
function pl(){if(Q||W)return;Q=1;Shelly.call("Script.Eval",{id:C.s,code:"diag()"},function(r,e){Q=0;if(e||!r||typeof r.result!=="string"){E="source-read";return;}var d;try{d=JSON.parse(r.result);}catch(x){E="source-json";return;}var s=sm(d);if(!s){E="source-shape";return;}E="";ad(s);});}
function im(v){try{var m=JSON.parse(v);if(Array.isArray(m)&&m.length===4&&m[0]===${LCL_HISTORY_FORMAT_VERSION}&&m[1]===C.n&&typeof m[2]==="number"&&m[2]>=0&&m[2]<C.n&&typeof m[3]==="number"&&m[3]>=0&&m[3]<=C.n){H=Math.floor(m[2]);V=Math.floor(m[3]);}}catch(e){}}
function historyStatus(){return JSON.stringify({v:${LCL_HISTORY_FORMAT_VERSION},s:C.s,n:C.n,p:C.p,f:C.f,h:H,c:V,b:B.length,e:E});}
function go(){F=A=up();Timer.set(C.p*1000,true,pl);Timer.set(5000,false,pl);}
Shelly.call("KVS.Get",{key:C.m},function(r,e){if(!e&&r&&typeof r.value==="string")im(r.value);go();});`;

  const compactBody = compactGeneratedShellyScript(body);
  const script = `// LCL\n// m: ${SHELLY_DATALOGGER_RUNTIME_VERSION}\n${compactBody}\n`;
  const scriptBytes = new TextEncoder().encode(script).length;
  if (scriptBytes > SHELLY_DATALOGGER_SCRIPT_MAX_BYTES) {
    throw new Error(
      `Generated Shelly datalogger script is ${scriptBytes} bytes; maximum is ${SHELLY_DATALOGGER_SCRIPT_MAX_BYTES}.`
    );
  }
  return script;
};
