# 詳細設計書 - AI駆動型CAD図面管理システム

## 1. アーキテクチャ概要

### 1.1 システム構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                         ブラウザ (Chrome/Edge/Firefox)           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              フロントエンド (React + TypeScript)           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │  │
│  │  │ Upload View │  │ Search View │  │  List View  │      │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │  │
│  │  ┌─────────────────────────────────────────────────┐      │  │
│  │  │        Drawing Editor View (2分割)              │      │  │
│  │  │  Left: Form (30%)  |  Right: PDF Viewer (70%)  │      │  │
│  │  └─────────────────────────────────────────────────┘      │  │
│  │                                                             │  │
│  │  State Management: Zustand/Jotai                          │  │
│  │  PDF Rendering: PDF.js                                     │  │
│  │  UI Components: shadcn/ui (Blue/White theme)              │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP/WebSocket
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              バックエンド (Python + FastAPI)                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    REST API Layer                          │  │
│  │  /api/upload  /api/drawings  /api/search  /api/locks      │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Service Layer                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │ Drawing      │  │  AI Analysis │  │  Search      │    │  │
│  │  │ Service      │  │  Service     │  │  Service     │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │  │
│  │  │ Lock         │  │  Config      │  │  File        │    │  │
│  │  │ Manager      │  │  Manager     │  │  Manager     │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    AI Integration Layer                    │  │
│  │  ┌────────────────────────────────────────────────────┐   │  │
│  │  │         Claude API Client (boto3/anthropic)        │   │  │
│  │  │  - 図枠抽出  - 風船抽出  - 分類  - 類似検索       │   │  │
│  │  │  - Retry Logic (exponential backoff)              │   │  │
│  │  │  - Confidence Score Extraction                    │   │  │
│  │  └────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Data Access Layer                         │  │
│  │  ┌──────────────────────────────────────────────────┐     │  │
│  │  │         SQLite Database (SQLAlchemy ORM)         │     │  │
│  │  │  - drawings  - balloons  - tags  - revisions     │     │  │
│  │  │  - edit_history  - locks                         │     │  │
│  │  └──────────────────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                    ローカルストレージ                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ./storage/                                               │  │
│  │    ├── drawings/          # PDF原本ファイル               │  │
│  │    ├── thumbnails/        # サムネイル画像                │  │
│  │    ├── database.db        # SQLiteデータベース            │  │
│  │    └── config.json        # 設定ファイル                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                           ↑
                           │ AWS Bedrock API
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                    AWS Claude Sonnet 4                          │
│                  (us.anthropic.claude-sonnet-4.0)               │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 技術スタック

#### フロントエンド
- **言語**: TypeScript 5.x
- **フレームワーク**: React 18.x
- **ビルドツール**: Vite 5.x
- **状態管理**: Zustand 4.x
- **ルーティング**: React Router 6.x
- **UIライブラリ**:
  - shadcn/ui (カスタマイズ可能な青/白テーマ)
  - Tailwind CSS 3.x
- **PDF表示**:
  - PDF.js (Mozilla)
  - react-pdf-viewer
- **通知**: react-hot-toast
- **フォーム**: React Hook Form + Zod
- **HTTP クライアント**: Axios
- **WebSocket**: Socket.IO Client

#### バックエンド (Python)
- **言語**: Python 3.11+
- **フレームワーク**: FastAPI 0.104+
- **ASGI サーバー**: Uvicorn
- **ORM**: SQLAlchemy 2.x
- **データベース**: SQLite 3
- **バリデーション**: Pydantic 2.x
- **AWS SDK**: boto3 (Bedrock Runtime用)
- **Claude SDK**: anthropic (オプション)
- **PDF処理**:
  - PyMuPDF (fitz) - PDF to Image
  - Pillow - 画像処理
- **WebSocket**: python-socketio
- **タスクキュー**: Celery + Redis (オプション、バックグラウンド処理用)
- **設定管理**: python-dotenv, pydantic-settings
- **テスト**: pytest, pytest-asyncio

#### 開発ツール
- **パッケージマネージャ**:
  - npm/yarn (フロントエンド)
  - Poetry (バックエンド)
- **リンター/フォーマッター**:
  - ESLint + Prettier (フロントエンド)
  - Black + Ruff (バックエンド)
- **型チェック**: mypy (Python)
- **API ドキュメント**: OpenAPI (FastAPI 自動生成)

## 2. コンポーネント設計

### 2.1 バックエンドコンポーネント一覧

| コンポーネント名 | 責務 | 依存関係 |
|-----------------|------|---------|
| **API Router** | HTTPリクエストのルーティング | Service Layer |
| **Drawing Service** | 図面のCRUD操作 | DAL, File Manager, AI Service |
| **AI Analysis Service** | Claude APIを使った図面解析 | Claude Client, Config Manager |
| **Search Service** | 自然言語検索、類似検索 | DAL, AI Service |
| **Lock Manager** | 編集ロック管理 | DAL, WebSocket Manager |
| **File Manager** | ファイルの保存・削除・リネーム | OS File System |
| **Config Manager** | 設定ファイルの読み込み | File System |
| **WebSocket Manager** | リアルタイム通知 | Lock Manager |
| **Claude API Client** | AWS Bedrock Claude API呼び出し | boto3 |
| **Data Access Layer (DAL)** | データベース操作 | SQLAlchemy |

### 2.2 フロントエンドコンポーネント一覧

| コンポーネント名 | 責務 | 依存関係 |
|-----------------|------|---------|
| **App** | ルートコンポーネント、ルーティング | All Views |
| **UploadView** | 図面アップロード画面 | FileUploader, API Client |
| **DrawingEditorView** | 図面編集画面(2分割) | EditForm, PDFViewer |
| **SearchView** | 検索画面(自然言語/類似) | SearchForm, ResultList |
| **ListView** | 図面一覧画面 | DrawingTable, DrawingCard |
| **EditForm** | 解析結果編集フォーム | FormField, TagInput |
| **PDFViewer** | PDF表示とハイライト | PDF.js, Canvas |
| **DrawingTable** | テーブル形式の図面一覧 | Table, Checkbox |
| **DrawingCard** | カード形式の図面一覧 | Card, Thumbnail |
| **Toast Notification** | トースト通知 | react-hot-toast |
| **Modal Dialog** | モーダルダイアログ | shadcn/ui Dialog |
| **API Client** | バックエンドAPI呼び出し | Axios |

