import { test, expect } from '@playwright/test';

test.describe('Basic Functionality', () => {
  test('should load the application', async ({ page }) => {
    // アプリケーションにアクセス
    await page.goto('/');

    // ページタイトルを確認
    await expect(page).toHaveTitle(/CAD図面管理システム/);
  });

  test('should have root element', async ({ page }) => {
    await page.goto('/');

    // rootエレメントが存在することを確認
    const root = page.locator('#root');
    await expect(root).toBeAttached();
  });

  test('should load without JavaScript errors', async ({ page }) => {
    const errors: string[] = [];

    // コンソールエラーをキャプチャ
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 重大なエラーがないことを確認（Warning は許容）
    const criticalErrors = errors.filter(e =>
      !e.includes('Warning') &&
      !e.includes('DevTools')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('should make API request to backend', async ({ page }) => {
    // APIリクエストをインターセプト
    let apiCalled = false;
    page.on('request', request => {
      if (request.url().includes('localhost:8000')) {
        apiCalled = true;
      }
    });

    await page.goto('/list');
    await page.waitForTimeout(2000);

    // バックエンドAPIが呼ばれたことを確認
    expect(apiCalled).toBe(true);
  });
});
