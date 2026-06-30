import { GENERATOR_VERSION, normalizeConfig } from './config.js';
import type { ShellyThermostatConfig } from './config.js';
import { configHash, stableStringify } from './hash.js';

export type ShellyScriptGeneratorMode =
  'xiaomi-bthome-minimal' | 'tp357-minimal' | 'discovery-debug';

const compactGeneratedShellyScript = (script: string): string =>
  script.replace(/\n\s*/g, '');

const compactAddress = (address: string): string =>
  address.replace(/[:-]/g, '').toUpperCase();

const runtimeModeForConfig = (
  config: ShellyThermostatConfig
): Exclude<ShellyScriptGeneratorMode, 'discovery-debug'> =>
  config.sensor.profileId === 'tp357_custom_v1'
    ? 'tp357-minimal'
    : 'xiaomi-bthome-minimal';

const createRuntimeConfig = (config: ShellyThermostatConfig, hash: string) => ({
  a: compactAddress(config.sensor.runtimeAddress),
  fa: config.sensor.runtimeAddress,
  n: config.sensor.displayName,
  k: hash,
  i: config.output.relayId,
  r: config.rule.rssiMin,
  on: config.rule.control.onThreshold,
  off: config.rule.control.offThreshold,
  d: config.rule.control.direction === 'above' ? 1 : 0,
  m: config.rule.control.metric === 'humidity' ? 1 : 0,
  h: config.rule.consecutiveHits,
  c: config.rule.minChangeMs,
  s: config.rule.staleTimeoutSec * 1000,
  x: config.rule.maxOnMs,
  v: config.version,
  vp: config.rule.vpdAssist.enabled ? config.rule.vpdAssist.targetKpa : 0
});

const renderThresholdHelper = (config: ShellyThermostatConfig): string => {
  if (!config.rule.vpdAssist.enabled) {
    return 'function th(t,h){return{o:C.on,f:C.off};}';
  }

  return `function cl(v,a,b){return Math.min(Math.max(v,a),b);}
function sv(t){return 0.6108*Math.exp((17.27*t)/(t+237.3));}
function vd(t,h){return t===null||h===null?null:sv(t)*(1-h/100);}
function vt(h){if(h===null||h>=100)return null;var f=1-h/100;if(f<=0)return null;var s=C.vp/f;if(s<=0)return null;var l=Math.log(s/0.6108);return l>=17.27?null:(237.3*l)/(17.27-l);}
function vh(t){if(t===null)return null;var s=sv(t);return s<=0?null:100*(1-C.vp/s);}
function th(t,h){var lo=Math.min(C.on,C.off),hi=Math.max(C.on,C.off),g=C.m?vh(t):vt(h);if(g===null)return{o:C.on,f:C.off};g=cl(g,lo,hi);var z=C.m?2:0.25;return C.d?{o:cl(g+z,lo,hi),f:cl(g-z,lo,hi)}:{o:cl(g-z,lo,hi),f:cl(g+z,lo,hi)};}`;
};

const renderBthomeMinimalParser =
  (): string => `function lb(d){if(!d)return 0;if(typeof d==="string")return d.length;if(d.length!==undefined)return d.length;return 0;}
function rb(d,o){if(o<0||o>=lb(d))return null;var v=typeof d==="string"?d.charCodeAt(o):d[o];if(typeof v==="string")v=v.charCodeAt(0);return v===undefined||v===null?null:v&255;}
function sl(d,a,b){return typeof d==="string"?d.slice(a,b):d.slice?d.slice(a,b):null;}
function ad(d){var l=lb(d),o=0;while(o<l){var n=rb(d,o);if(!n)return null;var s=o+1,e=s+n;if(e>l)return null;if(rb(d,s)===22&&rb(d,s+1)===210&&rb(d,s+2)===252)return sl(d,s+3,e);o=e;}return null;}
function sd(x){return x.advData?ad(x.advData):null;}
function r2(d,o,s){var a=rb(d,o),b=rb(d,o+1);if(a===null||b===null)return null;var v=a|(b<<8);return s&&v&32768?v-65536:v;}
function parse(x){var d=sd(x);if(!d){R.rs="bm";return;}var t=null,h=null,b=null,o=1,l=lb(d);while(o<l){var k=rb(d,o++);if(k===0){o++;}else if(k===1){b=rb(d,o++);}else if(k===2){var tv=r2(d,o,1);if(tv===null){R.rs="bs";return;}t=tv/100;o+=2;}else if(k===3){var hv=r2(d,o,0);if(hv===null){R.rs="bs";return;}h=hv/100;o+=2;}else{R.rs="bo";break;}}meas(t,h,b,x.rssi);}`;

