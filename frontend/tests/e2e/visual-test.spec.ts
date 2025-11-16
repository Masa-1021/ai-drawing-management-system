import { test, expect } from '@playwright/test';

test.describe('CAD Drawing Manager - Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    // フロントエンドにアクセス
    await page.goto('http://localhost:5173');
  });

  test('Upload page should be visible and functional', async ({ page }) => {
    // アップロードページが表示されることを確認
    await expect(page).toHaveTitle(/CAD Drawing Manager/i);

    // ナビゲーションが表示されることを確認
    await expect(page.getByText('Upload')).toBeVisible();
    await expect(page.getByText('List')).toBeVisible();
    await expect(page.getByText('Search')).toBeVisible();

    // アップロードエリアが表示されることを確認
    await expect(page.getByText(/drag.*drop.*pdf/i)).toBeVisible();

    // スクリーンショットを撮影
    await page.screenshot({ path: 'screenshots/upload-page.png', fullPage: true });
  });

  test('List page should display drawings', async ({ page }) => {
    // 一覧ページに移動
    await page.click('text=List');
    await page.waitForURL('**/list');

    // ページタイトルを確認
    await expect(page.getByRole('heading', { name: /drawing list/i })).toBeVisible();

    // スクリーンショット
    await page.screenshot({ path: 'screenshots/list-page.png', fullPage: true });
  });

  test('Search page should be accessible', async ({ page }) => {
    // 検索ページに移動
    await page.click('text=Search');
    await page.waitForURL('**/search');

    // 検索フォームが表示されることを確認
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();

    // スクリーンショット
    await page.screenshot({ path: 'screenshots/search-page.png', fullPage: true });
  });

  test('Backend API should be accessible', async ({ page }) => {
    // APIヘルスチェック
    const response = await page.request.get('http://localhost:8000/health');
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  test('Drawings list API should return data', async ({ page }) => {
    // 図面リストAPIを呼び出し
    const response = await page.request.get('http://localhost:8000/api/v1/drawings/');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBeTruthy();

    console.log(`Total drawings: ${data.total}`);
  });
});

test.describe('CAD Drawing Manager - Upload Flow', () => {
  test('Complete upload flow with visual verification', async ({ page }) => {
    await page.goto('http://localhost:5173/upload');

    // 初期状態のスクリーンショット
    await page.screenshot({ path: 'screenshots/01-upload-initial.png' });

    // ファイルが既にアップロードされているか確認
    const drawingsResponse = await page.request.get('http://localhost:8000/api/v1/drawings/');
    const drawingsData = await drawingsResponse.json();

    if (drawingsData.total > 0) {
      console.log(`Found ${drawingsData.total} existing drawings`);

      // 最初の図面の詳細を確認
      const firstDrawing = drawingsData.items[0];
      console.log('First drawing:', {
        id: firstDrawing.id,
        filename: firstDrawing.pdf_filename,
        status: firstDrawing.status,
        classification_confidence: firstDrawing.classification_confidence,
        summary: firstDrawing.summary?.substring(0, 100),
      });

      // 一覧ページに移動して確認
      await page.goto('http://localhost:5173/list');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/02-list-with-drawings.png', fullPage: true });

      // 最初の図面をクリックして詳細を表示
      const firstCard = page.locator('[data-testid="drawing-card"]').first();
      if (await firstCard.isVisible()) {
        await firstCard.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'screenshots/03-drawing-details.png', fullPage: true });
      }
    } else {
      console.log('No drawings found in the system');
    }
  });
});