### 2.3 各コンポーネントの詳細

#### 2.3.1 AI Analysis Service (Python)

**目的**: Claude Sonnet 4を使った図面解析の実行

**公開インターフェース**:
```python
from typing import Dict, List, Optional
from pydantic import BaseModel

class ConfidenceScore(BaseModel):
    field_name: str
    value: any
    confidence: float  # 0-100

class BalloonInfo(BaseModel):
    balloon_number: str
    part_name: str
    quantity: int
    x: float
    y: float
    confidence: float

class RevisionHistory(BaseModel):
    revision_number: str
    revision_date: str
    revision_content: str
    reviser: str
    confidence: float

class AnalysisResult(BaseModel):
    drawing_id: str
    classification: str  # "部品図" | "ユニット図" | "組図"
    classification_confidence: float
    classification_reason: str
    extracted_fields: List[ConfidenceScore]
    balloons: List[BalloonInfo]
    revisions: List[RevisionHistory]
    summary: str  # 図面の要約
    shape_features: Optional[Dict[str, any]]  # プレート図の特徴

class AIAnalysisService:
    def __init__(self, config_manager: ConfigManager):
        self.config = config_manager
        self.client = self._init_claude_client()

    async def analyze_drawing(
        self,
        image_data: bytes,
        extraction_fields: List[str]
    ) -> AnalysisResult:
        """
        図面を解析し、図枠情報・風船・分類を抽出

        Args:
            image_data: PDF から変換した画像データ (PNG/JPEG)
            extraction_fields: 抽出するフィールド名のリスト

        Returns:
            AnalysisResult: 解析結果

        Raises:
            AIAnalysisException: API呼び出し失敗時
        """
        pass

    async def classify_drawing(
        self,
        image_data: bytes
    ) -> tuple[str, float, str]:
        """
        図面を部品図/ユニット図/組図に分類

        Returns:
            (分類, 信頼度, 理由)
        """
        pass

    async def extract_balloons(
        self,
        image_data: bytes
    ) -> List[BalloonInfo]:
        """
        風船情報を抽出
        """
        pass

    async def search_similar_drawings(
        self,
        query_drawing_id: str,
        all_drawings: List[Dict]
    ) -> List[tuple[str, float]]:
        """
        類似図面を検索

        Returns:
            [(drawing_id, similarity_score), ...]
        """
        pass

    async def parse_natural_language_query(
        self,
        query: str
    ) -> Dict[str, any]:
        """
        自然言語クエリを構造化クエリに変換

        Args:
            query: "作成者が田中の図面を全部ほしい"

        Returns:
            {"field": "creator", "operator": "equals", "value": "田中"}
        """
        pass
```

**内部実装方針**:
- **リトライロジック**: `tenacity` ライブラリを使用し、指数バックオフで最大3回リトライ
- **プロンプト管理**: テンプレートファイル(`prompts/`)に分離し、バージョン管理
- **信頼度抽出**: Claude のレスポンスから構造化データを抽出（JSON mode使用）
- **画像前処理**: 解像度調整（最大4096px）、PNG変換
- **コスト最適化**: キャッシュ機能（同一画像の再解析を防ぐ）

#### 2.3.2 Drawing Service (Python)

**目的**: 図面のライフサイクル管理

**公開インターフェース**:
```python
class DrawingService:
    def __init__(
        self,
        db: Database,
        file_manager: FileManager,
        ai_service: AIAnalysisService
    ):
        pass

    async def create_drawing(
        self,
        pdf_file: UploadFile,
        user_id: str
    ) -> Drawing:
        """
        新規図面を登録し、AI解析を開始
        """
        pass

    async def update_drawing(
        self,
        drawing_id: str,
        updates: Dict[str, any],
        user_id: str
    ) -> Drawing:
        """
        図面メタデータを更新し、編集履歴を記録
        """
        pass

    async def approve_drawing(
        self,
        drawing_id: str,
        user_id: str
    ) -> Drawing:
        """
        図面を承認状態にする
        """
        pass

    async def unapprove_drawing(
        self,
        drawing_id: str,
        user_id: str
    ) -> Drawing:
        """
        図面を未承認状態に戻す
        """
        pass

    async def delete_drawings(
        self,
        drawing_ids: List[str],
        user_id: str
    ) -> int:
        """
        図面を削除（物理削除）
        """
        pass

    async def bulk_update_tags(
        self,
        drawing_ids: List[str],
        tags: List[str],
        user_id: str
    ) -> int:
        """
        複数図面に一括タグ付け
        """
        pass
```

#### 2.3.3 Lock Manager (Python)

**目的**: 複数ユーザー間の編集ロック管理

**公開インターフェース**:
```python
class LockManager:
    def __init__(self, db: Database, websocket_manager: WebSocketManager):
        self.locks: Dict[str, Lock] = {}  # drawing_id -> Lock
        self.timeout_seconds = 300  # 5分

    async def acquire_lock(
        self,
        drawing_id: str,
        user_id: str
    ) -> bool:
        """
        ロックを取得

        Returns:
            True: ロック取得成功
            False: 既に他のユーザーがロック中
        """
        pass

    async def release_lock(
        self,
        drawing_id: str,
        user_id: str
    ) -> None:
        """
        ロックを解放
        """
        pass

    async def check_lock(
        self,
        drawing_id: str
    ) -> Optional[Lock]:
        """
        現在のロック状態を確認
        """
        pass

    async def cleanup_expired_locks(self) -> None:
        """
        タイムアウトしたロックを自動解放
        （バックグラウンドタスクで定期実行）
        """
        pass
```

#### 2.3.4 PDFViewer Component (React)

**目的**: PDF表示とインタラクティブハイライト

