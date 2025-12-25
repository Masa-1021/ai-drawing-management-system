# 設計書: 摘要表詳細ページの機能拡張

## 1. 概要

本設計書は、摘要表詳細ページに「図面ツリー」タブを追加し、部品タイプの「Webリンク」機能を実装するための技術設計を記述する。

## 2. バックエンド設計

### 2.1 データベーススキーマ変更

#### spec_sheet_items テーブル
```sql
ALTER TABLE spec_sheet_items ADD COLUMN web_link VARCHAR(2048);
```

| カラム名 | 型 | 説明 |
|---------|-----|------|
| web_link | VARCHAR(2048) | 外部Webリンク（NULL許容、part タイプのみ使用） |

### 2.2 モデル変更

#### backend/app/models/spec_sheet_item.py
```python
# 追加するカラム
web_link = Column(String(2048), nullable=True)  # 外部Webリンク
```

### 2.3 スキーマ変更

#### backend/app/schemas/spec_sheet.py

**SpecSheetItemBase の変更:**
```python
class SpecSheetItemBase(BaseModel):
    # ... 既存フィールド ...
    web_link: Optional[str] = Field(None, max_length=2048, description="外部Webリンク（部品タイプのみ）")
```

**新規スキーマ:**
```python
class UpdateWebLinkRequest(BaseModel):
    """Webリンク更新リクエスト"""
    web_link: Optional[str] = Field(None, max_length=2048, description="外部WebリンクURL")

    @field_validator('web_link')
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == '':
            return None
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URLはhttp://またはhttps://で始まる必要があります')
        return v

class UpdateWebLinkResponse(BaseModel):
    """Webリンク更新レスポンス"""
    id: str
    web_link: Optional[str]
```

### 2.4 API エンドポイント

#### PATCH /api/v1/spec-sheets/{spec_sheet_id}/items/{item_id}/web-link

**リクエスト:**
```json
{
  "web_link": "https://example.com/product/123"
}
```

**レスポンス:**
```json
{
  "id": "item-uuid",
  "web_link": "https://example.com/product/123"
}
```

**バリデーション:**
- item の `part_type` が `part` であること
- URL が `http://` または `https://` で始まること
- 空文字または null の場合はリンクを削除

**実装場所:** `backend/app/api/v1/spec_sheets.py`

```python
@router.patch("/{spec_sheet_id}/items/{item_id}/web-link")
async def update_item_web_link(
    spec_sheet_id: str,
    item_id: str,
    request: UpdateWebLinkRequest,
    db: Session = Depends(get_db)
) -> UpdateWebLinkResponse:
    """部品のWebリンクを更新"""
    item = db.query(SpecSheetItem).filter(
        SpecSheetItem.id == item_id,
        SpecSheetItem.spec_sheet_id == spec_sheet_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="部品が見つかりません")

    if item.part_type != 'part':
        raise HTTPException(
            status_code=400,
            detail="Webリンクは部品タイプのみ設定可能です"
        )

    item.web_link = request.web_link
    db.commit()

    return UpdateWebLinkResponse(id=item.id, web_link=item.web_link)
```

### 2.5 マイグレーション

**backend/migrations/add_web_link_column.py**
```python
"""spec_sheet_items に web_link カラムを追加"""
import sqlite3
from pathlib import Path

def migrate():
    db_path = Path(__file__).parent.parent / "storage" / "database.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # カラムが存在するか確認
    cursor.execute("PRAGMA table_info(spec_sheet_items)")
    columns = [col[1] for col in cursor.fetchall()]

    if 'web_link' not in columns:
        cursor.execute("""
            ALTER TABLE spec_sheet_items
            ADD COLUMN web_link VARCHAR(2048)
        """)
        conn.commit()
        print("web_link カラムを追加しました")
    else:
        print("web_link カラムは既に存在します")

    conn.close()

if __name__ == "__main__":
    migrate()
```

## 3. フロントエンド設計

### 3.1 型定義の変更

#### frontend/src/types/spec-sheet.ts
```typescript
export interface SpecSheetItem {
  // ... 既存フィールド ...
  web_link?: string | null;  // 追加
}

// 新規追加
export interface UpdateWebLinkRequest {
  web_link: string | null;
}

export interface UpdateWebLinkResponse {
  id: string;
  web_link: string | null;
}
```

### 3.2 API クライアントの変更

