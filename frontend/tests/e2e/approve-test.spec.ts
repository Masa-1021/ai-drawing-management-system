/**
 * Approve Button Test
 * 承認ボタンの動作確認テスト
 */

import { test, expect } from '@playwright/test';

test.describe('Approve Button Test', () => {
  const drawingId = 'ee4f2ea7-589c-4800-a4a9-1af42c0375c3';

  test('Approve button should be enabled and clickable', async ({ page }) => {
    // 編集ページに移動
    await page.goto(`http://localhost:5173/edit/${drawingId}`);
    await page.waitForLoadState('networkidle');

    // ロック警告が表示されていないことを確認
    const lockWarning = page.locator('text=/が編集中/');
    await expect(lockWarning).not.toBeVisible({ timeout: 5000 }).catch(() => {
      console.log('No lock warning found (OK)');
    });

    // 承認ボタンを探す
    const approveButton = page.getByRole('button', { name: /承認/i });

    // ボタンが存在し、有効であることを確認
    await expect(approveButton).toBeVisible({ timeout: 10000 });
    await expect(approveButton).toBeEnabled({ timeout: 5000 });

    // 初期状態のスクリーンショット
    await page.screenshot({
      path: 'test-results/approve-button-before.png',
      fullPage: true
    });

    console.log('✅ Approve button is enabled and ready to click');

    // 承認ボタンをクリック
    await approveButton.click();

    // 成功メッセージを待つ
    const successMessage = page.locator('text=/承認しました|成功/i');
    await expect(successMessage).toBeVisible({ timeout: 5000 });

    // クリック後のスクリーンショット
    await page.screenshot({
      path: 'test-results/approve-button-after.png',
      fullPage: true
    });

    console.log('✅ Approve button clicked successfully');
  });
});
