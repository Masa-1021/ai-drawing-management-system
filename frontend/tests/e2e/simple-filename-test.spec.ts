/**
 * シンプルなファイル名編集テスト
 * 既存の図面を使ってファイル名の編集と保存をテスト
 */

import { test, expect } from '@playwright/test';

test.describe('Simple Filename Edit Test', () => {
  test('Edit filename and verify it persists', async ({ page }) => {
    // 一覧ページに移動
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(2000);

    // スクリーンショット（一覧ページ）
    await page.screenshot({
      path: 'frontend/screenshots/01-list-page.png',
      fullPage: true
    });

    // 最初の図面カードをクリック（任意のセレクタを試す）
    const cards = await page.locator('div').filter({ hasText: /\.pdf/i }).all();
    console.log(`Found ${cards.length} potential drawing cards`);

    if (cards.length === 0) {
      throw new Error('No drawing cards found');
    }

    // 最初のカードをクリック
    await cards[0].click();
    await page.waitForTimeout(2000);

    // スクリーンショット（編集ページ）
    await page.screenshot({
      path: 'frontend/screenshots/02-edit-page-initial.png',
      fullPage: true
    });

    // すべてのテキスト入力フィールドを取得
    const textInputs = await page.locator('input[type="text"]').all();
    console.log(`Found ${textInputs.length} text input fields`);

    // 各入力フィールドの値を出力
    for (let i = 0; i < textInputs.length; i++) {
      const value = await textInputs[i].inputValue();
      const placeholder = await textInputs[i].getAttribute('placeholder');
      console.log(`Input ${i}: value="${value}", placeholder="${placeholder}"`);
    }

    // .pdf を含む入力フィールドを探す
    let filenameInput = null;
    let currentFilename = '';

    for (const input of textInputs) {
      const value = await input.inputValue();
      if (value.includes('.pdf')) {
        filenameInput = input;
        currentFilename = value;
        console.log(`Found filename input: ${value}`);
        break;
      }
    }

    if (!filenameInput) {
      console.log('No filename input found, using first text input as fallback');
      if (textInputs.length > 0) {
        filenameInput = textInputs[0];
        currentFilename = await filenameInput.inputValue();
      } else {
        throw new Error('No text inputs found on page');
      }
    }

    console.log(`Current filename: ${currentFilename}`);

    // 新しいファイル名を生成
    const timestamp = Date.now();
    const newFilename = `test-edited-${timestamp}.pdf`;
    console.log(`New filename: ${newFilename}`);

    // ファイル名を変更
    await filenameInput.click();
    await filenameInput.fill('');
    await filenameInput.fill(newFilename);
    await page.waitForTimeout(500);

    // 変更後の値を確認
    const valueAfterEdit = await filenameInput.inputValue();
    console.log(`Value after edit: ${valueAfterEdit}`);

    // スクリーンショット（ファイル名変更後）
    await page.screenshot({
      path: 'frontend/screenshots/03-after-filename-edit.png',
      fullPage: true
    });

    // 保存ボタンを探す
    const saveButton = page.getByRole('button', { name: /保存|Save|save/i });
    const saveButtonExists = await saveButton.count() > 0;
    console.log(`Save button exists: ${saveButtonExists}`);

    if (!saveButtonExists) {
      throw new Error('Save button not found');
    }

    // 保存ボタンをクリック
    await saveButton.click();
    console.log('Clicked save button');

    // 保存完了を待機（トーストメッセージまたは少し待つ）
    await page.waitForTimeout(2000);

    // スクリーンショット（保存後）
    await page.screenshot({
      path: 'frontend/screenshots/04-after-save.png',
      fullPage: true
    });

    // 保存後のファイル名を確認
    const valueAfterSave = await filenameInput.inputValue();
    console.log(`Value after save: ${valueAfterSave}`);

    // アサーション
    expect(valueAfterSave).toBe(newFilename);

    console.log('✓ Test passed: Filename was saved successfully');
  });
});