#### frontend/src/api/spec-sheets.ts
```typescript
// 新規追加
export const updateItemWebLink = async (
  specSheetId: string,
  itemId: string,
  webLink: string | null
): Promise<UpdateWebLinkResponse> => {
  const response = await client.patch<UpdateWebLinkResponse>(
    `/v1/spec-sheets/${specSheetId}/items/${itemId}/web-link`,
    { web_link: webLink }
  );
  return response.data;
};
```

### 3.3 カスタムフック

#### frontend/src/hooks/useSpecSheets.ts
```typescript
// 新規追加
export const useUpdateItemWebLink = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ specSheetId, itemId, webLink }: {
      specSheetId: string;
      itemId: string;
      webLink: string | null;
    }) => updateItemWebLink(specSheetId, itemId, webLink),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['spec-sheet', variables.specSheetId]
      });
    },
  });
};
```

### 3.4 コンポーネント設計

#### 3.4.1 タブ構成の変更

**SpecSheetDetailPage.tsx の変更点:**

```typescript
// タブの状態管理
const [tabValue, setTabValue] = useState(0);

// タブ定義
<Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
  <Tab icon={<AccountTreeIcon />} label="部品・図面一覧" />
  <Tab icon={<SchemaIcon />} label="図面ツリー" />
  <Tab icon={<HistoryIcon />} label="改定履歴" />
</Tabs>
```

#### 3.4.2 図面ツリータブコンポーネント

**新規ファイル: frontend/src/components/DrawingTreeTab.tsx**

```typescript
interface DrawingTreeTabProps {
  items: SpecSheetItem[];
  specSheetId: string;
  onRefetch: () => void;
}

export const DrawingTreeTab: React.FC<DrawingTreeTabProps> = ({
  items,
  specSheetId,
  onRefetch,
}) => {
  // assembly と unit のみフィルタ
  const treeItems = useMemo(() => {
    return items.filter(
      item => item.part_type === 'assembly' || item.part_type === 'unit'
    );
  }, [items]);

  // ツリー構造を構築
  const treeData = useMemo(() => {
    const roots: TreeNode[] = [];
    const itemMap = new Map<string, TreeNode>();

    // まず全アイテムをノードに変換
    treeItems.forEach(item => {
      itemMap.set(item.id, {
        id: item.id,
        item,
        children: [],
      });
    });

    // 親子関係を構築
    treeItems.forEach(item => {
      const node = itemMap.get(item.id)!;
      if (item.parent_item_id && itemMap.has(item.parent_item_id)) {
        itemMap.get(item.parent_item_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [treeItems]);

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button size="small" onClick={expandAll}>展開</Button>
        <Button size="small" onClick={collapseAll}>折りたたみ</Button>
      </Box>
      <SimpleTreeView
        expandedItems={expandedNodes}
        onExpandedItemsChange={handleExpandedChange}
      >
        {treeData.map(node => renderTreeNode(node))}
      </SimpleTreeView>
    </Box>
  );
};
```

