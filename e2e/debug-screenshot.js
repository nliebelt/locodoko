const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    console.log('Navigating to http://localhost:8080...');
    await page.goto('http://localhost:8080', { timeout: 30000, waitUntil: 'networkidle' });
    console.log('Navigation finished. Taking screenshot...');
    await page.screenshot({ path: 'e2e/screenshots/debug-start.png' });
    console.log('Screenshot saved to e2e/screenshots/debug-start.png');
  } catch (e) {
    console.error('Error during screenshot:', e);
  } finally {
    await browser.close();
  }
})();