**公開インターフェース**:
```typescript
interface Highlight {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

interface PDFViewerProps {
  pdfUrl: string;
  highlights?: Highlight[];
  onHighlightClick?: (highlight: Highlight) => void;
  initialScale?: number;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  pdfUrl,
  highlights = [],
  onHighlightClick,
  initialScale = 1.0
}) => {
  const [scale, setScale] = useState(initialScale);
  const [rotation, setRotation] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);

  const zoomIn = () => setScale(s => Math.min(s + 0.2, 3.0));
  const zoomOut = () => setScale(s => Math.max(s - 0.2, 0.5));
  const rotate = () => setRotation(r => (r + 90) % 360);

  const drawHighlights = (canvas: HTMLCanvasElement) => {
    // Canvas API を使ってハイライトを描画
  };

  return (
    <div className="pdf-viewer">
      <div className="controls">
        <button onClick={zoomIn}>+</button>
        <button onClick={zoomOut}>-</button>
        <button onClick={rotate}>⟳</button>
        <span>{pageNumber} / {numPages}</span>
      </div>
      <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess}>
        <Page
          pageNumber={pageNumber}
          scale={scale}
          rotate={rotation}
          onRenderSuccess={() => drawHighlights(canvasRef.current)}
        />
      </Document>
    </div>
  );
};
```

**内部実装方針**:
- PDF.js の Worker を使用してパフォーマンス最適化
- Canvas レイヤーを使ってハイライトを描画
- ハイライトクリック時に座標を検出し、コールバック実行

#### 2.3.5 EditForm Component (React)

**目的**: 解析結果の編集フォーム

```typescript
interface EditFormProps {
  drawing: Drawing;
  onSave: (updates: Partial<Drawing>) => Promise<void>;
  onFieldClick: (fieldName: string, coordinates: Coordinates) => void;
}

const EditForm: React.FC<EditFormProps> = ({ drawing, onSave, onFieldClick }) => {
  const { register, handleSubmit, watch } = useForm();

  const renderFieldWithConfidence = (
    fieldName: string,
    value: any,
    confidence: number
  ) => {
    const showWarning = confidence < 70;

    return (
      <div className="field-group">
        <label onClick={() => onFieldClick(fieldName, drawing.coordinates[fieldName])}>
          {fieldName}
          <span className="confidence">({confidence}%)</span>
        </label>
        <input
          {...register(fieldName)}
          defaultValue={value}
          className={showWarning ? 'warning' : ''}
        />
        {showWarning && (
          <div className="inline-warning">
            信頼度が低いため、内容を確認してください
          </div>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit(onSave)} className="edit-form">
      <section>
        <h3>📄 基本情報</h3>
        {drawing.extractedFields.map(field =>
          renderFieldWithConfidence(field.name, field.value, field.confidence)
        )}
      </section>

      <section>
        <h3>🏷️ タグ・分類</h3>
        <TagInput tags={drawing.tags} onChange={...} />
        <CategorySelect value={drawing.category} onChange={...} />
      </section>

      <section>
        <h3>📝 改訂履歴</h3>
        <RevisionTable revisions={drawing.revisions} />
      </section>

      <section>
        <h3>🎈 風船情報</h3>
        <BalloonTable
          balloons={drawing.balloons}
          onBalloonClick={(balloon) => onFieldClick('balloon', balloon.coordinates)}
        />
      </section>

      <section>
        <h3>📜 編集履歴</h3>
        <EditHistoryPanel history={drawing.editHistory} />
      </section>

      <div className="form-actions">
        <button type="submit">保存</button>
        <button type="button" onClick={onApprove}>承認</button>
      </div>
    </form>
  );
};
```

## 3. データフロー

### 3.1 図面アップロードから承認までのフロー

```
[ユーザー]
    ↓ (1) PDF アップロード
[Frontend: UploadView]
    ↓ (2) POST /api/drawings/upload (multipart/form-data)
[Backend: DrawingRouter]
    ↓ (3) DrawingService.create_drawing()
[DrawingService]
    ├─ (4) FileManager.save_pdf()
    │   └→ ./storage/drawings/{uuid}.pdf
    ├─ (5) PDF to Image 変換
    └─ (6) AIAnalysisService.analyze_drawing()
        ↓ (7) AWS Bedrock Claude API 呼び出し
[Claude Sonnet 4]
        ↓ (8) 解析結果 (JSON with confidence)
[AIAnalysisService]
    ↓ (9) レスポンスパース
[DrawingService]
    ↓ (10) DB保存 (SQLite)
[Database]
    ↓ (11) 解析結果を返す
[Frontend: DrawingEditorView]
    ↓ (12) 2分割画面で表示
[ユーザー]
    ↓ (13) 編集・確認
[EditForm]
    ↓ (14) 承認ボタンクリック
[Frontend]
    ↓ (15) PUT /api/drawings/{id}/approve
[DrawingService]
    ↓ (16) drawing.status = "approved"
[Database]
    ↓ (17) 承認完了通知
[Frontend: Toast]
```

### 3.2 編集ロックのフロー

```
[ユーザーA]
    ↓ (1) 図面編集画面を開く
[Frontend]
    ↓ (2) POST /api/locks/acquire
[LockManager]
    ├─ (3) ロック取得成功
    └─ (4) WebSocket で他のユーザーに通知
        ↓
[ユーザーB (別PC)]
    ↓ (5) 同じ図面を開こうとする
[Frontend]
    ↓ (6) POST /api/locks/acquire
[LockManager]
    ├─ (7) ロック失敗 (ユーザーAがロック中)
    └─ (8) Toast通知 "ユーザーAが編集中です"
[Frontend]
    └─ (9) 読み取り専用モードで表示
```

### 3.3 自然言語検索のフロー

```
[ユーザー]
    ↓ (1) "作成者が田中の図面を全部ほしい" と入力
[Frontend: SearchView]
    ↓ (2) POST /api/search/natural
[SearchService]
    ↓ (3) AIAnalysisService.parse_natural_language_query()
[Claude API]
    ↓ (4) {"field": "creator", "operator": "equals", "value": "田中"}
[SearchService]
    ↓ (5) SQLクエリに変換して実行
    └─ SELECT * FROM drawings WHERE creator = '田中'
[Database]
    ↓ (6) 検索結果を返す
[Frontend: ResultList]
    ↓ (7) テーブル/カード形式で表示
```

## 4. データベース設計

### 4.1 テーブル設計

