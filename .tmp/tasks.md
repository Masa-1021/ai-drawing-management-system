# タスクリスト - 摘要表詳細ページ機能拡張

## 概要

- 総タスク数: 12タスク（3フェーズ）
- 優先度: 高
- 依存関係: Phase 1 → Phase 2 → Phase 3

## 機能概要

1. **図面ツリータブ追加**: assembly/unit のみを階層表示
2. **Webリンク機能**: 部品(part)タイプに外部URLを設定可能
3. **タブ名称変更**: 「部品リスト」→「部品・図面一覧」

---

## Phase 1: バックエンド実装

### Task 1.1: データベースマイグレーション ⏳ TODO

- [ ] `backend/migrations/add_web_link_column.py` 作成
- [ ] spec_sheet_items テーブルに web_link カラム追加
- [ ] Docker コンテナ内でマイグレーション実行
- **完了条件**: DBに web_link カラムが追加される
- **依存**: なし

### Task 1.2: モデル・スキーマ更新 ⏳ TODO

- [ ] `backend/app/models/spec_sheet_item.py` に web_link カラム追加
- [ ] `backend/app/schemas/spec_sheet.py` に以下を追加:
  - SpecSheetItemBase に web_link フィールド
  - UpdateWebLinkRequest スキーマ
  - UpdateWebLinkResponse スキーマ
- **完了条件**: モデルとスキーマが正常にインポート可能
- **依存**: Task 1.1

### Task 1.3: Webリンク更新API実装 ⏳ TODO

- [ ] `backend/app/api/v1/spec_sheets.py` に PATCH エンドポイント追加
  - `PATCH /{spec_sheet_id}/items/{item_id}/web-link`
- [ ] part_type が 'part' の場合のみ更新可能とするバリデーション
- [ ] URL形式バリデーション (http/https)
- [ ] APIテスト (curl/Swagger)
- **完了条件**: エンドポイントが正常に動作
- **依存**: Task 1.2

---

## Phase 2: フロントエンド型・API層

### Task 2.1: 型定義更新 ⏳ TODO

- [ ] `frontend/src/types/spec-sheet.ts` に web_link フィールド追加
- [ ] UpdateWebLinkRequest 型追加
- [ ] UpdateWebLinkResponse 型追加
- **完了条件**: TypeScript型エラーなし
- **依存**: Task 1.3

### Task 2.2: APIクライアント・フック追加 ⏳ TODO

- [ ] `frontend/src/api/spec-sheets.ts` に updateItemWebLink 関数追加
- [ ] `frontend/src/hooks/useSpecSheets.ts` に useUpdateItemWebLink フック追加
- **完了条件**: フックが正常に動作
- **依存**: Task 2.1

### Task 2.3: MUI TreeView パッケージ追加 ⏳ TODO

- [ ] `npm install @mui/x-tree-view` 実行
- [ ] package.json に追加されることを確認
- **完了条件**: パッケージがインストールされる
- **依存**: なし

---

## Phase 3: フロントエンドUI実装

### Task 3.1: タブ構成変更 ⏳ TODO

- [ ] SpecSheetDetailPage.tsx のタブを3タブに変更
  - 「部品・図面一覧」(index=0)
  - 「図面ツリー」(index=1)
  - 「改定履歴」(index=2)
- [ ] アイコン追加: SchemaIcon (@mui/icons-material)
- [ ] TabPanel の index 調整
- **完了条件**: 3つのタブが正しく表示される
- **依存**: Task 2.3

### Task 3.2: DrawingTreeTab コンポーネント作成 ⏳ TODO

- [ ] `frontend/src/components/DrawingTreeTab.tsx` 新規作成
- [ ] assembly/unit アイテムのフィルタリング
- [ ] ツリー構造構築ロジック（parent_item_id による親子関係）
- [ ] SimpleTreeView + TreeItem でレンダリング
- [ ] 展開/折りたたみボタン
- [ ] 紐づけ状態表示（Chip）
- [ ] 紐づけ・解除・確認ボタン
- [ ] SpecSheetDetailPage.tsx にインポート・配置
- **完了条件**: 図面ツリーが階層表示される
- **依存**: Task 3.1

### Task 3.3: WebLinkDialog コンポーネント作成 ⏳ TODO