const renderTp357MinimalParser =
  (): string => `function lb(d){if(!d)return 0;if(typeof d==="string")return d.length;if(d.length!==undefined)return d.length;return 0;}
function rb(d,o){if(o<0||o>=lb(d))return null;var v=typeof d==="string"?d.charCodeAt(o):d[o];if(typeof v==="string")v=v.charCodeAt(0);return v===undefined||v===null?null:v&255;}
function mf(d){var l=lb(d),o=0;while(o<l){var n=rb(d,o);if(n===null||n===0)return null;var s=o+1,e=s+n;if(e>l)return null;if(rb(d,s)===255&&n>=7)return s+1;o=e;}return null;}
function parse(x){var d=x.advData;if(!d){R.rs="ta";return;}var p=mf(d);if(p===null){R.rs="tm";return;}var lo=rb(d,p+1),hi=rb(d,p+2),h=rb(d,p+3),b=rb(d,p+4);if(lo===null||hi===null||h===null||b===null){R.rs="ts";return;}var raw=lo|(hi<<8);if(raw&32768)raw-=65536;var t=raw/10;if(h>100||t<-50||t>100){R.rs="tr";return;}meas(t,h,b,x.rssi);}`;

const renderRuntimeParser = (config: ShellyThermostatConfig): string =>
  config.sensor.profileId === 'tp357_custom_v1'
    ? renderTp357MinimalParser()
    : renderBthomeMinimalParser();

export const generateShellyThermostatScript = (input: unknown): string => {
  const config = normalizeConfig(input);
  const mode = runtimeModeForConfig(config);
  const hash = configHash(config);
  const cfgJson = stableStringify(createRuntimeConfig(config, hash));
  const body = `var C=${cfgJson};
var R={ls:null,t:null,h:null,b:null,r:null,on:false,rs:"boot",lc:0,os:null,nh:0,fh:0,cv:null,vp:null,eo:null,ef:null,sa:0};
function na(a){if(a===undefined||a===null)return"";var s=String(a).toUpperCase(),o="";for(var i=0;i<s.length;i++){var c=s.charAt(i);if(c!==":"&&c!=="-")o+=c;}return o;}
function fv(o,k){return o&&o[k]!==undefined?o[k]:null;}
function sw(o,rs,f){var n=Date.now(),ch=R.on!==o;if(!f&&!ch){R.rs=rs;return;}if(!f&&n-R.lc<C.c){R.rs="mc";return;}Shelly.call("Switch.Set",{id:C.i,on:o},function(r,e){if(e!==0){R.rs="se";Shelly.call("Switch.Set",{id:C.i,on:false});R.on=false;return;}R.on=o;R.rs=rs;if(ch)R.lc=n;R.os=o?n:null;});}
function stale(){var n=Date.now();if(R.ls===null||n-R.ls>C.s){R.nh=0;R.fh=0;sw(false,"st",true);return;}if(R.on&&R.os!==null&&n-R.os>=C.x){R.nh=0;R.fh=0;sw(false,"mx",true);}}
${renderThresholdHelper(config)}
function meas(t,h,b,r){var v=C.m?h:t;R.r=r;R.cv=v;if(v==null){R.rs="cv";return;}R.ls=Date.now();R.t=t;R.h=h;R.b=b;var T=th(t,h);R.eo=T.o;R.ef=T.f;R.vp=C.vp?vd(t,h):null;var go=C.d?v>T.o:v<T.o,stop=C.d?v<T.f:v>T.f,gr=C.d?"ab":"bl",sr=C.d?"bl":"ab";if(go){R.nh++;R.fh=0;if(R.nh<C.h){R.rs=gr+"h";return;}sw(true,gr,false);return;}if(stop){R.fh++;R.nh=0;if(R.fh<C.h){R.rs=sr+"h";return;}sw(false,sr,false);return;}R.nh=0;R.fh=0;R.rs="ib";}
${renderRuntimeParser(config)}
function diag(){var y=Shelly.getComponentStatus("sys"),w=Shelly.getComponentStatus("switch:0");return JSON.stringify({v:C.v,z:C.k,s:[C.fa,C.n],q:[C.m,C.d,C.on,C.off,C.s/1000,C.r],y:y?[y.time||null,y.unixtime||null,y.uptime||null]:null,p:w?[w.output===true,fv(w,"apower"),fv(w,"voltage"),fv(w,"current"),w.aenergy?fv(w.aenergy,"total"):null,w.temperature?fv(w.temperature,"tC"):null]:null,g:[R.ls,R.t,R.h,R.b,R.r,R.on,R.rs,R.lc,R.os,R.nh,R.fh,R.cv,R.vp,R.eo,R.ef]});}
if(typeof HTTPServer!=="undefined"&&HTTPServer.registerEndpoint){HTTPServer.registerEndpoint("diag",function(q,p){p.code=200;p.headers=[["Content-Type","application/json"]];p.body=diag();p.send();});}
function ev(e,x){if(e!==BLE.Scanner.SCAN_RESULT||!x)return;if(na(x.addr)!==C.a)return;if(x.rssi!==undefined&&x.rssi<C.r){R.r=x.rssi;R.rs="rl";return;}parse(x);}
sw(false,"b",true);
var bt=BLE.Scanner.stop||BLE.Scanner.Stop;
BLE.Scanner.subscribe(function(e,x){ev(e,x);});
function bs(){if(bt)bt.call(BLE.Scanner);R.sa=Date.now();var f=BLE.Scanner.start||BLE.Scanner.Start;if(!f||f.call(BLE.Scanner,{duration_ms:-1,active:false,interval_ms:241,window_ms:61,rssi_thr:0})==null)sw(false,"bf",true);}
function bw(){if(R.sa&&Date.now()-(R.ls||R.sa)>9e4)bs();}
Timer.set(1000,false,bs);Timer.set(30000,true,function(){stale();bw();});`;
  const compactBody = compactGeneratedShellyScript(body);

  return `// LCL
// g: ${GENERATOR_VERSION}
// m: ${mode}
// h: ${hash}
${compactBody}
`;
};

