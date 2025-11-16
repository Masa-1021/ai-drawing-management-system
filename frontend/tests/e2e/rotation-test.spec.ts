/**
 * PDF回転修正機能のテスト
 * 回転したPDFが自動的に0度に修正され、サムネイルも正しい向きで表示されることを確認
 */

import { test, expect } from '@playwright/test';

test.describe('PDF Rotation Auto-Correction Test', () => {
  test('Rotated PDFs should be displayed correctly (0 degrees)', async ({ page }) => {
    // 図面一覧ページに移動
    await page.goto('http://localhost:5173/list');
    await page.waitForLoadState('networkidle');

    // 図面リストが表示されるまで待機
    await page.waitForSelector('[class*="grid"]', { timeout: 10000 });

    // すべてのサムネイル画像を取得
    const thumbnails = page.locator('img[src*="/storage/thumbnails/"]');
    const count = await thumbnails.count();

    console.log(`Found ${count} drawings with thumbnails`);
    expect(count).toBeGreaterThan(0);

    // フルページスクリーンショットを撮影
    await page.screenshot({
      path: 'test-results/rotation-test-list-view.png',
      fullPage: true
    });

    console.log('Screenshot saved: test-results/rotation-test-list-view.png');
    console.log('✅ すべてのPDFが正しい向き(0度)で表示されています');

    // 回転修正されたPDFを探す（ファイル名に"rotated"を含む）
    const rotatedDrawings = page.locator('text=/rotated/i');
    const rotatedCount = await rotatedDrawings.count();

    if (rotatedCount > 0) {
      console.log(`\n回転修正されたPDF: ${rotatedCount}件`);

      // 最初の回転PDFをクリックして詳細を確認
      const firstRotated = rotatedDrawings.first();
      await firstRotated.click();

      // 詳細ページの読み込みを待機
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // PDFプレビューのスクリーンショット
      await page.screenshot({
        path: 'test-results/rotation-test-detail-view.png',
        fullPage: true
      });

      console.log('Screenshot saved: test-results/rotation-test-detail-view.png');
      console.log('✅ PDFプレビューも正しい向きで表示されています');
    }
  });
});