- [ ] `frontend/src/components/WebLinkDialog.tsx` 新規作成
- [ ] URL入力フィールド
- [ ] バリデーション（http/https）
- [ ] 保存・削除・キャンセルボタン
- [ ] useUpdateItemWebLink フックの使用
- [ ] toast通知
- **完了条件**: Webリンクの設定・編集・削除が可能
- **依存**: Task 2.2

### Task 3.4: 部品・図面一覧タブの列変更 ⏳ TODO

- [ ] SpecSheetDetailPage.tsx の columns を変更
- [ ] 「図面」列の名前を「図面/リンク」に変更
- [ ] renderCell ロジック変更:
  - assembly/unit: 図面紐づけボタン（現状維持）
  - part: Webリンクボタン（OpenInNewIcon, AddLinkIcon）
  - purchased: 非表示
- [ ] WebLinkDialog の状態管理追加
- [ ] アイコンインポート追加: OpenInNewIcon, AddLinkIcon
- **完了条件**: 種別に応じた適切なボタンが表示される
- **依存**: Task 3.3

### Task 3.5: 統合・動作確認 ⏳ TODO

- [ ] npm run typecheck 実行・エラー修正
- [ ] npm run lint 実行・エラー修正
- [ ] Docker環境で統合テスト
  - 図面ツリータブの表示確認
  - 紐づけ済み図面の「確認」ボタン動作
  - 未紐づけ図面の「紐づけ」ボタン動作
  - 部品のWebリンク設定・編集・削除
  - 購入品に何も表示されないこと
- **完了条件**: 全機能が正常に動作
- **依存**: Task 3.4

---

## 実装順序

```
Phase 1 (バックエンド):
┌─────────────────┐
│ Task 1.1        │
│ DBマイグレーション │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Task 1.2        │
│ モデル・スキーマ  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Task 1.3        │
│ API実装         │
└────────┬────────┘
         │
         ▼
Phase 2 (フロントエンド型・API):
┌─────────────────┐     ┌─────────────────┐
│ Task 2.1        │     │ Task 2.3        │
│ 型定義          │     │ TreeViewパッケージ│
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Task 2.2        │
│ APIクライアント  │
└────────┬────────┘
         │
         ▼
Phase 3 (フロントエンドUI):
┌─────────────────┐
│ Task 3.1        │
│ タブ構成変更     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Task 3.2        │     │ Task 3.3        │
│ DrawingTreeTab  │     │ WebLinkDialog   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
┌─────────────────┐
│ Task 3.4        │
│ 列変更          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Task 3.5        │
│ 統合テスト      │
└─────────────────┘
```

---

## ファイル一覧

### 新規作成
| ファイル | 説明 |
|---------|------|
| backend/migrations/add_web_link_column.py | DBマイグレーション |
| frontend/src/components/DrawingTreeTab.tsx | 図面ツリータブ |
| frontend/src/components/WebLinkDialog.tsx | Webリンク編集ダイアログ |

### 変更
| ファイル | 変更内容 |
|---------|----------|
| backend/app/models/spec_sheet_item.py | web_link カラム追加 |
| backend/app/schemas/spec_sheet.py | web_link フィールド、新規スキーマ追加 |
| backend/app/api/v1/spec_sheets.py | PATCH エンドポイント追加 |
| frontend/src/types/spec-sheet.ts | web_link 型追加 |
| frontend/src/api/spec-sheets.ts | updateItemWebLink 関数追加 |
| frontend/src/hooks/useSpecSheets.ts | useUpdateItemWebLink フック追加 |
| frontend/src/pages/SpecSheetDetailPage.tsx | タブ構成変更、列変更、ダイアログ統合 |
| frontend/package.json | @mui/x-tree-view 追加 |

---

## チェックリスト

### 受け入れ基準

- [ ] 摘要表詳細ページで3タブが表示される
- [ ] 「部品・図面一覧」タブで全アイテムが表示される
- [ ] 「図面ツリー」タブでassembly/unitのみが階層表示される
- [ ] ツリーの展開/折りたたみが動作する
- [ ] 図面紐づけ済みアイテムから編集ページに遷移できる
- [ ] 未紐づけアイテムから図面選択ダイアログを開ける
- [ ] 部品(part)タイプにWebリンクを設定できる
- [ ] 設定済みWebリンクをクリックで外部サイトが開く
- [ ] Webリンクの編集・削除ができる
- [ ] 購入品(purchased)タイプには何も表示されない

---

**作成日**: 2025-12-15
**作成者**: Claude Code
**バージョン**: 1.0
