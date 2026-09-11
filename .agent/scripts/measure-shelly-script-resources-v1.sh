#!/bin/sh
set -eu

SERIAL=RFCT70L7E8J
PACKAGE=link.localclimate.app
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

adb -s "$SERIAL" get-state >/dev/null
MODEL="$(adb -s "$SERIAL" shell getprop ro.product.model | tr -d '\r')"
printf 'DEVICE_MODEL=%s\n' "$MODEL"

# Read the app sandbox only to recover the exact saved Shelly base URL. Do not
# print or persist the sandbox contents.
adb -s "$SERIAL" exec-out run-as "$PACKAGE" sh -c 'cd /data/user/0/'"$PACKAGE"' && tar -cf - .' > "$TMP/appdata.tar"
strings "$TMP/appdata.tar" \
  | grep -Eo 'https?://([0-9]{1,3}\.){3}[0-9]{1,3}(:[0-9]+)?/?' \
  | sort -u > "$TMP/candidates.txt" || true

python3 - "$TMP/candidates.txt" <<'PY'
import json
import sys
import urllib.error
import urllib.request

candidate_file = sys.argv[1]
with open(candidate_file, 'r', encoding='utf-8') as f:
    candidates = [line.strip().rstrip('/') for line in f if line.strip()]


def rpc(base, method, params=None, timeout=3):
    body = {"id": 1, "method": method}
    if params is not None:
        body["params"] = params
    req = urllib.request.Request(
        base + '/rpc',
        data=json.dumps(body).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = json.loads(resp.read().decode('utf-8'))
    if 'error' in payload:
        raise RuntimeError(payload['error'])
    return payload.get('result', payload)

found = []
for base in candidates:
    try:
        info = rpc(base, 'Shelly.GetDeviceInfo')
        if isinstance(info, dict) and info.get('id'):
            found.append((base, info))
    except Exception:
        pass

if len(found) != 1:
    print('SHELLY_MATCH_COUNT=' + str(len(found)))
    for base, info in found:
        print('MATCH=' + base + ' id=' + str(info.get('id')) + ' model=' + str(info.get('model')))
    raise SystemExit('Expected exactly one saved reachable Shelly device')

base, info = found[0]
print('SHELLY_ID=' + str(info.get('id')))
print('SHELLY_MODEL=' + str(info.get('model')))
print('SHELLY_GEN=' + str(info.get('gen')))
print('SHELLY_FW=' + str(info.get('fw_id')))

scripts_payload = rpc(base, 'Script.List')
scripts = scripts_payload.get('scripts', []) if isinstance(scripts_payload, dict) else []
managed = [s for s in scripts if s.get('name') == 'Local Climate Link Thermostat']
print('SCRIPT_COUNT=' + str(len(scripts)))
print('MANAGED_SCRIPT_COUNT=' + str(len(managed)))
if len(managed) != 1:
    raise SystemExit('Expected exactly one managed Local Climate Link Thermostat script')

script = managed[0]
script_id = int(script['id'])
print('SCRIPT_ID=' + str(script_id))
print('SCRIPT_RUNNING_LIST=' + str(bool(script.get('running'))).lower())

status = rpc(base, 'Script.GetStatus', {'id': script_id})
for key in ('running', 'mem_used', 'mem_peak', 'mem_free', 'cpu', 'error', 'errors'):
    if key in status:
        value = status[key]
        if isinstance(value, (dict, list)):
            value = json.dumps(value, separators=(',', ':'))
        print('SCRIPT_' + key.upper() + '=' + str(value))

sys_status = rpc(base, 'Sys.GetStatus')
for key in ('ram_size', 'ram_free', 'fs_size', 'fs_free', 'uptime'):
    if key in sys_status:
        print('SYS_' + key.upper() + '=' + str(sys_status[key]))

# Read all deployed code chunks and count UTF-8 bytes without modifying the slot.
offset = 0
chunks = []
while True:
    part = rpc(base, 'Script.GetCode', {'id': script_id, 'offset': offset, 'len': 1024})
    data = part.get('data', '')
    chunks.append(data)
    offset += len(data.encode('utf-8'))
    if int(part.get('left', 0) or 0) <= 0:
        break
code = ''.join(chunks)
print('SCRIPT_CODE_BYTES=' + str(len(code.encode('utf-8'))))
header = '\n'.join(code.splitlines()[:4])
for line in header.splitlines():
    if line.startswith('// g:') or line.startswith('// m:') or line.startswith('// h:'):
        print('SCRIPT_META=' + line[3:].strip())
PY
