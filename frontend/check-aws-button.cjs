const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('Navigating to upload page...');
  await page.goto('http://localhost:5175/upload');

  console.log('Waiting for page to load...');
  await page.waitForTimeout(4000);

  // Check for AWS login button
  const awsButton = await page.$('a[href*="awsapps.com"]');
  if (awsButton) {
    console.log('✓ AWS Login button found!');
    const href = await awsButton.getAttribute('href');
    console.log('  URL:', href);
  } else {
    console.log('✗ AWS Login button NOT found');
  }

  // Check for error message
  const errorMessage = await page.$('text=AI接続に失敗しました');
  if (errorMessage) {
    console.log('✓ AI connection error message displayed');
  }

  await page.screenshot({ path: 'aws-login-button-check.png', fullPage: true });
  console.log('Screenshot saved to aws-login-button-check.png');

  await browser.close();
})();
