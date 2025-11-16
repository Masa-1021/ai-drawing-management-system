/**
 * ファイル名編集・保存テスト
 * 新しいファイルをアップロードして、ファイル名を編集し、保存後に反映されることを確認
 */

import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Filename Save Tests', () => {
  test('Should upload new file and edit filename successfully', async ({ page }) => {
    // アップロードページに移動
    await page.goto('http://localhost:5173/upload');
    await page.waitForLoadState('networkidle');

    // ファイル選択
    const fileInput = page.locator('input[type="file"]');

    // テスト用PDFファイルのパスを指定（既存のものを使用）
    const testFilePath = path.join(process.cwd(), '..', 'pdf', '11160217.pdf');

    await fileInput.setInputFiles(testFilePath);

    // アップロード実行（AI解析なし）
    const uploadButton = page.getByRole('button', { name: /アップロード|Upload/i });
    await uploadButton.click();

    // アップロード完了を待機
    await page.waitForSelector('text=/アップロード完了|Upload complete/', { timeout: 10000 });

    // 一覧ページに移動
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');

    // 最初の図面（今アップロードしたもの）をクリック
    const firstCard = page.locator('[class*="card"]').first();
    await firstCard.click();

    // 編集ページが表示されるまで待機
    await page.waitForURL(/\/edit\/.+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // ファイル名入力フィールドを取得
    const filenameInput = page.locator('input').filter({ hasText: /test_simple/ }).or(
      page.locator('input[type="text"]').first()
    );

    // 入力フィールドが見つからない場合、すべてのinputをログ出力
    const allInputs = await page.locator('input[type="text"]').all();
    console.log(`Found ${allInputs.length} text inputs`);

    for (let i = 0; i < allInputs.length; i++) {
      const value = await allInputs[i].inputValue();
      console.log(`Input ${i}: ${value}`);
    }

    // ファイル名を含む入力フィールドを特定
    let targetInput = null;
    for (const input of allInputs) {
      const value = await input.inputValue();
      if (value.includes('.pdf')) {
        targetInput = input;
        console.log('Found filename input with value:', value);
        break;
      }
    }

    if (!targetInput) {
      throw new Error('Filename input not found');
    }

    // 現在のファイル名を取得
    const originalFilename = await targetInput.inputValue();
    console.log('Original filename:', originalFilename);

    // 新しいファイル名を生成
    const timestamp = Date.now();
    const newFilename = `edited-test-${timestamp}.pdf`;
    console.log('New filename:', newFilename);

    // ファイル名を変更
    await targetInput.fill('');
    await targetInput.fill(newFilename);

    // 入力値が正しく設定されたことを確認
    const inputValue = await targetInput.inputValue();
    console.log('Input value after fill:', inputValue);
    expect(inputValue).toBe(newFilename);

    // スクリーンショット（変更前）
    await page.screenshot({
      path: 'frontend/screenshots/before-save.png',
      fullPage: true
    });

    // 保存ボタンをクリック
    const saveButton = page.getByRole('button', { name: /保存|Save/i });
    await saveButton.click();

    // 保存成功のトーストメッセージを待機
    await page.waitForSelector('text=/保存しました|Saved/', { timeout: 5000 });
    console.log('Save successful');

    // 少し待機してデータが更新されることを確認
    await page.waitForTimeout(1500);

    // スクリーンショット（保存後）
    await page.screenshot({
      path: 'frontend/screenshots/after-save.png',
      fullPage: true
    });

    // フォームの値が新しいファイル名に更新されていることを確認
    const updatedFilename = await targetInput.inputValue();
    console.log('Updated filename:', updatedFilename);

    // アサーション
    expect(updatedFilename).toBe(newFilename);

    // PDFプレビューが表示されていることを確認
    const pdfViewer = page.locator('canvas, iframe, object[type="application/pdf"]');
    const pdfViewerCount = await pdfViewer.count();
    console.log('PDF viewer elements found:', pdfViewerCount);
    expect(pdfViewerCount).toBeGreaterThan(0);

    console.log('✓ Test passed: Filename was updated successfully');
  });

  test('Should preserve edited filename after page reload', async ({ page }) => {
    // 一覧ページに移動
    await page.goto('http://localhost:5173/');
    await page.waitForLoadState('networkidle');

    // 最初の図面をクリック
    const firstCard = page.locator('[class*="card"]').first();
    await firstCard.click();

    // 編集ページが表示されるまで待機
    await page.waitForURL(/\/edit\/.+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // ファイル名入力フィールドを取得
    const allInputs = await page.locator('input[type="text"]').all();
    let targetInput = null;

    for (const input of allInputs) {
      const value = await input.inputValue();
      if (value.includes('.pdf')) {
        targetInput = input;
        break;
      }
    }

    if (!targetInput) {
      throw new Error('Filename input not found');
    }

    // 新しいファイル名を生成
    const timestamp = Date.now();
    const newFilename = `reload-test-${timestamp}.pdf`;

    // ファイル名を変更して保存
    await targetInput.fill('');
    await targetInput.fill(newFilename);

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

    // リロード後のファイル名入力フィールドを再取得
    const reloadedInputs = await page.locator('input[type="text"]').all();
    let reloadedInput = null;

    for (const input of reloadedInputs) {
      const value = await input.inputValue();
      if (value.includes('.pdf')) {
        reloadedInput = input;
        break;
      }
    }

    if (!reloadedInput) {
      throw new Error('Filename input not found after reload');
    }

    // リロード後のファイル名を確認
    const filenameAfterReload = await reloadedInput.inputValue();
    console.log('Filename after reload:', filenameAfterReload);

    // スクリーンショット
    await page.screenshot({
      path: 'frontend/screenshots/after-reload.png',
      fullPage: true
    });

    // ファイル名が保持されていることを確認
    expect(filenameAfterReload).toBe(newFilename);

    console.log('✓ Test passed: Filename was preserved after reload');
  });
});
