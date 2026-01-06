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
const artifactDir = join(root, 'playwright-artifacts');
await mkdir(artifactDir, { recursive: true });
const args = new Set(process.argv.slice(2));

const pages = [
  {
    path: '/index.html',
    selectors: ['#daily-stance', '#daily-shift-text']
  },
  {
    path: '/weekly.html',
    selectors: ['#weekly-aii', '#weekly-lunar-status']
  },
  {
    path: '/lunar-cycle.html',
    selectors: ['#lunar-phase', '#lunar-events-list']
  },
  {
    path: '/lunar-3d.html',
    selectors: ['#timeline-range', '#market-status', '#scene-status']
  }
];

let browser;
let page;
const failures = [];

try {
  browser = await chromium.launch({ headless: !args.has('--headed') });
  page = await browser.newPage();
  page.setDefaultTimeout(8000);

  for (const entry of pages) {
    try {
      const consoleErrors = [];
      const responseErrors = [];
      const requestFailures = [];
      page.removeAllListeners('console');
      page.removeAllListeners('pageerror');
      page.removeAllListeners('response');
      page.removeAllListeners('requestfailed');

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      page.on('pageerror', (err) => {
        consoleErrors.push(err.message);
      });

      page.on('response', (response) => {
        const status = response.status();
        if (status >= 400) {
          responseErrors.push(`${status} ${response.url()}`);
        }
      });

      page.on('requestfailed', (request) => {
        requestFailures.push(`${request.failure()?.errorText ?? 'Request failed'} ${request.url()}`);
      });

      let navigationError;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          await page.goto(`${baseUrl}${entry.path}`, { waitUntil: 'networkidle', timeout: 15000 });
          navigationError = null;
          break;
        } catch (error) {
          navigationError = error;
        }
      }
      if (navigationError) {
        throw navigationError;
      }

      for (const selector of entry.selectors) {
        await page.waitForSelector(selector, { timeout: 5000 });
      }

      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(1000);

      const failuresForPage = [];
      if (consoleErrors.length) {
        failuresForPage.push(`Console errors: ${consoleErrors.join('; ')}`);
      }
      if (responseErrors.length) {
        failuresForPage.push(`HTTP errors: ${responseErrors.join('; ')}`);
      }
      if (requestFailures.length) {
        failuresForPage.push(`Request failures: ${requestFailures.join('; ')}`);
      }

      if (failuresForPage.length) {
        throw new Error(failuresForPage.join(' | '));
      }
    } catch (error) {
      const screenshotPath = join(
        artifactDir,
        `${entry.path.replace('/', '').replace('.html', '') || 'index'}.png`
      );
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch {
        // Ignore screenshot failures.
      }
      failures.push(`${entry.path} -> ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (failures.length) {
    throw new Error(`Smoke test failures:\n${failures.join('\n')}`);
  }
} finally {
  if (browser) {
    await browser.close();
  }
  await new Promise((resolve) => server.close(resolve));
}
