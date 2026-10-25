/**
 * Render public/og.png, the 1200×630 link-preview image.
 *
 * Boardroom colors and the bundled Instrument Serif and IBM Plex Mono faces.
 * The sample is fixed: 38.244667, −122.154190, Green Valley, 25 Oct 2026, 10:47 am PDT.
 *
 *   node tools/render-og.mjs
 *
 * Needs Chrome or Chromium (CHROME_PATH, or google-chrome on PATH).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'public', 'og.png');
const WIDTH = 1200;
const HEIGHT = 630;

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face {
        font-family: 'Instrument Serif';
        src: url('/fonts/InstrumentSerif-Regular.ttf') format('truetype');
        font-weight: 400;
        font-style: normal;
      }
      @font-face {
        font-family: 'IBM Plex Mono';
        src: url('/fonts/IBMPlexMono-Regular.ttf') format('truetype');
        font-weight: 400;
        font-style: normal;
      }
      html, body {
        margin: 0;
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
        background: #0e1a2b;
        color: #ece8df;
      }
      body {
        position: relative;
        display: flex;
        align-items: center;
        overflow: hidden;
      }
      .sheet {
        box-sizing: border-box;
        width: 100%;
        padding: 0 104px;
      }
      .place {
        margin: 0;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 15px;
        line-height: 1.45;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        opacity: 0.82;
      }
      .coords {
        margin: 28px 0 0;
        font-family: 'Instrument Serif', serif;
        font-size: 84px;
        line-height: 1.02;
        letter-spacing: -0.02em;
        font-weight: 400;
      }
      .rule {
        width: 56px;
        height: 1px;
        margin: 26px 0 20px;
        background: #ece8df;
        opacity: 0.72;
      }
      .when {
        margin: 0;
        font-family: 'Instrument Serif', serif;
        font-size: 36px;
        line-height: 1.25;
        letter-spacing: 0.012em;
        font-weight: 400;
      }
      .meta {
        margin: 26px 0 0;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 15px;
        line-height: 1.7;
        letter-spacing: 0.03em;
        opacity: 0.78;
      }
      .mark {
        position: absolute;
        left: 104px;
        bottom: 40px;
        margin: 0;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 13px;
        line-height: 1;
        letter-spacing: 0.14em;
        opacity: 0.5;
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <p class="place">Green Valley, California</p>
      <p class="coords">38.244667° N<br />122.154190° W</p>
      <div class="rule"></div>
      <p class="when">October 25, 2026 · 10:47 am</p>
      <p class="meta">alt 39 m<br />2026-10-25 17:47:00 UTC</p>
    </div>
    <p class="mark">transient.notarist.art</p>
  </body>
</html>`;

function chromeBin() {
  const fromEnv = process.env.CHROME_PATH;
  const candidates = [fromEnv, '/usr/local/bin/google-chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
  const found = candidates.find((bin) => fs.existsSync(bin));
  if (!found) throw new Error('Chrome or Chromium is required. Set CHROME_PATH.');
  return found;
}

function serve() {
  const fonts = path.join(root, 'public', 'fonts');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(html);
      return;
    }
    if (url.pathname.startsWith('/fonts/')) {
      const file = path.join(fonts, path.basename(url.pathname));
      if (!file.startsWith(fonts) || !fs.existsSync(file)) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader('content-type', 'font/ttf');
      fs.createReadStream(file).pipe(res);
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, port: typeof address === 'object' && address ? address.port : 0 });
    });
  });
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  const opened = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', () => reject(new Error('Could not open the Chrome debugger')));
  });
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  return {
    opened,
    send(method, params = {}) {
      const id = ++seq;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() {
      ws.close();
    },
  };
}

async function debuggerPort(chrome) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Chrome did not open a debugger port')), 15000);
    const onData = (chunk) => {
      const match = String(chunk).match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (!match) return;
      clearTimeout(timer);
      chrome.stderr.off('data', onData);
      resolve(Number(match[1]));
    };
    chrome.stderr.on('data', onData);
    chrome.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited before the debugger was ready (${code})`));
    });
  });
}

async function main() {
  const { server, port } = await serve();
  const profile = await mkdtemp(path.join(os.tmpdir(), 'transient-og-'));
  const chrome = spawn(
    chromeBin(),
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      `--user-data-dir=${profile}`,
      '--remote-debugging-port=0',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  try {
    const debugPort = await debuggerPort(chrome);
    const listed = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((res) => res.json());
    const page = listed.find((target) => target.type === 'page');
    if (!page?.webSocketDebuggerUrl) throw new Error('Chrome did not open a page');
    const client = cdp(page.webSocketDebuggerUrl);
    await client.opened;
    await client.send('Page.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await client.send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
    const ready = await client.send('Runtime.evaluate', {
      expression: `document.fonts.load('400 84px "Instrument Serif"', '38.244667').then(() => document.fonts.load('400 15px "IBM Plex Mono"', 'GREEN')).then(() => document.fonts.ready).then(() => ({
        serif: document.fonts.check('400 84px "Instrument Serif"', '38.244667'),
        mono: document.fonts.check('400 15px "IBM Plex Mono"', 'GREEN'),
      }))`,
      awaitPromise: true,
      returnByValue: true,
    });
    const faces = ready.result?.value;
    if (!faces?.serif || !faces?.mono) throw new Error(`Display faces did not load: ${JSON.stringify(faces)}`);
    const shot = await client.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 },
      captureBeyondViewport: true,
    });
    await writeFile(outFile, Buffer.from(shot.data, 'base64'));
    client.close();
    console.log(`wrote ${path.relative(root, outFile)}`);
  } finally {
    chrome.kill();
    server.close();
    await new Promise((resolve) => chrome.once('exit', resolve));
    await rm(profile, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
