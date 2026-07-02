# @lcl/shelly-client

Purpose: typed Shelly RPC ports, fetch transport skeleton, script install flow, and safe relay test.

Public API:

- `ShellyClient`
- `FetchShellyRpcTransport`
- `RpcShellyClient`
- `FakeShellyClient`
- `RPC_METHODS`
- `createInstallPlan`

Examples:

```ts
import { FakeShellyClient, createInstallPlan } from '@lcl/shelly-client';
```

Install flow parses `Script.List`, reuses and backs up the existing Local Climate Link script when found, uploads code with chunked `Script.PutCode`, enables run-on-boot, starts the script, and verifies `Script.GetStatus`.

`FetchShellyRpcTransport` sends JSON-RPC style `{ id, method, params }` envelopes to `/rpc` and accepts Shelly-style `{ result }`, `{ params }`, `{ error }`, and direct object payloads.

RPC targets are limited to local hosts: private IPv4 ranges, localhost, `.local`,
and IPv6 loopback/link-local. Public HTTP(S) hosts are rejected before fetch.

Tests cover RPC request order, existing script reuse, backup with byte offsets, chunked upload, timeout behavior, fetch response envelopes, fake upload success, Matter blocking, and safe relay test final OFF/error paths.

Do not import React, Ionic screens, BLE scanners, or app state here.
