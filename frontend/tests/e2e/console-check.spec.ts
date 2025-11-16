/**
 * Console Error Check Test
 * ブラウザコンソールにエラーがないことを確認
 */

import { test, expect } from '@playwright/test';

test.describe('Console Error Check', () => {
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    // コンソールメッセージをキャプチャ
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // ページエラーをキャプチャ
    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    await page.goto('http://localhost:5173');
  });

  test('Upload page should load without console errors', async ({ page }) => {
    // ページが完全にロードされるまで待機
    await page.waitForLoadState('networkidle');

    // スクリーンショットを撮影
    await page.screenshot({
      path: 'test-results/upload-page-clean.png',
      fullPage: true
    });

    // コンソールエラーがないことを確認
    console.log('Console Errors:', consoleErrors);
    console.log('Console Warnings:', consoleWarnings);

    expect(consoleErrors.length).toBe(0);
  });

  test('List page should load without console errors', async ({ page }) => {
    // 図面一覧ページに移動
    await page.click('text=図面一覧');
    await page.waitForURL('**/list');
    await page.waitForLoadState('networkidle');

    // スクリーンショットを撮影
    await page.screenshot({
      path: 'test-results/list-page-clean.png',
      fullPage: true
    });

    // コンソールエラーがないことを確認
    console.log('Console Errors:', consoleErrors);
    console.log('Console Warnings:', consoleWarnings);

    expect(consoleErrors.length).toBe(0);
  });

  test('Search page should load without console errors', async ({ page }) => {
    // 検索ページに移動
    await page.click('text=検索');
    await page.waitForURL('**/search');
    await page.waitForLoadState('networkidle');

    // スクリーンショットを撮影
    await page.screenshot({
      path: 'test-results/search-page-clean.png',
      fullPage: true
    });

    // コンソールエラーがないことを確認
    console.log('Console Errors:', consoleErrors);
    console.log('Console Warnings:', consoleWarnings);

    expect(consoleErrors.length).toBe(0);
  });
});
