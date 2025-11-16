/**
 * ファイル名編集テスト
 * ファイル名を変更して保存した後、フォームが正しく更新されることを確認
 */

import { test, expect } from '@playwright/test';

test.describe('Filename Edit Tests', () => {
  test.beforeEach(async ({ page }) => {
    // ホームページに移動
    await page.goto('http://localhost:5173/');
  });

  test('Should update form after saving new filename', async ({ page }) => {
    // 一覧ページに移動
    await page.goto('http://localhost:5173/');

    // 最初の図面カードが表示されるまで待機
    await page.waitForSelector('[data-testid="drawing-card"]', { timeout: 10000 });

    // 最初の図面をクリックして編集画面に移動
    const firstCard = page.locator('[data-testid="drawing-card"]').first();
    await firstCard.click();

    // 編集画面が読み込まれるまで待機
    await page.waitForURL(/\/edit\/.+/, { timeout: 10000 });

    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState('networkidle');

    // ファイル名入力フィールドを取得
    const filenameInput = page.locator('input[name="pdf_filename"]');
    await expect(filenameInput).toBeVisible({ timeout: 5000 });

    // 現在のファイル名を取得
    const originalFilename = await filenameInput.inputValue();
    console.log('Original filename:', originalFilename);

    // 新しいファイル名を生成（タイムスタンプ付き）
    const timestamp = Date.now();
    const newFilename = `test-drawing-${timestamp}.pdf`;
    console.log('New filename:', newFilename);

    // ファイル名を変更
    await filenameInput.fill('');
    await filenameInput.fill(newFilename);

    // 入力値が正しく設定されたことを確認
    await expect(filenameInput).toHaveValue(newFilename);

    // 保存ボタンをクリック
    const saveButton = page.getByRole('button', { name: /保存|Save/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // 保存成功のトーストメッセージを待機
    await page.waitForSelector('text=/保存しました|Saved/', { timeout: 5000 });

    // 少し待機してデータが更新されることを確認
    await page.waitForTimeout(1000);

    // フォームの値が新しいファイル名に更新されていることを確認
    const updatedFilename = await filenameInput.inputValue();
    console.log('Updated filename:', updatedFilename);

    expect(updatedFilename).toBe(newFilename);

    // スクリーンショット撮影
    await page.screenshot({
      path: 'frontend/screenshots/filename-updated.png',
      fullPage: true
    });

    // PDFプレビューが表示されていることを確認（消えていないこと）
    const pdfViewer = page.locator('canvas, iframe, object[type="application/pdf"]');
    const pdfViewerCount = await pdfViewer.count();
    console.log('PDF viewer elements found:', pdfViewerCount);

    // PDFビューアが少なくとも1つ存在することを確認
    expect(pdfViewerCount).toBeGreaterThan(0);
  });

  test('Should preserve filename after page reload', async ({ page }) => {
    // 一覧ページに移動
    await page.goto('http://localhost:5173/');

    // 最初の図面カードが表示されるまで待機
    await page.waitForSelector('[data-testid="drawing-card"]', { timeout: 10000 });

    // 最初の図面をクリック
    const firstCard = page.locator('[data-testid="drawing-card"]').first();
    await firstCard.click();

    // 編集画面が読み込まれるまで待機
    await page.waitForURL(/\/edit\/.+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // ファイル名入力フィールドを取得
    const filenameInput = page.locator('input[name="pdf_filename"]');
    await expect(filenameInput).toBeVisible({ timeout: 5000 });

    // 新しいファイル名を生成
    const timestamp = Date.now();
    const newFilename = `persistent-test-${timestamp}.pdf`;

    // ファイル名を変更して保存
    await filenameInput.fill('');
    await filenameInput.fill(newFilename);

    const saveButton = page.getByRole('button', { name: /保存|Save/i });
    await saveButton.click();

    // 保存成功を待機
    await page.waitForSelector('text=/保存しました|Saved/', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // 現在のURLを取得
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    // ページをリロード
    await page.reload();
    await page.waitForLoadState('networkidle');

    // リロード後のファイル名を確認
    const filenameAfterReload = await filenameInput.inputValue();
    console.log('Filename after reload:', filenameAfterReload);

    // ファイル名が保持されていることを確認
    expect(filenameAfterReload).toBe(newFilename);

    // スクリーンショット撮影
    await page.screenshot({
      path: 'frontend/screenshots/filename-after-reload.png',
      fullPage: true
    });
  });
});
