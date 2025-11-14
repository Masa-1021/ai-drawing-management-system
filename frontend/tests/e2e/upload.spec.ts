import { test, expect } from '@playwright/test';

test.describe('Upload Page', () => {
  test('should display upload page', async ({ page }) => {
    await page.goto('/upload');
    await page.waitForLoadState('networkidle');

    // ページが読み込まれることを確認
    await expect(page).toHaveURL('/upload', { timeout: 10000 });
  });

  test('should render React app', async ({ page }) => {
    await page.goto('/upload');
    await page.waitForLoadState('networkidle');

    // Reactアプリが読み込まれることを確認
    const rootDiv = page.locator('#root');
    await expect(rootDiv).not.toBeEmpty({ timeout: 10000 });
  });

  test('should load page content', async ({ page }) => {
    await page.goto('/upload');
    await page.waitForLoadState('networkidle');

    // ページコンテンツが読み込まれることを確認
    const rootDiv = page.locator('#root');
    await expect(rootDiv).toBeVisible({ timeout: 10000 });
  });
});
