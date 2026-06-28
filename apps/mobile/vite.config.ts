import react from '@vitejs/plugin-react';
import type { IncomingMessage } from 'node:http';
import { defineConfig, type Plugin } from 'vite';

const SHELLY_DEV_PROXY_PATH = '/__lcl_shelly_proxy';

const workspaceChunk = (id: string): string | undefined => {
  if (id.includes('/packages/ui/') || id.includes('/packages/design-tokens/')) {
    return 'lcl-ui';
  }
  if (
    id.includes('/packages/automation-core/') ||
    id.includes('/packages/ble-core/') ||
    id.includes('/packages/device-profiles/') ||
    id.includes('/packages/diagnostics/') ||
    id.includes('/packages/script-generator/') ||
    id.includes('/packages/shelly-client/')
  ) {
    return 'lcl-domain';
  }
  return undefined;
};

const vendorChunk = (id: string): string | undefined => {
  if (!id.includes('/node_modules/')) {
    return undefined;
  }
  if (
    id.includes('/node_modules/react/') ||
    id.includes('/node_modules/react-dom/') ||
    id.includes('/node_modules/scheduler/')
  ) {
    return 'vendor-react';
  }
  if (
    id.includes('/node_modules/@ionic/react/') ||
    id.includes('/node_modules/@ionic/react-router/')
  ) {
    return 'vendor-ionic-react';
  }
  if (
    id.includes('/node_modules/@ionic/core/') ||
    id.includes('/node_modules/ionicons/')
  ) {
    return undefined;
  }
  if (id.includes('/node_modules/@capacitor/')) {
    return 'vendor-capacitor';
  }
  if (id.includes('/node_modules/@tanstack/')) {
    return 'vendor-query';
  }
  if (id.includes('/node_modules/zod/') || id.includes('/node_modules/zustand/')) {
    return 'vendor-state';
  }
  return 'vendor-misc';
};

const manualChunks = (id: string): string | undefined =>
  workspaceChunk(id) ?? vendorChunk(id);

const isPrivateHost = (hostname: string): boolean => {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.local')) {
    return true;
  }
  if (
    lower.startsWith('127.') ||
    lower.startsWith('10.') ||
    lower.startsWith('192.168.')
  ) {
    return true;
  }

  const octets = lower.split('.').map((part) => Number(part));
  const firstOctet = octets[0];
  const secondOctet = octets[1];
  return (
    octets.length === 4 &&
    firstOctet === 172 &&
    secondOctet !== undefined &&
    Number.isInteger(secondOctet) &&
    secondOctet >= 16 &&
    secondOctet <= 31
  );
};

const isAllowedShellyPath = (pathname: string): boolean =>
  pathname === '/rpc' || /^\/script\/\d+\/(ble-scan|diag)$/.test(pathname);

const readRequestBody = async (
  request: IncomingMessage,
  method: string
): Promise<Buffer | undefined> => {
  if (method === 'GET' || method === 'HEAD') {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const shellyDevProxy = (): Plugin => ({
  name: 'lcl-shelly-dev-proxy',
  configureServer(server) {
    server.middlewares.use(SHELLY_DEV_PROXY_PATH, async (request, response) => {
      try {
        const requestUrl = new URL(request.url ?? '/', 'http://localhost');
        const targetParam = requestUrl.searchParams.get('target');
        if (!targetParam) {
          response.statusCode = 400;
          response.end('Missing target.');
          return;
        }

        const targetUrl = new URL(targetParam);
        if (!['http:', 'https:'].includes(targetUrl.protocol)) {
          response.statusCode = 400;
          response.end('Unsupported target protocol.');
          return;
        }
        if (
          !isPrivateHost(targetUrl.hostname) ||
          !isAllowedShellyPath(targetUrl.pathname)
        ) {
          response.statusCode = 403;
          response.end('Target is outside the Shelly dev proxy scope.');
          return;
        }

        const headers = new Headers();
        const contentType = request.headers['content-type'];
        if (typeof contentType === 'string') {
          headers.set('content-type', contentType);
        }

        const method = request.method ?? 'GET';
        const body = await readRequestBody(request, method);
        const requestInit: RequestInit = { method, headers };
        if (body !== undefined) {
          requestInit.body = Uint8Array.from(body).buffer;
        }

        const proxied = await fetch(targetUrl, requestInit);

        response.statusCode = proxied.status;
        const proxiedContentType = proxied.headers.get('content-type');
        if (proxiedContentType) {
          response.setHeader('content-type', proxiedContentType);
        }
        response.setHeader('cache-control', 'no-store');
        response.end(Buffer.from(await proxied.arrayBuffer()));
      } catch (error) {
        response.statusCode = 502;
        response.end(error instanceof Error ? error.message : 'Shelly proxy failed.');
      }
    });
  }
});

export default defineConfig({
  plugins: [react(), shellyDevProxy()],
  build: {
    rollupOptions: {
      output: {
        manualChunks,
        onlyExplicitManualChunks: true
      }
    }
  },
  server: {
    port: 5173
  }
});