**ツリーノードのレンダリング:**
```typescript
const renderTreeNode = (node: TreeNode) => {
  const { item } = node;
  const isLinked = !!item.linked_drawing_id;

  return (
    <TreeItem
      key={item.id}
      itemId={item.id}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
          <Chip
            label={item.part_type === 'assembly' ? '組図' : 'ユニット'}
            size="small"
            variant="outlined"
          />
          <Typography variant="body2" sx={{ flex: 1 }}>
            {item.part_name || '-'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {item.drawing_number || '-'}
          </Typography>
          {isLinked ? (
            <>
              <Chip label="紐づけ済" size="small" color="success" />
              <Tooltip title="図面を確認">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/edit/${item.linked_drawing_id}`);
                  }}
                >
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="紐づけ解除">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnlink(item);
                  }}
                >
                  <LinkOffIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <>
              <Chip label="未紐づけ" size="small" color="warning" />
              <Tooltip title="図面を紐づける">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDrawingSelect(item);
                  }}
                >
                  <LinkIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      }
    >
      {node.children.map(child => renderTreeNode(child))}
    </TreeItem>
  );
};
```

#### 3.4.3 部品・図面一覧タブの「図面/リンク」列の変更

**SpecSheetDetailPage.tsx の columns 変更:**

```typescript
{
  field: 'drawing_link',
  headerName: '図面/リンク',
  width: 140,
  align: 'center',
  headerAlign: 'center',
  sortable: false,
  filterable: false,
  renderCell: (params: GridRenderCellParams<SpecSheetItem>) => {
    const item = params.row;

    // 組図・ユニット: 図面紐づけ
    if (item.part_type === 'assembly' || item.part_type === 'unit') {
      if (item.linked_drawing_id) {
        return (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Tooltip title="図面を確認">
              <IconButton
                size="small"
                color="primary"
                onClick={() => navigate(`/edit/${item.linked_drawing_id}`)}
              >
                <CheckCircleIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="紐づけを解除">
              <IconButton
                size="small"
                onClick={() => handleUnlinkDrawing(item)}
              >
                <LinkOffIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      }
      return (
        <Tooltip title="図面を選択">
          <IconButton
            size="small"
            onClick={() => handleOpenDrawingSelectDialog(item)}
          >
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      );
    }

    // 部品: Webリンク
    if (item.part_type === 'part') {
      if (item.web_link) {
        return (
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Tooltip title="外部リンクを開く">
              <IconButton
                size="small"
                color="primary"
                onClick={() => window.open(item.web_link!, '_blank')}
              >
                <OpenInNewIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="リンクを編集">
              <IconButton
                size="small"
                onClick={() => handleOpenWebLinkDialog(item)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      }
      return (
        <Tooltip title="Webリンクを設定">
          <IconButton
            size="small"
            onClick={() => handleOpenWebLinkDialog(item)}
          >
            <AddLinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      );
    }

    // 購入品: 非表示
    return null;
  },
},
```

#### 3.4.4 Webリンク編集ダイアログ

**新規ファイル: frontend/src/components/WebLinkDialog.tsx**

```typescript
interface WebLinkDialogProps {
  open: boolean;
  onClose: () => void;
  item: SpecSheetItem | null;
  specSheetId: string;
  onSuccess: () => void;
}

export const WebLinkDialog: React.FC<WebLinkDialogProps> = ({
  open,
  onClose,
  item,
  specSheetId,
  onSuccess,
}) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { mutate: updateWebLink, isPending } = useUpdateItemWebLink();

  useEffect(() => {
    if (item) {
      setUrl(item.web_link || '');
      setError(null);
    }
  }, [item]);

  const handleSave = () => {
    // バリデーション
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      setError('URLはhttp://またはhttps://で始めてください');
      return;
    }

    updateWebLink(
      {
        specSheetId,
        itemId: item!.id,
        webLink: url || null,
      },
      {
        onSuccess: () => {
          toast.success('Webリンクを更新しました');
          onSuccess();
          onClose();
        },
        onError: (err) => {
          const message = err instanceof Error ? err.message : '更新に失敗しました';
          toast.error(message);
        },
      }
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Webリンクの設定
        {item && (
          <Typography variant="body2" color="text.secondary">
            {item.part_name}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="URL"
          type="url"
          fullWidth
          variant="outlined"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          error={!!error}
          helperText={error || 'メーカーサイトなどの外部URLを入力'}
          placeholder="https://example.com/product/123"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        {item?.web_link && (
          <Button
            color="error"
            onClick={() => {
              setUrl('');
              handleSave();
            }}
            disabled={isPending}
          >
            削除
          </Button>
        )}
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isPending}
        >
          {isPending ? <CircularProgress size={20} /> : '保存'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
```

### 3.5 必要なMUIアイコン追加

```typescript
import {
  OpenInNew as OpenInNewIcon,
  AddLink as AddLinkIcon,
  Schema as SchemaIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
```

### 3.6 MUI TreeView パッケージ

```bash
npm install @mui/x-tree-view
```

## 4. 実装の流れ

### Phase 1: バックエンド
1. マイグレーションスクリプト作成・実行
2. SpecSheetItem モデルに web_link カラム追加
3. スキーマに web_link フィールド追加
4. PATCH エンドポイント実装
5. APIテスト

### Phase 2: フロントエンド型・API
1. 型定義更新
2. APIクライアント関数追加
3. カスタムフック追加

### Phase 3: フロントエンドUI
1. タブ構成変更（名称変更 + 新規タブ追加）
2. DrawingTreeTab コンポーネント作成
3. WebLinkDialog コンポーネント作成
4. 部品・図面一覧の列変更
5. 統合テスト

## 5. ファイル一覧

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

## 6. 考慮事項

### 6.1 パフォーマンス
- ツリー構築は useMemo でメモ化
- 大量データ（100+アイテム）でも遅延なく表示

### 6.2 UX
- ツリーはデフォルトで全展開
- 展開状態は useState で管理（ページ内で維持）
- キーボードナビゲーション（MUI TreeView 標準機能）

### 6.3 エラーハンドリング
- URL形式バリデーション（フロント + バック）
- 不正なpart_typeへのWebリンク設定を拒否
- 存在しないアイテムへの操作を404で返す

---

**作成日**: 2025-12-15
**作成者**: Claude Code
**バージョン**: 1.0
