/**
 * メーカー検索サイト設定
 *
 * 購入品のWebリンク設定時に使用するメーカー検索サイトの一覧
 */

export interface Manufacturer {
  /** メーカーID */
  id: string;
  /** メーカー名 */
  name: string;
  /** 検索サイトURL */
  searchUrl: string;
  /** ロゴ画像URL（オプション） */
  logoUrl?: string;
}

/**
 * 登録済みメーカー検索サイト一覧
 * 必要に応じてメーカーを追加してください
 */
export const MANUFACTURERS: Manufacturer[] = [
  {
    id: 'misumi',
    name: 'MISUMI',
    searchUrl: 'https://jp.misumi-ec.com/',
  },
  {
    id: 'monotaro',
    name: 'MonotaRO',
    searchUrl: 'https://www.monotaro.com/',
  },
  {
    id: 'thk',
    name: 'THK',
    searchUrl: 'https://www.thk.com/jp/ja/',
  },
  {
    id: 'nsk',
    name: 'NSK',
    searchUrl: 'https://www.nsk.com/jp/',
  },
  {
    id: 'smc',
    name: 'SMC',
    searchUrl: 'https://www.smcworld.com/ja-jp/',
  },
  {
    id: 'ckd',
    name: 'CKD',
    searchUrl: 'https://www.ckd.co.jp/',
  },
  {
    id: 'omron',
    name: 'OMRON',
    searchUrl: 'https://www.fa.omron.co.jp/',
  },
  {
    id: 'keyence',
    name: 'KEYENCE',
    searchUrl: 'https://www.keyence.co.jp/',
  },
  {
    id: 'oriental_motor',
    name: 'オリエンタルモーター',
    searchUrl: 'https://www.orientalmotor.co.jp/',
  },
  {
    id: 'iko',
    name: 'IKO',
    searchUrl: 'https://www.ikont.co.jp/',
  },
];

/**
 * メーカーIDからメーカー情報を取得
 */
export const getManufacturerById = (id: string): Manufacturer | undefined => {
  return MANUFACTURERS.find((m) => m.id === id);
};

/**
 * URLからメーカーを推定
 */
export const detectManufacturerFromUrl = (url: string): Manufacturer | undefined => {
  const lowerUrl = url.toLowerCase();
  return MANUFACTURERS.find((m) => lowerUrl.includes(m.id) || lowerUrl.includes(m.searchUrl.replace('https://', '').split('/')[0]));
};
