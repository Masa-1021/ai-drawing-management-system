import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5175';
const API_URL = 'http://localhost:8000';

test.describe('SSO Login Flow', () => {
  test('should show AWS connection error and SSO login button', async ({ page }) => {
    // Upload画面にアクセス
    await page.goto(`${BASE_URL}/upload`);

    // ページの読み込み待機
    await page.waitForLoadState('networkidle');

    // スクリーンショット
    await page.screenshot({ path: 'test-results/upload-page-initial.png' });

    // AI接続エラーメッセージを確認
    const errorMessage = page.locator('text=AI接続エラー');

    // エラーメッセージまたは正常メッセージのいずれかが表示されるまで待機
    const hasError = await errorMessage.isVisible().catch(() => false);

    if (hasError) {
      console.log('AWS接続エラーが表示されています');

      // aws sso loginボタンを確認
      const ssoButton = page.locator('button:has-text("aws sso login")');
      await expect(ssoButton).toBeVisible();

      // 再確認ボタンを確認
      const recheckButton = page.locator('button:has-text("再確認")');
      await expect(recheckButton).toBeVisible();

      await page.screenshot({ path: 'test-results/upload-page-error.png' });

      // SSOボタンをクリック（新しいタブが開くのをキャッチ）
      const [popup] = await Promise.all([
        page.waitForEvent('popup', { timeout: 10000 }).catch(() => null),
        ssoButton.click(),
      ]);

      if (popup) {
        console.log('認証ページが開きました:', popup.url());
        await popup.screenshot({ path: 'test-results/sso-auth-page.png' });

        // 認証URLがAWS SSOのURLであることを確認
        expect(popup.url()).toContain('awsapps.com');

        await popup.close();
      } else {
        console.log('ポップアップがブロックされた可能性があります');
      }

      // トースト通知を確認
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'test-results/upload-page-after-click.png' });

    } else {
      // 正常接続の場合
      const okMessage = page.locator('text=AI接続は正常です');
      const isOk = await okMessage.isVisible().catch(() => false);

      if (isOk) {
        console.log('AI接続は正常です');
        await page.screenshot({ path: 'test-results/upload-page-ok.png' });
      } else {
        console.log('接続状態を確認中...');
        await page.screenshot({ path: 'test-results/upload-page-checking.png' });
      }
    }
  });

  test('should verify SSO API endpoints work', async ({ request }) => {
    // start-auth APIをテスト
    const startResponse = await request.post(`${API_URL}/api/v1/aws-sso/start-auth`);
    expect(startResponse.ok()).toBeTruthy();

    const startData = await startResponse.json();
    console.log('start-auth response:', JSON.stringify(startData, null, 2));

    expect(startData.status).toBe('ok');
    expect(startData.verification_uri).toBeTruthy();
    expect(startData.device_code).toBeTruthy();
    expect(startData.client_id).toBeTruthy();
    expect(startData.client_secret).toBeTruthy();

    // complete-auth APIをテスト（認証待ちなのでpendingが返る）
    const completeResponse = await request.post(`${API_URL}/api/v1/aws-sso/complete-auth`, {
      form: {
        device_code: startData.device_code,
        client_id: startData.client_id,
        client_secret: startData.client_secret,
      },
    });

    expect(completeResponse.ok()).toBeTruthy();

    const completeData = await completeResponse.json();
    console.log('complete-auth response:', JSON.stringify(completeData, null, 2));

    // 認証待ちなのでpendingまたはerror
    expect(['pending', 'error', 'ok']).toContain(completeData.status);
  });
});
