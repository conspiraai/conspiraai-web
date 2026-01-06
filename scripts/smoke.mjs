import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();

const contentTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = createServer(async (req, res) => {
  const urlPath = req.url?.split('?')[0] ?? '/';
  const safePath = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = join(root, safePath);
  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(data);
  } catch (error) {
    res.writeHead(404);
    res.end('Not found');
  }
});

const serverReady = new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    resolve(`http://127.0.0.1:${address.port}`);
  });
});

const baseUrl = await serverReady;

const pages = [
  {
    path: '/index.html',
    selectors: ['#daily-stance', '.bias-button']
  },
  {
    path: '/weekly.html',
    selectors: ['#weekly-aii', '#weekly-summary']
  },
  {
    path: '/lunar-cycle.html',
    selectors: ['#lunar-phase', '#lunar-events-list']
  },
  {
    path: '/lunar-3d.html',
    selectors: ['#lunar-3d-canvas', '#market-status']
  }
];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const entry of pages) {
  const consoleErrors = [];
  page.removeAllListeners('console');
  page.removeAllListeners('pageerror');

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  await page.goto(`${baseUrl}${entry.path}`, { waitUntil: 'networkidle' });

  for (const selector of entry.selectors) {
    await page.waitForSelector(selector, { timeout: 5000 });
  }

  if (consoleErrors.length) {
    throw new Error(`Console errors on ${entry.path}: ${consoleErrors.join('; ')}`);
  }
}

await browser.close();
server.close();