export const generateShellyBleDiscoveryScript = (): string => {
  const body = `var D={v:1,r:false,sa:null,so:null,lr:"boot",c:{},n:0};

function normalizeAddress(address) {
  if (address === undefined || address === null) {
    return "";
  }
  var text = String(address).toUpperCase();
  var normalized = "";
  for (var index = 0; index < text.length; index += 1) {
    var character = text.charAt(index);
    if (character !== ":" && character !== "-") {
      normalized += character;
    }
  }
  return normalized;
}

function formatRuntimeAddress(address) {
  var normalized = normalizeAddress(address);
  if (normalized.length !== 12) {
    return String(address || "");
  }
  return normalized.slice(0, 2) + ":" + normalized.slice(2, 4) + ":" + normalized.slice(4, 6) + ":" + normalized.slice(6, 8) + ":" + normalized.slice(8, 10) + ":" + normalized.slice(10, 12);
}

function dataLength(data) {
  if (!data) {
    return 0;
  }
  if (typeof data === "string") {
    return data.length;
  }
  if (data.length !== undefined) {
    return data.length;
  }
  return 0;
}

function readByte(data, offset) {
  if (offset < 0 || offset >= dataLength(data)) {
    return null;
  }
  var value = typeof data === "string" ? data.charCodeAt(offset) : data[offset];
  if (typeof value === "string") {
    value = value.charCodeAt(0);
  }
  if (value === undefined || value === null) {
    return null;
  }
  return value & 255;
}

function ds(data, start, end) {
  if (typeof data === "string") {
    return data.slice(start, end);
  }
  if (data.slice) {
    return data.slice(start, end);
  }
  return null;
}

function i2(data, offset) {
  var low = readByte(data, offset);
  var high = readByte(data, offset + 1);
  if (low === null || high === null) {
    return null;
  }
  var value = low | (high << 8);
  return value & 32768 ? value - 65536 : value;
}

function advDataHasNamePrefix(data, prefix) {
  var length = dataLength(data);
  var offset = 0;
  while (offset < length) {
    var fieldLength = readByte(data, offset);
    if (fieldLength === null || fieldLength === 0) {
      return false;
    }
    var fieldStart = offset + 1;
    var fieldEnd = fieldStart + fieldLength;
    if (fieldEnd > length) {
      return false;
    }
    var type = readByte(data, fieldStart);
    var dataLengthInField = fieldLength - 1;
    if ((type === 8 || type === 9) && dataLengthInField >= prefix.length) {
      var matches = true;
      for (var index = 0; index < prefix.length; index += 1) {
        if (readByte(data, fieldStart + 1 + index) !== prefix.charCodeAt(index)) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return true;
      }
    }
    offset = fieldEnd;
  }
  return false;
}

function bd(data) {
  var length = dataLength(data);
  var offset = 0;
  while (offset < length) {
    var fieldLength = readByte(data, offset);
    if (fieldLength === null || fieldLength === 0) {
      return false;
    }
    var fieldStart = offset + 1;
    var fieldEnd = fieldStart + fieldLength;
    if (fieldEnd > length) {
      return false;
    }
    var type = readByte(data, fieldStart);
    if (type === 22 && fieldLength >= 3) {
      if (readByte(data, fieldStart + 1) === 210 && readByte(data, fieldStart + 2) === 252) {
        return ds(data, fieldStart + 3, fieldEnd);
      }
    }
    offset = fieldEnd;
  }
  return null;
}

function findManufacturerDataRange(data) {
  var length = dataLength(data);
  var offset = 0;
  while (offset < length) {
    var fieldLength = readByte(data, offset);
    if (fieldLength === null || fieldLength === 0) {
      return null;
    }
    var fieldStart = offset + 1;
    var fieldEnd = fieldStart + fieldLength;
    if (fieldEnd > length) {
      return null;
    }
    var type = readByte(data, fieldStart);
    if (type === 255 && fieldLength >= 2) {
      return { offset: fieldStart + 1, length: fieldLength - 1 };
    }
    offset = fieldEnd;
  }
  return null;
}

function parseTp357Payload(data, offset, length) {
  if (length < 6) {
    return { ok: false, reason: "tp357-payload-too-short" };
  }
  var temperatureLow = readByte(data, offset + 1);
  var temperatureHigh = readByte(data, offset + 2);
  var humidity = readByte(data, offset + 3);
  var battery = readByte(data, offset + 4);
  if (temperatureLow === null || temperatureHigh === null || humidity === null || battery === null) {
    return { ok: false, reason: "tp357-payload-truncated" };
  }
  var temperatureRaw = temperatureLow | (temperatureHigh << 8);
  if (temperatureRaw & 32768) {
    temperatureRaw = temperatureRaw - 65536;
  }
  var temperature = temperatureRaw / 10;
  if (humidity > 100 || temperature < -50 || temperature > 100) {
    return { ok: false, reason: "tp357-range-invalid" };
  }
  return { ok: true, temperature: temperature, humidity: humidity, battery: battery };
}

function btd(result) {
  if (!result) {
    return null;
  }
  if (result.service_data) {
    if (result.service_data.fcd2 !== undefined) {
      return result.service_data.fcd2;
    }
    if (result.service_data.FCD2 !== undefined) {
      return result.service_data.FCD2;
    }
  }
  if (result.advData) {
    return bd(result.advData);
  }
  return null;
}

function pbt(data) {
  var length = dataLength(data);
  if (length < 2) {
    return {};
  }
  var info = readByte(data, 0);
  if (info === null || (info & 1) === 1 || info >> 5 !== 2) {
    return {};
  }
  var candidate = {};
  var offset = 1;
  while (offset < length) {
    var objectId = readByte(data, offset);
    offset += 1;
    if (objectId === 0) {
      offset += 1;
    } else if (objectId === 1) {
      candidate.b = readByte(data, offset);
      offset += 1;
    } else if (objectId === 12) {
      offset += 2;
    } else if (objectId === 2) {
      var temperature = i2(data, offset);
      if (temperature === null) {
        return candidate;
      }
      candidate.t = temperature / 100;
      offset += 2;
    } else if (objectId === 3) {
      var humidity = readByte(data, offset);
      var humidityHigh = readByte(data, offset + 1);
      if (humidity === null || humidityHigh === null) {
        return candidate;
      }
      candidate.h = (humidity | (humidityHigh << 8)) / 100;
      offset += 2;
    } else if (objectId === 46) {
      var shortHumidity = readByte(data, offset);
      if (shortHumidity === null) {
        return candidate;
      }
      candidate.h = shortHumidity;
      offset += 1;
    } else if (objectId === 69) {
      var shortTemperature = i2(data, offset);
      if (shortTemperature === null) {
        return candidate;
      }
      candidate.t = shortTemperature / 10;
      offset += 2;
    } else {
      return candidate;
    }
  }
  return candidate;
}

function cp(item, previous, candidate, field) {
  if (candidate[field] !== undefined && candidate[field] !== null) {
    item[field] = candidate[field];
  } else if (previous[field] !== undefined && previous[field] !== null) {
    item[field] = previous[field];
  }
}

function candidateList() {
  var items = [];
  for (var key in D.c) {
    if (D.c.hasOwnProperty(key)) {
      items.push(D.c[key]);
    }
  }
  return items;
}

function upsertCandidate(result, candidate) {
  var runtimeAddress = formatRuntimeAddress(result.addr);
  var key = normalizeAddress(runtimeAddress);
  if (key.length === 0) {
    D.lr = "candidate-address-missing";
    return;
  }
  if (!D.c[key]) {
    if (D.n >= 4) {
      D.lr = "candidate-limit-reached";
      return;
    }
    D.n += 1;
  }
  var previous = D.c[key] || {};
  var item = {
    a: runtimeAddress,
    p: candidate.p,
    r: result.rssi,
    s: Date.now()
  };
  cp(item, previous, candidate, "t");
  cp(item, previous, candidate, "h");
  D.c[key] = item;
  D.lr = "candidate-updated";
}

function handleBthomeDiscovery(result) {
  var payload = btd(result);
  if (!payload) {
    return false;
  }
  var parsed = pbt(payload);
  upsertCandidate(result, {
    p: "x",
    t: parsed.t,
    h: parsed.h
  });
  return true;
}

function handleTp357Discovery(result) {
  if (!result.advData || !advDataHasNamePrefix(result.advData, "TP357")) {
    return false;
  }
  var range = findManufacturerDataRange(result.advData);
  if (!range) {
    return false;
  }
  var parsed = parseTp357Payload(result.advData, range.offset, range.length);
  if (!parsed.ok) {
    D.lr = parsed.reason;
    return false;
  }
  upsertCandidate(result, {
    p: "t",
    t: parsed.temperature,
    h: parsed.humidity
  });
  return true;
}

function registerDiscoveryEndpoint() {
  if (typeof HTTPServer === "undefined" || !HTTPServer.registerEndpoint) {
    D.lr = "httpserver-missing";
    return;
  }
  HTTPServer.registerEndpoint("ble-scan", function(request, response) {
    response.code = 200;
    response.headers = [["Content-Type", "application/json"]];
    response.body = JSON.stringify({
      v: D.v,
      r: D.r,
      sa: D.sa,
      so: D.so,
      lr: D.lr,
      c: candidateList()
    });
    response.send();
  });
}

function onScanEvent(event, result) {
  if (event !== BLE.Scanner.SCAN_RESULT || !result) {
    return;
  }
  if (handleTp357Discovery(result)) {
    return;
  }
  handleBthomeDiscovery(result);
}

function stopDiscoveryScan(reason) {
  var stop = BLE.Scanner.stop || BLE.Scanner.Stop;
  if (stop) {
    stop.call(BLE.Scanner);
  }
  D.r = false;
  D.so = Date.now();
  D.lr = reason;
}

function startScanner(options) {
  var start = BLE.Scanner.start || BLE.Scanner.Start;
  return start ? start.call(BLE.Scanner, options) : null;
}

function startDiscoveryScan() {
  if (typeof BLE === "undefined" || !BLE.Scanner) {
    D.lr = "ble-scanner-missing";
    return;
  }
  var stop = BLE.Scanner.stop || BLE.Scanner.Stop;
  if (stop) {
    stop.call(BLE.Scanner);
  }
  BLE.Scanner.subscribe(function(event, result) {
    onScanEvent(event, result);
  });
  D.r = true;
  D.sa = Date.now();
  D.so = null;
  D.lr = "scan-running";
  Timer.set(1000, false, function() {
    var started = startScanner({
      duration_ms: BLE.Scanner.INFINITE_SCAN,
      active: false,
      interval_ms: 241,
      window_ms: 61,
      rssi_thr: 0
    });
    if (started === null) {
      D.lr = "scan-start-unconfirmed";
    }
  });
  Timer.set(30000, false, function() {
    stopDiscoveryScan("scan-complete");
  });
}

function requestDiscoveryStart() {
  D.r = false;
  D.sa = Date.now();
  D.so = null;
  D.lr = "scan-start-pending";
  startDiscoveryScan();
}

function keepDiscoveryEndpointAlive() {
  Timer.set(60000, true, function() {
    return true;
  });
}

registerDiscoveryEndpoint();
keepDiscoveryEndpointAlive();
requestDiscoveryStart();`;
  const compactBody = compactGeneratedShellyScript(body);

  return `// LCL BLE
// g: ${GENERATOR_VERSION}
// m: discovery-debug
// s: ${configHash(compactBody)}
${compactBody}
`;
};