#### drawings テーブル
```sql
CREATE TABLE drawings (
    id TEXT PRIMARY KEY,  -- UUID
    pdf_filename TEXT NOT NULL,
    pdf_path TEXT NOT NULL,
    thumbnail_path TEXT,
    status TEXT NOT NULL,  -- 'pending', 'analyzing', 'approved', 'unapproved'
    classification TEXT,  -- '部品図', 'ユニット図', '組図'
    classification_confidence REAL,
    classification_reason TEXT,
    summary TEXT,  -- 図面の要約
    shape_features JSON,  -- プレート図の特徴
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_date TIMESTAMP,
    created_by TEXT NOT NULL,  -- PCホスト名/ユーザー名
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### extracted_fields テーブル
```sql
CREATE TABLE extracted_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drawing_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    field_value TEXT,
    confidence REAL,  -- 0-100
    coordinates JSON,  -- {"x": 100, "y": 200, "width": 50, "height": 20}
    FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE
);

CREATE INDEX idx_extracted_fields_drawing ON extracted_fields(drawing_id);
```

#### balloons テーブル
```sql
CREATE TABLE balloons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drawing_id TEXT NOT NULL,
    balloon_number TEXT,
    part_name TEXT,
    quantity INTEGER,
    x REAL,
    y REAL,
    confidence REAL,
    FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE
);

CREATE INDEX idx_balloons_drawing ON balloons(drawing_id);
```

#### revisions テーブル
```sql
CREATE TABLE revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drawing_id TEXT NOT NULL,
    revision_number TEXT,
    revision_date TEXT,
    revision_content TEXT,
    reviser TEXT,
    confidence REAL,
    FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE
);

CREATE INDEX idx_revisions_drawing ON revisions(drawing_id);
```

#### tags テーブル
```sql
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drawing_id TEXT NOT NULL,
    tag_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE
);

CREATE INDEX idx_tags_drawing ON tags(drawing_id);
CREATE INDEX idx_tags_name ON tags(tag_name);
```

#### edit_history テーブル
```sql
CREATE TABLE edit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drawing_id TEXT NOT NULL,
    user_id TEXT NOT NULL,  -- PCホスト名/ユーザー名
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE
);

CREATE INDEX idx_edit_history_drawing ON edit_history(drawing_id);
```

#### locks テーブル
```sql
CREATE TABLE locks (
    drawing_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (drawing_id) REFERENCES drawings(id) ON DELETE CASCADE
);
```

### 4.2 SQLAlchemy モデル定義

```python
from sqlalchemy import Column, String, Text, Integer, Float, JSON, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

class Drawing(Base):
    __tablename__ = 'drawings'

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    pdf_filename = Column(String, nullable=False)
    pdf_path = Column(String, nullable=False)
    thumbnail_path = Column(String)
    status = Column(String, nullable=False, default='pending')
    classification = Column(String)
    classification_confidence = Column(Float)
    classification_reason = Column(Text)
    summary = Column(Text)
    shape_features = Column(JSON)
    upload_date = Column(TIMESTAMP, default=datetime.utcnow)
    approved_date = Column(TIMESTAMP)
    created_by = Column(String, nullable=False)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    extracted_fields = relationship('ExtractedField', back_populates='drawing', cascade='all, delete-orphan')
    balloons = relationship('Balloon', back_populates='drawing', cascade='all, delete-orphan')
    revisions = relationship('Revision', back_populates='drawing', cascade='all, delete-orphan')
    tags = relationship('Tag', back_populates='drawing', cascade='all, delete-orphan')
    edit_history = relationship('EditHistory', back_populates='drawing', cascade='all, delete-orphan')
    lock = relationship('Lock', back_populates='drawing', uselist=False, cascade='all, delete-orphan')

class ExtractedField(Base):
    __tablename__ = 'extracted_fields'

    id = Column(Integer, primary_key=True)
    drawing_id = Column(String, ForeignKey('drawings.id'), nullable=False)
    field_name = Column(String, nullable=False)
    field_value = Column(Text)
    confidence = Column(Float)
    coordinates = Column(JSON)

    drawing = relationship('Drawing', back_populates='extracted_fields')
```

## 5. API設計

### 5.1 REST API エンドポイント

#### 図面管理

```
POST /api/drawings/upload
Content-Type: multipart/form-data
Body: {file: File, user_id: string}
Response: {drawing_id: string, status: string}

GET /api/drawings
Query: ?status=approved&classification=部品図&page=1&limit=20
Response: {drawings: Drawing[], total: number}

GET /api/drawings/{drawing_id}
Response: Drawing

PUT /api/drawings/{drawing_id}
Body: {extracted_fields: {...}, tags: [...], classification: string}
Response: Drawing

PUT /api/drawings/{drawing_id}/approve
Body: {user_id: string}
Response: {status: 'approved'}

PUT /api/drawings/{drawing_id}/unapprove
Body: {user_id: string}
Response: {status: 'unapproved'}

DELETE /api/drawings
Body: {drawing_ids: string[], user_id: string}
Response: {deleted_count: number}

POST /api/drawings/bulk/tags
Body: {drawing_ids: string[], tags: string[], user_id: string}
Response: {updated_count: number}

POST /api/drawings/bulk/category
Body: {drawing_ids: string[], category: string, user_id: string}
Response: {updated_count: number}

GET /api/drawings/{drawing_id}/download
Response: File (PDF)

POST /api/drawings/download/bulk
Body: {drawing_ids: string[]}
Response: File (ZIP)

POST /api/drawings/{drawing_id}/reanalyze
Body: {user_id: string}
Response: {job_id: string}
```

#### 検索

```
POST /api/search/natural
Body: {query: string}
Response: {drawings: Drawing[], total: number}

POST /api/search/similar
Body: {drawing_id: string}
Response: {similar_drawings: Array<{drawing: Drawing, similarity: number}>}
```

#### ロック管理

```
POST /api/locks/acquire
Body: {drawing_id: string, user_id: string}
Response: {success: boolean, current_lock?: {user_id: string, expires_at: timestamp}}

DELETE /api/locks/release
Body: {drawing_id: string, user_id: string}
Response: {success: boolean}

GET /api/locks/{drawing_id}
Response: {locked: boolean, user_id?: string, expires_at?: timestamp}
```

#### 設定

```
GET /api/config/extraction-fields
Response: {fields: Array<{name: string, required: boolean}>}
```

### 5.2 WebSocket イベント

```typescript
// クライアント → サーバー
socket.emit('subscribe_drawing', {drawing_id: string});
socket.emit('unsubscribe_drawing', {drawing_id: string});

