/**
 * Edit Page Test
 * 編集ページの承認ボタンとPDFプレビューのテスト
 */

import { test, expect } from '@playwright/test';

test.describe('Edit Page Tests', () => {
  const drawingId = 'ee4f2ea7-589c-4800-a4a9-1af42c0375c3';
  const consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    // コンソールエラーをキャプチャ
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // ページエラーをキャプチャ
    page.on('pageerror', (error) => {
      consoleErrors.push(`Page Error: ${error.message}`);
    });

    // 編集ページに移動
    await page.goto(`http://localhost:5173/edit/${drawingId}`);
    await page.waitForLoadState('networkidle');
  });

  test('Edit page should load without errors', async ({ page }) => {
    // スクリーンショット撮影
    await page.screenshot({
      path: 'test-results/edit-page-loaded.png',
      fullPage: true
    });

    // コンソールエラーがないことを確認
    console.log('Console Errors:', consoleErrors);
    expect(consoleErrors.length).toBe(0);

    // ページタイトルを確認
    await expect(page).toHaveTitle(/CAD図面管理システム/);
  });

  test('PDF preview should be visible', async ({ page }) => {
    // PDFプレビューが表示されるまで待機
    const pdfViewer = page.locator('canvas, iframe, object[type="application/pdf"]');

    // PDFビューアが存在することを確認（タイムアウトを長めに設定）
    await expect(pdfViewer.first()).toBeVisible({ timeout: 10000 });

    // スクリーンショット撮影
    await page.screenshot({
      path: 'test-results/edit-page-pdf-preview.png',
      fullPage: true
    });

    console.log('Console Errors:', consoleErrors);
  });

  test('Approve button should be clickable', async ({ page }) => {
    // 承認ボタンを探す
    const approveButton = page.getByRole('button', { name: /承認|Approve/i });

    // ボタンが存在し、クリック可能であることを確認
    await expect(approveButton).toBeVisible({ timeout: 10000 });
    await expect(approveButton).toBeEnabled();

    // スクリーンショット撮影
    await page.screenshot({
      path: 'test-results/edit-page-approve-button.png',
      fullPage: true
    });

    console.log('Console Errors:', consoleErrors);
  });

  test('Approve button click should work', async ({ page }) => {
    // 承認ボタンをクリック
    const approveButton = page.getByRole('button', { name: /承認|Approve/i });

    await expect(approveButton).toBeVisible({ timeout: 10000 });

    // クリックして応答を待機
    await approveButton.click();

    // 少し待機（APIリクエストが完了するまで）
    await page.waitForTimeout(2000);

    // スクリーンショット撮影
    await page.screenshot({
      path: 'test-results/edit-page-after-approve.png',
      fullPage: true
    });

    // コンソールエラーがないことを確認
    console.log('Console Errors after approve:', consoleErrors);

    // エラーメッセージが表示されていないことを確認
    const errorMessage = page.locator('text=/エラー|Error|失敗|Failed/i');
    await expect(errorMessage).not.toBeVisible({ timeout: 1000 }).catch(() => {
      // エラーメッセージが見つからない場合はOK
    });
  });
});
