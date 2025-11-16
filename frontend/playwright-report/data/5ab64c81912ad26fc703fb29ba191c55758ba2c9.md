# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e6]:
      - link "CAD Drawing Manager" [ref=e8] [cursor=pointer]:
        - /url: /
      - navigation [ref=e9]:
        - link "アップロード" [ref=e10] [cursor=pointer]:
          - /url: /upload
        - link "図面一覧" [ref=e11] [cursor=pointer]:
          - /url: /list
        - link "検索" [ref=e12] [cursor=pointer]:
          - /url: /search
  - main [ref=e13]:
    - generic [ref=e14]:
      - generic [ref=e15]:
        - heading "図面アップロード" [level=1] [ref=e16]
        - paragraph [ref=e17]: PDFファイルをドラッグ&ドロップ、またはクリックして選択してください
      - generic [ref=e18]:
        - button "Choose File" [ref=e19] [cursor=pointer]
        - generic [ref=e20]:
          - img [ref=e21]
          - generic [ref=e23]: ファイルを選択またはドラッグ&ドロップ
          - paragraph [ref=e24]: PDF (最大50MB)
  - contentinfo [ref=e25]:
    - paragraph [ref=e27]: © 2024 CAD Drawing Manager. Powered by Claude AI.
```