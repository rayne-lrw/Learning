# 思維模型筆記

收集能帶來啟發的思維模型、法則與效應，每個都附上解析與例子。

網址：https://rayne-lrw.github.io/Learning/

## 檔案結構

```
index.html            網頁（只負責讀取資料、顯示畫面）
app.js                網頁的主要程式（讀取資料、搜尋、收藏、連結面板）
theme.js              在畫面繪製前套用深淺色主題
data/
  categories.json     分類清單：分類 id、名稱、說明、對應的資料檔
  game.json           每個分類一個檔案，內容是該分類的概念陣列
  decision.json
  ...
```

## 新增一個概念

打開對應分類的 JSON 檔，在陣列裡加一筆：

```json
{
  "id": "my-concept",
  "name": "概念名稱",
  "en": "English Name",
  "what": "它是什麼。",
  "example": "- 第一個例子\n- 第二個例子",
  "why": "為什麼重要。",
  "howto": "怎麼用或要注意什麼。"
}
```

- `id`：英文小寫加連字號，不能和其他概念重複，會用在網址上（例如 `#my-concept`）。
- 文字欄位裡用 `\n` 換行；以 `- ` 開頭的行會顯示成清單。
- 文字中用「概念名稱」括起來的字，如果剛好是其他概念的名稱，網頁會自動加上連結。

## 新增一個分類

1. 在 `data/` 建立新的 JSON 檔，內容是一個陣列，例如 `[]`。
2. 在 `data/categories.json` 的 `categories` 加一筆：

```json
{ "id": "new-cat", "name": "分類名稱", "description": "一句話說明", "file": "new-cat.json" }
```

分類在網頁上的順序，就是它在 `categories.json` 裡的順序。

## 在本機預覽

網頁用 `fetch` 讀取 JSON，直接雙擊打開 `index.html` 會讀不到資料。請在資料夾中執行：

```
python3 -m http.server
```

再打開 http://localhost:8000 。
