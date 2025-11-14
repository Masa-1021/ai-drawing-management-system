import { test, expect } from '@playwright/test';

test.describe('Drawing List Page', () => {
  test('should display list page', async ({ page }) => {
    await page.goto('/list');
    await page.waitForLoadState('networkidle');

    // ページが読み込まれることを確認
    await expect(page).toHaveURL('/list', { timeout: 10000 });
  });

  test('should load page content', async ({ page }) => {
    await page.goto('/list');
    await page.waitForLoadState('networkidle');

    // ページが読み込まれることを確認
    const rootDiv = page.locator('#root');
    await expect(rootDiv).toBeVisible({ timeout: 10000 });
  });

  test('should render React app', async ({ page }) => {
    await page.goto('/list');
    await page.waitForLoadState('networkidle');

    // Reactアプリが読み込まれることを確認
    const rootDiv = page.locator('#root');
    await expect(rootDiv).not.toBeEmpty({ timeout: 10000 });
  });
});