// サーバー → クライアント
socket.on('drawing_locked', {drawing_id: string, user_id: string});
socket.on('drawing_unlocked', {drawing_id: string});
socket.on('drawing_updated', {drawing_id: string});
```

## 6. エラーハンドリング

### 6.1 エラー分類

| エラータイプ | HTTPステータス | 対処方法 |
|-------------|---------------|---------|
| **ValidationError** | 400 | リクエストパラメータの検証エラー。エラーメッセージをユーザーに表示 |
| **NotFoundError** | 404 | リソースが見つからない。適切なメッセージを表示 |
| **LockError** | 409 | 編集ロック競合。ロック中のユーザーを通知 |
| **AIAnalysisError** | 500 | Claude API エラー。リトライまたは「再解析」ボタン表示 |
| **FileStorageError** | 500 | ファイル保存エラー。ディスク容量確認 |
| **DatabaseError** | 500 | DB操作エラー。ログに記録、ユーザーには汎用エラー表示 |

### 6.2 Python エラーハンドリング例

```python
from fastapi import HTTPException
from tenacity import retry, stop_after_attempt, wait_exponential

class AIAnalysisException(Exception):
    pass

class LockException(Exception):
    pass

# リトライデコレーター
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=2, min=2, max=10),
    reraise=True
)
async def call_claude_api(prompt: str, image_data: bytes):
    try:
        response = await client.messages.create(...)
        return response
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        raise AIAnalysisException(f"AI解析に失敗しました: {str(e)}")

# FastAPI エラーハンドラー
@app.exception_handler(AIAnalysisException)
async def ai_analysis_exception_handler(request: Request, exc: AIAnalysisException):
    return JSONResponse(
        status_code=500,
        content={
            "error": "ai_analysis_error",
            "message": str(exc),
            "retryable": True
        }
    )

@app.exception_handler(LockException)
async def lock_exception_handler(request: Request, exc: LockException):
    return JSONResponse(
        status_code=409,
        content={
            "error": "lock_conflict",
            "message": str(exc)
        }
    )
```

### 6.3 フロントエンドエラーハンドリング

```typescript
// API Client でのエラーハンドリング
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;

    if (response?.status === 409) {
      // ロック競合
      toast.error(`編集中: ${response.data.message}`);
    } else if (response?.status === 500 && response.data.retryable) {
      // リトライ可能エラー
      toast.error('解析に失敗しました。「再解析」ボタンをクリックしてください。');
    } else {
      // その他のエラー
      toast.error('エラーが発生しました。しばらくしてから再試行してください。');
    }

    return Promise.reject(error);
  }
);
```

## 7. セキュリティ設計

### 7.1 AWS認証情報の保護

```python
# .env ファイルで管理
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=xxxxx
AWS_SECRET_ACCESS_KEY=xxxxx

# または AWS認証情報ファイル
# ~/.aws/credentials

# アプリケーションでの読み込み
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    aws_region: str
    aws_access_key_id: str
    aws_secret_access_key: str

    class Config:
        env_file = '.env'
        env_file_encoding = 'utf-8'

settings = Settings()

# boto3 クライアント初期化
import boto3

bedrock_client = boto3.client(
    'bedrock-runtime',
    region_name=settings.aws_region,
    aws_access_key_id=settings.aws_access_key_id,
    aws_secret_access_key=settings.aws_secret_access_key
)
```

### 7.2 入力検証

```python
from pydantic import BaseModel, Field, validator
from typing import List, Optional

class DrawingUpdateRequest(BaseModel):
    extracted_fields: Optional[Dict[str, str]]
    tags: Optional[List[str]] = Field(max_items=50)
    classification: Optional[str]

    @validator('tags')
    def validate_tags(cls, v):
        if v:
            for tag in v:
                if len(tag) > 100:
                    raise ValueError('タグは100文字以内にしてください')
                if not tag.strip():
                    raise ValueError('空のタグは登録できません')
        return v

    @validator('classification')
    def validate_classification(cls, v):
        if v and v not in ['部品図', 'ユニット図', '組図']:
            raise ValueError('無効な分類です')
        return v

# PDFファイルの検証
async def validate_pdf_file(file: UploadFile):
    # ファイルサイズチェック
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > 50 * 1024 * 1024:  # 50MB
        raise HTTPException(400, "ファイルサイズは50MB以下にしてください")

    # MIME type チェック
    if file.content_type != 'application/pdf':
        raise HTTPException(400, "PDFファイルのみアップロード可能です")

    # PDF形式の検証 (PyMuPDF)
    try:
        doc = fitz.open(stream=await file.read(), filetype="pdf")
        doc.close()
    except Exception:
        raise HTTPException(400, "無効なPDFファイルです")
```

### 7.3 XSS対策

```typescript
// フロントエンドでのサニタイズ
import DOMPurify from 'dompurify';

const SafeHTML: React.FC<{html: string}> = ({html}) => {
  const sanitized = DOMPurify.sanitize(html);
  return <div dangerouslySetInnerHTML={{__html: sanitized}} />;
};
```

## 8. テスト戦略

### 8.1 単体テスト

**カバレッジ目標**: 70%以上

**Python (pytest)**:
```python
# tests/test_ai_service.py
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_analyze_drawing_success():
    # Arrange
    mock_client = AsyncMock()
    mock_client.messages.create.return_value = {
        "content": [{
            "text": '{"図番": "ABC-001", "confidence": 95}'
        }]
    }

    service = AIAnalysisService(config)
    service.client = mock_client

    # Act
    result = await service.analyze_drawing(image_data, ["図番"])

    # Assert
    assert result.extracted_fields[0].field_name == "図番"
    assert result.extracted_fields[0].confidence == 95

@pytest.mark.asyncio
async def test_analyze_drawing_retry_on_failure():
    # Claude API が2回失敗後、3回目で成功
    mock_client = AsyncMock()
    mock_client.messages.create.side_effect = [
        Exception("API Error"),
        Exception("API Error"),
        {"content": [{"text": "{}"}]}
    ]

    service = AIAnalysisService(config)
    service.client = mock_client

    result = await service.analyze_drawing(image_data, [])

    assert mock_client.messages.create.call_count == 3
```

**TypeScript (Vitest)**:
```typescript
// tests/PDFViewer.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PDFViewer } from '../components/PDFViewer';

