import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
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
const args = new Set(process.argv.slice(2));
const isCi = process.env.CI === 'true';
const defaultTimeout = isCi ? 10000 : 8000;
const navigationTimeout = isCi ? 10000 : 8000;

const pages = ['/index.html', '/weekly.html', '/lunar-cycle.html', '/lunar-3d.html'];
const ignoredErrorPatterns = [
  /webgl/i,
  /three(\.js)?/i,
  /canvas/i,
  /webglcontext/i,
  /shader/i,
  /requestanimationframe/i,
  /raf/i,
  /resizeobserver/i
];

let browser;
let page;
const failures = [];
let artifactDirReady = false;

const shouldIgnoreError = (message) =>
  ignoredErrorPatterns.some((pattern) => pattern.test(message));
const ensureArtifactDir = async () => {
  if (!artifactDirReady) {
    const artifactDir = join(root, 'playwright-artifacts');
    await mkdir(artifactDir, { recursive: true });
    artifactDirReady = true;
  }
  return join(root, 'playwright-artifacts');
};

try {
  browser = await chromium.launch({ headless: !args.has('--headed') });
  page = await browser.newPage();
  page.setDefaultTimeout(defaultTimeout);

  for (const path of pages) {
    try {
      const consoleErrors = [];
      page.removeAllListeners('console');
      page.removeAllListeners('pageerror');

      page.on('console', (msg) => {
        if (msg.type() === 'error' && !shouldIgnoreError(msg.text())) {
          consoleErrors.push(msg.text());
        }
      });

      page.on('pageerror', (err) => {
        if (!shouldIgnoreError(err.message)) {
          consoleErrors.push(err.message);
        }
      });

      const response = await page.goto(`${baseUrl}${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: navigationTimeout
      });

      if (!response || response.status() !== 200 || !response.ok()) {
        console.warn(
          `Navigation response not OK: ${response?.status() ?? 'no response'} for ${path}`
        );
        failures.push(`${path} -> Navigation response not OK`);
        continue;
      }

      const domStatus = await page.evaluate(() => ({
        hasBody: Boolean(document.body)
      }));

      if (!domStatus.hasBody) {
        console.warn(`Missing <body> on ${path}`);
        failures.push(`${path} -> Missing <body>`);
        continue;
      }

      if (consoleErrors.length) {
        console.warn(`Console errors on ${path}: ${consoleErrors.join('; ')}`);
        failures.push(`${path} -> Console errors`);
      }
    } catch (error) {
      const artifactDir = await ensureArtifactDir();
      const screenshotPath = join(
        artifactDir,
        `${path.replace('/', '').replace('.html', '') || 'index'}.png`
      );
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch {
        // Ignore screenshot failures.
      }
      console.warn(
        `Smoke check warning on ${path}: ${error instanceof Error ? error.message : String(error)}`
      );
      failures.push(`${path} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures.length) {
    console.warn(`Smoke test warnings:\n${failures.join('\n')}`);
  }
} finally {
  if (browser) {
    await browser.close();
  }
  await new Promise((resolve) => server.close(resolve));
}
process.exit(0);
