const { firefox } = require('playwright');

(async () => {
  const browser = await firefox.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  try {
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(5000); // Warten auf Phaser-Boot
    await page.screenshot({ path: 'debug-start.png' });
    console.log('Screenshot gespeichert als debug-start.png');
    
    const html = await page.content();
    require('fs').writeFileSync('debug-page.html', html);
    console.log('HTML gespeichert als debug-page.html');
  } catch (e) {
    console.error('Fehler beim Debugging:', e);
  } finally {
    await browser.close();
  }
})();