describe('PDFViewer', () => {
  it('should render PDF and zoom controls', () => {
    render(<PDFViewer pdfUrl="test.pdf" />);

    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should zoom in when + button clicked', () => {
    const { getByText } = render(<PDFViewer pdfUrl="test.pdf" />);

    const zoomInButton = getByText('+');
    fireEvent.click(zoomInButton);

    // scale が変更されることを確認
  });
});
```

### 8.2 統合テスト

```python
# tests/integration/test_drawing_flow.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_complete_drawing_workflow(client: AsyncClient):
    # 1. 図面アップロード
    with open('test_data/sample_drawing.pdf', 'rb') as f:
        response = await client.post(
            '/api/drawings/upload',
            files={'file': f},
            data={'user_id': 'test_user'}
        )

    assert response.status_code == 200
    drawing_id = response.json()['drawing_id']

    # 2. 解析結果の取得
    response = await client.get(f'/api/drawings/{drawing_id}')
    drawing = response.json()
    assert drawing['status'] == 'analyzing' or drawing['status'] == 'pending'

    # 3. 図面編集
    response = await client.put(
        f'/api/drawings/{drawing_id}',
        json={
            'extracted_fields': {'図番': 'TEST-001'},
            'user_id': 'test_user'
        }
    )
    assert response.status_code == 200

    # 4. 承認
    response = await client.put(
        f'/api/drawings/{drawing_id}/approve',
        json={'user_id': 'test_user'}
    )
    assert response.status_code == 200
    assert response.json()['status'] == 'approved'
```

### 8.3 E2Eテスト (Playwright)

```typescript
// tests/e2e/drawing-workflow.spec.ts
import { test, expect } from '@playwright/test';

test('complete drawing workflow', async ({ page }) => {
  // 1. アップロード画面を開く
  await page.goto('http://localhost:3000');

  // 2. PDFをアップロード
  await page.setInputFiles('input[type="file"]', 'test_data/sample.pdf');
  await page.click('button:has-text("アップロード")');

  // 3. 編集画面に遷移
  await expect(page.locator('.edit-form')).toBeVisible();

  // 4. 図番を編集
  await page.fill('input[name="図番"]', 'TEST-001');

  // 5. 承認ボタンをクリック
  await page.click('button:has-text("承認")');

  // 6. トースト通知を確認
  await expect(page.locator('.toast')).toContainText('承認しました');
});
```

## 9. パフォーマンス最適化

### 9.1 想定される負荷

- 同時ユーザー: 5-10人
- 1日あたりのアップロード図面数: 50-100枚
- 1図面あたりの解析時間: 10-30秒（Claude API依存）
- 検索応答時間: <2秒

### 9.2 最適化方針

#### バックエンド

1. **非同期処理**
   - FastAPI の async/await を活用
   - バックグラウンドタスクで重い処理を実行

```python
from fastapi import BackgroundTasks

@app.post("/api/drawings/upload")
async def upload_drawing(
    file: UploadFile,
    background_tasks: BackgroundTasks
):
    # ファイル保存は同期的に実行
    drawing = await drawing_service.save_file(file)

    # AI解析はバックグラウンドで実行
    background_tasks.add_task(
        drawing_service.analyze_in_background,
        drawing.id
    )

    return {"drawing_id": drawing.id, "status": "analyzing"}
```

2. **データベースクエリ最適化**
   - インデックスの適切な配置
   - N+1問題の回避（eager loading）

```python
# N+1を避ける
from sqlalchemy.orm import joinedload

drawings = await session.execute(
    select(Drawing)
    .options(
        joinedload(Drawing.extracted_fields),
        joinedload(Drawing.balloons),
        joinedload(Drawing.tags)
    )
)
```

3. **キャッシング**
   - 解析済み図面の結果をキャッシュ

```python
from functools import lru_cache

@lru_cache(maxsize=100)
def get_drawing_cache(drawing_id: str):
    return db.get_drawing(drawing_id)
```

#### フロントエンド

1. **コード分割**
   - React.lazy() でルートベースの分割

```typescript
const UploadView = lazy(() => import('./views/UploadView'));
const DrawingEditorView = lazy(() => import('./views/DrawingEditorView'));
```

2. **仮想化**
   - 大量の図面一覧を表示する際、react-window を使用

```typescript
import { FixedSizeList } from 'react-window';

const DrawingList = ({ drawings }) => (
  <FixedSizeList
    height={600}
    itemCount={drawings.length}
    itemSize={100}
  >
    {({ index, style }) => (
      <div style={style}>
        <DrawingCard drawing={drawings[index]} />
      </div>
    )}
  </FixedSizeList>
);
```

3. **画像最適化**
   - サムネイル生成（200x300px）
   - PDF.jsのWorkerを使用してメインスレッドをブロックしない

## 10. ロギング戦略

### 10.1 ログ出力設計

**ログの種類**:
1. **操作ログ**: 誰が・いつ・何をしたか
2. **エラーログ**: システムエラー、API エラー
3. **アクセスログ**: APIリクエスト履歴

**ログ保存先**:
```
storage/
└── logs/
    ├── operation.log      # 操作ログ（図面登録、編集、承認など）
    ├── error.log          # エラーログ
    └── access.log         # APIアクセスログ
```

**Python ロギング設定**:
```python
import logging
from logging.handlers import RotatingFileHandler

def setup_logging():
    # 操作ログ
    operation_logger = logging.getLogger('operation')
    operation_logger.setLevel(logging.INFO)
    operation_handler = RotatingFileHandler(
        'storage/logs/operation.log',
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    operation_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s'
    ))
    operation_logger.addHandler(operation_handler)

    # エラーログ
    error_logger = logging.getLogger('error')
    error_logger.setLevel(logging.ERROR)
    error_handler = RotatingFileHandler(
        'storage/logs/error.log',
        maxBytes=10*1024*1024,
        backupCount=5
    )
    error_handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(levelname)s - %(name)s - %(message)s'
    ))
    error_logger.addHandler(error_handler)

# 使用例
operation_logger = logging.getLogger('operation')
operation_logger.info(f"User {user_id} uploaded drawing {drawing_id}")
operation_logger.info(f"User {user_id} approved drawing {drawing_id}")
operation_logger.info(f"User {user_id} deleted {len(drawing_ids)} drawings")

