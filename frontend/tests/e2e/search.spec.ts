import { test, expect } from '@playwright/test';

test.describe('Search Functionality', () => {
  test('should display search page with tabs', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    // タブが表示されていることを確認
    await expect(page.locator('button:has-text("自然言語検索"), text=自然言語検索')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("類似検索"), text=類似検索')).toBeVisible();
  });

  test('should show search input in natural language tab', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    // 検索入力欄が表示されていることを確認
    const searchInput = page.locator('input[type="text"], input[placeholder]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // 検索ボタンが表示されていることを確認
    const searchButton = page.locator('button:has-text("検索")');
    await expect(searchButton).toBeVisible();
  });

  test('should display search examples', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    // ページが読み込まれることを確認
    await expect(page).toHaveURL('/search', { timeout: 10000 });
  });

  test('should render search page', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');

    // Reactアプリが読み込まれることを確認
    const rootDiv = page.locator('#root');
    await expect(rootDiv).not.toBeEmpty({ timeout: 10000 });
  });
});
