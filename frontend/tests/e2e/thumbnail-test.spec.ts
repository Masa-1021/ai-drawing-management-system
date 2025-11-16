/**
 * Thumbnail Display Test
 * サムネイルが正しく表示されることを確認するテスト
 */

import { test, expect } from '@playwright/test';

test.describe('Thumbnail Display Test', () => {
  test('Thumbnails should display as images in list view', async ({ page }) => {
    // 図面一覧ページに移動
    await page.goto('http://localhost:5173/list');
    await page.waitForLoadState('networkidle');

    // 図面リストが表示されるまで待機
    await page.waitForSelector('[class*="grid"]', { timeout: 10000 });

    // スクリーンショット撮影
    await page.screenshot({
      path: 'test-results/thumbnail-list-view.png',
      fullPage: true
    });

    // サムネイル画像が存在することを確認
    const thumbnails = page.locator('img[alt*="サムネイル"], img[src*="/storage/thumbnails/"]');
    const count = await thumbnails.count();

    console.log(`Found ${count} thumbnail images`);
    expect(count).toBeGreaterThan(0);

    // 各サムネイルが実際に画像として表示されていることを確認
    for (let i = 0; i < count; i++) {
      const thumbnail = thumbnails.nth(i);
      await expect(thumbnail).toBeVisible();

      // src属性が存在し、正しいパスを持つことを確認
      const src = await thumbnail.getAttribute('src');
      console.log(`Thumbnail ${i + 1} src: ${src}`);
      expect(src).toContain('/storage/thumbnails/');
    }

    console.log('✅ All thumbnails are displaying correctly');
  });

  test('Thumbnail images should load successfully', async ({ page }) => {
    // 図面一覧ページに移動
    await page.goto('http://localhost:5173/list');
    await page.waitForLoadState('networkidle');

    // 画像ロードエラーをキャプチャ
    const imageErrors: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/storage/thumbnails/') && response.status() !== 200) {
        imageErrors.push(`Failed to load: ${response.url()} (${response.status()})`);
      }
    });

    // サムネイル画像を探す
    const thumbnails = page.locator('img[src*="/storage/thumbnails/"]');
    await expect(thumbnails.first()).toBeVisible({ timeout: 10000 });

    // 少し待機して画像がロードされるのを待つ
    await page.waitForTimeout(2000);

    // スクリーンショット撮影
    await page.screenshot({
      path: 'test-results/thumbnail-loaded.png',
      fullPage: true
    });

    // 画像ロードエラーがないことを確認
    console.log('Image errors:', imageErrors);
    expect(imageErrors.length).toBe(0);

    console.log('✅ All thumbnail images loaded successfully');
  });
});