error_logger = logging.getLogger('error')
error_logger.error(f"Claude API failed for drawing {drawing_id}: {str(e)}")
```

**FastAPI アクセスログ**:
```python
from fastapi import Request
import time

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()

    # リクエスト処理
    response = await call_next(request)

    # アクセスログ記録
    process_time = time.time() - start_time
    access_logger.info(
        f"{request.client.host} - {request.method} {request.url.path} "
        f"- {response.status_code} - {process_time:.2f}s"
    )

    return response
```

## 11. デプロイメント

### 11.1 ローカル実行構成

**起動方法**: `python backend/main.py` と `npm run dev`（exeパッケージング不要）

```
プロジェクト構造:
cad-drawing-manager/
├── backend/                # Python FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── api/           # API routers
│   │   ├── services/      # Business logic
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   └── utils/         # PromptManager など
│   ├── prompts/           # Claude prompt templates (.txt)
│   │   ├── extraction.txt
│   │   ├── classification.txt
│   │   ├── balloon_extraction.txt
│   │   ├── similarity_search.txt
│   │   └── natural_language_query.txt
│   ├── tests/
│   ├── pyproject.toml
│   └── poetry.lock
├── frontend/              # React + TypeScript
│   ├── src/
│   │   ├── components/
│   │   ├── views/
│   │   ├── stores/        # Zustand stores
│   │   ├── api/           # API client
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── storage/               # データ保存先
│   ├── drawings/
│   ├── thumbnails/
│   ├── logs/              # ログファイル
│   │   ├── operation.log
│   │   ├── error.log
│   │   └── access.log
│   └── database.db
├── config.json            # 設定ファイル
├── .env                   # 環境変数
└── README.md
```

### 11.2 起動手順

```bash
# 1. 依存関係のインストール

# バックエンド
cd backend
poetry install

# フロントエンド
cd frontend
npm install

# 2. 環境変数の設定
# .envファイルを作成（プロジェクトルート）
cat > .env << EOF
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
DATABASE_URL=sqlite:///./storage/database.db
EOF

# 3. ストレージディレクトリの作成
mkdir -p storage/drawings storage/thumbnails storage/logs

# 4. バックエンド起動
cd backend
poetry run python -m app.main
# または
poetry run uvicorn app.main:app --reload --port 8000

# 5. フロントエンド起動（別ターミナル）
cd frontend
npm run dev  # http://localhost:5173
```

**vite.config.ts** (フロントエンドから バックエンドへのプロキシ設定)
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true
      }
    }
  }
});
```

### 11.3 設定管理

**config.json** (ユーザーが編集)
```json
{
  "extractionFields": [
    {"name": "図番", "required": true},
    {"name": "図面タイトル", "required": true},
    {"name": "作成日", "required": true},
    {"name": "承認者", "required": true},
    {"name": "会社名", "required": false},
    {"name": "尺度", "required": false},
    {"name": "材料", "required": false},
    {"name": "材質", "required": false}
  ],
  "storagePath": "./storage/drawings/",
  "lockTimeout": 300,
  "retryAttempts": 3,
  "confidenceThreshold": 70
}
```

**.env** (AWS認証情報)
```
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
DATABASE_URL=sqlite:///./storage/database.db
```

## 11. 実装上の注意事項

### 11.1 Claude API使用時の注意

1. **画像サイズ制限**
   - Claude APIの画像サイズ上限: 5MB
   - 送信前に圧縮・リサイズ処理を実施

2. **プロンプト設計**
   - **プロンプトは`.txt`ファイルで管理**
   - 図枠抽出、風船抽出、分類で別々のプロンプトを使用
   - Few-shot examplesを含めて精度向上

**プロンプトファイル構成**:
```
backend/
└── prompts/
    ├── extraction.txt       # 図枠情報抽出用
    ├── classification.txt   # 図面分類用
    ├── balloon_extraction.txt  # 風船抽出用
    ├── similarity_search.txt   # 類似検索用
    └── natural_language_query.txt  # 自然言語クエリ解析用
```

**extraction.txt の例**:
```
あなたはCAD図面の専門家です。以下の図面画像から、図枠内の情報を抽出してください。

抽出する項目:
{extraction_fields}

出力形式は以下のJSON形式にしてください:
{{
  "extracted_fields": [
    {{
      "field_name": "図番",
      "value": "ABC-001",
      "confidence": 95,
      "coordinates": {{"x": 100, "y": 50, "width": 80, "height": 20}}
    }}
  ]
}}

信頼度(confidence)は0-100の整数で、抽出した値の確実性を表してください。
座標(coordinates)は、図面内での該当箇所の位置とサイズをピクセル単位で指定してください。
```

**プロンプト読み込みコード**:
```python
class PromptManager:
    def __init__(self, prompts_dir: str = "prompts"):
        self.prompts_dir = Path(prompts_dir)

    def load_prompt(self, prompt_name: str) -> str:
        """
        プロンプトファイルを読み込み

        Args:
            prompt_name: "extraction", "classification" など

        Returns:
            プロンプトテンプレート文字列
        """
        prompt_path = self.prompts_dir / f"{prompt_name}.txt"
        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt file not found: {prompt_path}")

        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()

    def format_prompt(self, prompt_name: str, **kwargs) -> str:
        """
        プロンプトをフォーマット（変数置換）

        Example:
            prompt = manager.format_prompt(
                "extraction",
                extraction_fields=["図番", "タイトル"]
            )
        """
        template = self.load_prompt(prompt_name)
        return template.format(**kwargs)
```

3. **レート制限対応**
   - 429エラー時は自動的にリトライ
   - 指数バックオフを使用

4. **コスト管理**
   - 解析結果をキャッシュして重複解析を防ぐ
   - APIコール数を監視

### 11.2 複数ユーザー対応

1. **ユーザー識別**
```python
import socket
import os

def get_user_id() -> str:
    """
    PCのホスト名またはユーザー名を取得
    """
    hostname = socket.gethostname()
    username = os.getenv('USERNAME') or os.getenv('USER')
    return f"{username}@{hostname}"
```

2. **ロックタイムアウト**
   - バックグラウンドタスクで定期的に期限切れロックを削除

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('interval', minutes=1)
async def cleanup_locks():
    await lock_manager.cleanup_expired_locks()

scheduler.start()
```

### 11.3 PDF処理

1. **複数ページPDFの扱い**
   - **全ページを個別の図面として扱う**
   - 各ページを別々に解析し、それぞれDB登録
   - ファイル名に `-page1`, `-page2` などを付与

```python
import fitz  # PyMuPDF

