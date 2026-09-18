import json
import time
import urllib.request

BASE = "http://192.168.0.16"
SCRIPT_ID = 1


def get_json(url, data=None):
    request = urllib.request.Request(
        url,
        data=None if data is None else json.dumps(data).encode("utf-8"),
        headers={} if data is None else {"content-type": "application/json"},
        method="GET" if data is None else "POST",
    )
    with urllib.request.urlopen(request, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def rpc(method, params=None):
    payload = {"id": 1, "method": method}
    if params is not None:
        payload["params"] = params
    response = get_json(f"{BASE}/rpc", payload)
    if "error" in response:
        raise RuntimeError(response["error"])
    return response.get("result")


def eval_code(code):
    result = rpc("Script.Eval", {"id": SCRIPT_ID, "code": code})
    if not isinstance(result, dict) or "result" not in result:
        raise RuntimeError(f"Unexpected Script.Eval response: {result!r}")
    return str(result["result"])


def mode():
    value = eval_code('typeof R==="object"&&typeof R.m==="number"?R.m:-1')
    return "manual" if value == "1" else "auto" if value == "0" else f"unsupported({value})"


def diag():
    return get_json(f"{BASE}/script/{SCRIPT_ID}/diag")


def relay_from_diag(snapshot):
    p = snapshot.get("p")
    return None if not isinstance(p, list) or not p else bool(p[0])


def sample(label, count=7, interval=5):
    rows = []
    print(f"--- {label} ---", flush=True)
    for index in range(count):
        snapshot = diag()
        g = snapshot.get("g") or []
        y = snapshot.get("y") or []
        row = {
            "i": index,
            "mode": mode(),
            "uptime_s": y[2] if len(y) > 2 else None,
            "last_seen_ms": g[0] if len(g) > 0 else None,
            "temp": g[1] if len(g) > 1 else None,
            "humidity": g[2] if len(g) > 2 else None,
            "rule_relay": g[5] if len(g) > 5 else None,
            "last_packet_ms": g[15] if len(g) > 15 else None,
            "data_state": g[16] if len(g) > 16 else None,
            "plug_relay": relay_from_diag(snapshot),
        }
        rows.append(row)
        print(json.dumps(row, sort_keys=True), flush=True)
        if index + 1 < count:
            time.sleep(interval)
    changes_seen = sum(
        1
        for previous, current in zip(rows, rows[1:])
        if current["last_seen_ms"] is not None
        and previous["last_seen_ms"] is not None
        and current["last_seen_ms"] > previous["last_seen_ms"]
    )
    changes_packet = sum(
        1
        for previous, current in zip(rows, rows[1:])
        if current["last_packet_ms"] is not None
        and previous["last_packet_ms"] is not None
        and current["last_packet_ms"] > previous["last_packet_ms"]
    )
    print(
        json.dumps(
            {
                "label": label,
                "last_seen_increases": changes_seen,
                "last_packet_increases": changes_packet,
                "samples": len(rows),
            },
            sort_keys=True,
        ),
        flush=True,
    )
    return rows


def set_manual_safely():
    value = eval_code('R.m=1;R.nh=R.fh=0;R.on=false;R.os=null;R.rs="mn";R.m')
    if value != "1":
        raise RuntimeError(f"MANUAL not confirmed: {value}")
    rpc("Switch.Set", {"id": 0, "on": False})
    rpc("Switch.Set", {"id": 0, "on": False})


def set_auto_safely():
    rpc("Switch.Set", {"id": 0, "on": False})
    value = eval_code('R.nh=R.fh=0;R.on=false;R.os=null;R.rs="ar";R.m=0;R.m')
    if value != "0":
        raise RuntimeError(f"AUTO not confirmed: {value}")


initial_mode = mode()
initial_snapshot = diag()
initial_relay = relay_from_diag(initial_snapshot)
print(json.dumps({"initial_mode": initial_mode, "initial_relay": initial_relay}), flush=True)

try:
    if initial_mode == "auto":
        sample("AUTO", count=7, interval=5)
        set_manual_safely()
        time.sleep(1)
        sample("MANUAL", count=7, interval=5)
    elif initial_mode == "manual":
        sample("MANUAL", count=7, interval=5)
        set_auto_safely()
        time.sleep(1)
        sample("AUTO", count=7, interval=5)
    else:
        raise RuntimeError(f"Unsupported initial runtime mode: {initial_mode}")
finally:
    if initial_mode == "manual":
        set_manual_safely()
    elif initial_mode == "auto":
        set_auto_safely()
    time.sleep(2)
    final_snapshot = diag()
    print(
        json.dumps(
            {
                "final_mode": mode(),
                "final_relay": relay_from_diag(final_snapshot),
                "final_last_seen_ms": (final_snapshot.get("g") or [None])[0],
                "final_last_packet_ms": (final_snapshot.get("g") or [None] * 16)[15],
            },
            sort_keys=True,
        ),
        flush=True,
    )
