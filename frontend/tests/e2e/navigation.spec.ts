import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should navigate between pages', async ({ page }) => {
    // ホームページにアクセス
    await page.goto('/');

    // Reactアプリが読み込まれるまで待機
    await page.waitForLoadState('networkidle');

    // アップロードページにリダイレクトされることを確認
    await expect(page).toHaveURL('/upload', { timeout: 10000 });

    // 一覧ページに移動
    await page.click('text=一覧');
    await expect(page).toHaveURL('/list');

    // 検索ページに移動
    await page.click('text=検索');
    await expect(page).toHaveURL('/search');

    // アップロードページに戻る
    await page.click('text=アップロード');
    await expect(page).toHaveURL('/upload');
  });

  test('should display header with navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // ナビゲーションリンクが存在することを確認
    await expect(page.locator('a:has-text("アップロード"), button:has-text("アップロード")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a:has-text("一覧"), button:has-text("一覧")')).toBeVisible();
    await expect(page.locator('a:has-text("検索"), button:has-text("検索")')).toBeVisible();
  });
});
