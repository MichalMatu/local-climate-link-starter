import { GENERATOR_VERSION } from './config.js';
import { BLE_DISCOVERY_PARSING_RUNTIME } from './discoveryParsing.js';
import { configHash } from './hash.js';
import { compactGeneratedShellyScript } from './scriptText.js';

const DISCOVERY_RUNTIME_PREFIX = `var D={v:1,r:false,sa:null,so:null,lr:"boot",c:{},n:0};

`;

const DISCOVERY_RUNTIME_SUFFIX = `function cp(item, previous, candidate, field) {
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

export const generateShellyBleDiscoveryScript = (): string => {
  const body = `${DISCOVERY_RUNTIME_PREFIX}${BLE_DISCOVERY_PARSING_RUNTIME}${DISCOVERY_RUNTIME_SUFFIX}`;
  const compactBody = compactGeneratedShellyScript(body);

  return `// LCL BLE
// g: ${GENERATOR_VERSION}
// m: discovery-debug
// s: ${configHash(compactBody)}
${compactBody}
`;
};