def pdf_to_images(pdf_path: str) -> List[bytes]:
    """
    PDFの全ページを画像に変換

    Returns:
        各ページの画像データのリスト
    """
    doc = fitz.open(pdf_path)
    images = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        # 解像度300dpiで画像化
        pix = page.get_pixmap(matrix=fitz.Matrix(300/72, 300/72))
        img_bytes = pix.tobytes("png")
        images.append(img_bytes)

    doc.close()
    return images

async def process_multipage_pdf(pdf_file: UploadFile, user_id: str) -> List[Drawing]:
    """
    複数ページPDFを処理

    Returns:
        各ページごとのDrawingオブジェクトのリスト
    """
    # PDFを一時保存
    temp_path = await save_temp_file(pdf_file)

    # 全ページを画像に変換
    images = pdf_to_images(temp_path)

    drawings = []
    base_filename = pdf_file.filename.replace('.pdf', '')

    for page_num, image_data in enumerate(images, start=1):
        # 各ページを個別の図面として登録
        page_filename = f"{base_filename}-page{page_num}.pdf"

        # そのページだけのPDFを抽出
        page_pdf = extract_single_page(temp_path, page_num - 1)

        # Drawing作成
        drawing = await drawing_service.create_drawing_from_page(
            page_pdf,
            page_filename,
            image_data,
            user_id
        )

        drawings.append(drawing)

    # 一時ファイル削除
    os.remove(temp_path)

    return drawings
```

2. **サムネイル生成**
```python
from PIL import Image
from io import BytesIO

def generate_thumbnail(pdf_path: str, output_path: str):
    doc = fitz.open(pdf_path)
    page = doc[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5))  # 50%サイズ

    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    img.thumbnail((200, 300))
    img.save(output_path, "PNG")

    doc.close()
```

### 11.4 フロントエンド状態管理

```typescript
// stores/drawingStore.ts
import create from 'zustand';

interface DrawingStore {
  currentDrawing: Drawing | null;
  drawings: Drawing[];
  isLoading: boolean;

  setCurrentDrawing: (drawing: Drawing) => void;
  updateDrawing: (updates: Partial<Drawing>) => Promise<void>;
  approveDrawing: () => Promise<void>;

  // WebSocketからの更新を受信
  onDrawingLocked: (data: {drawing_id: string, user_id: string}) => void;
}

export const useDrawingStore = create<DrawingStore>((set, get) => ({
  currentDrawing: null,
  drawings: [],
  isLoading: false,

  setCurrentDrawing: (drawing) => set({ currentDrawing: drawing }),

  updateDrawing: async (updates) => {
    const { currentDrawing } = get();
    if (!currentDrawing) return;

    set({ isLoading: true });
    try {
      const updated = await api.updateDrawing(currentDrawing.id, updates);
      set({ currentDrawing: updated });
    } finally {
      set({ isLoading: false });
    }
  },

  onDrawingLocked: (data) => {
    const { currentDrawing } = get();
    if (currentDrawing?.id === data.drawing_id) {
      toast.error(`${data.user_id} が編集中です`);
      // 読み取り専用モードに切り替え
    }
  }
}));
```

---

**作成日**: 2025-11-14
**作成者**: Claude Code
**バージョン**: 2.0（最終版）

---

## 付録A：追加要件の整理

### 実装方針の確定事項

1. **フレームワーク**: FastAPI（Django不使用）
   - 理由: 非同期処理に最適、軽量、API開発に特化

2. **データベース**: SQLite
   - 理由: ローカル実行に最適、セットアップ簡単、想定規模で十分

3. **プロンプト管理**: `.txt`ファイルで管理
   - 場所: `backend/prompts/`
   - PromptManager クラスで読み込み・フォーマット

4. **複数ページPDF**: 全ページを個別図面として扱う
   - ファイル名: `{元のファイル名}-page1.pdf`, `-page2.pdf` など

5. **ロギング**:
   - 操作ログ: `storage/logs/operation.log`
   - エラーログ: `storage/logs/error.log`
   - アクセスログ: `storage/logs/access.log`

6. **起動方法**: `python backend/main.py` + `npm run dev`
   - exeパッケージング不要

7. **不要な機能**:
   - 自動アーカイブ・削除機能
   - 自動バックアップ機能
   - APIコストダッシュボード
   - データインポート/エクスポート機能

### AWS Bedrock設定

- **リージョン**: `us-west-2` (オレゴン)
- **モデルID**: `anthropic.claude-sonnet-4-20250514`
- **認証**: `.env`ファイルで管理

### 図面仕様

- **サイズ**: A3, A4 が多い
- **図枠位置**: 右下
- **風船表記**: 〇の中に文字（図番など）
- **改訂履歴**: 表形式の場合と非表形式の場合あり（柔軟に対応）

### 分類判定基準

| 分類 | 判定基準 |
|------|---------|
| **部品図** | 風船なし + 材料情報あり（が多い） |
| **ユニット図** | 風船あり/なし + 複数部品の組み合わせ |
| **組図** | 風船あり + 設備全体 |

**注意**: ユニット図と組図の明確な区別は困難。AIに判定させ、ユーザーが手動調整。

### タグ運用

- **階層構造**: 不要（フラットなタグ）
- **事前定義タグ**: なし（自由入力）

### 検索仕様

- **自然言語検索**: Claude APIでクエリ解析
  - 例: 「2024年以降の部品図」「材質がSUS304で承認者が山田」
- **AND/OR条件**: 対応

### ユーザー識別

- **方法**: `socket.gethostname()` でPCホスト名取得
- **表示**: ホスト名をそのまま表示（マッピング不要）

### エラー処理

- **解析失敗時**: 「解析失敗」ステータスで一覧に表示、「再解析」ボタン提供
- **低信頼度警告**: 全フィールド50%以下の場合、警告表示

### UI/UX設定

- **図面プレビューデフォルト**: 画面に収まるサイズ（Fit to width）
- **一覧画面デフォルト**: カード表示
- **デフォルトソート**: 新しい順（upload_date DESC）

### パフォーマンス

- **最大同時アップロード数**: 未定（柔軟に対応、10-50枚を想定）
- **平均PDFサイズ**: 未定（50MBまで対応）
