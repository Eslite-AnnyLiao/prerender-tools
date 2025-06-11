# 預渲染網頁性能分析工具套件

一套完整的預渲染網頁性能測試和分析工具，包含實時網站測試器和日誌性能分析器。

## 📋 目錄

- [功能概述](#功能概述)
- [安裝依賴](#安裝依賴)
- [工具介紹](#工具介紹)
  - [WebsiteTester - 網站性能測試器](#websitetester---網站性能測試器)
  - [PerformanceAnalyzer - 性能日誌分析器](#performanceanalyzer---性能日誌分析器)
- [使用方法](#使用方法)
- [輸出示例](#輸出示例)
- [常見問題](#常見問題)
- [技術特性](#技術特性)

## 🚀 功能概述

### WebsiteTester
- **實時網站性能測試**：使用 Puppeteer 模擬真實瀏覽器環境
- **全面性能指標**：DNS查詢、TCP連線、SSL握手、TTFB、DOM處理等詳細時間
- **資源載入分析**：追蹤每個資源的載入時間和類型
- **視覺化輸出**：自動截圖和HTML原始碼保存
- **批量測試**：支援多個網站同時測試
- **繞過限制**：自動處理CORS和反爬蟲機制

### PerformanceAnalyzer
- **日誌文件分析**：解析JSON/文本格式的性能日誌
- **智能配對**：基於URL匹配請求開始和結束事件
- **Google Cloud Logging優化**：專門支援 textPayload 格式
- **重複資源檢測**：識別並分析重複載入的資源
- **性能評分**：提供綜合性能評分和優化建議
- **並行載入分析**：計算並行載入效率

## 📦 安裝依賴

```bash
npm install puppeteer
# 或使用 yarn
yarn add puppeteer
```

## 🛠 工具介紹

## WebsiteTester - 網站性能測試器

### 基本用法

```bash
# 測試單個網站
node website-tester.js https://www.example.com

# 測試多個網站
node website-tester.js https://www.google.com https://www.github.com

# 測試特定的預渲染服務
node website-tester.js 'http://prerender.dev.eslite.com/render?url=https://www.dev.eslite.com/product/123'
```

### 進階選項

```bash
# 自定義視窗大小和超時時間
node website-tester.js https://www.example.com --width=1920 --height=1080 --timeout=30000

# 顯示瀏覽器視窗進行調試
node website-tester.js https://www.example.com --no-headless --devtools

# 截取完整頁面並延長等待時間
node website-tester.js https://www.example.com --fullpage --wait=5000

# 只保存HTML，不截圖
node website-tester.js https://www.example.com --html-only

# 啟用詳細調試信息
node website-tester.js https://www.example.com --debug

# 批量測試時添加延遲
node website-tester.js https://www.site1.com https://www.site2.com --delay=1000
```

### 參數說明

| 參數 | 說明 | 預設值 |
|------|------|--------|
| `--width=1920` | 瀏覽器視窗寬度 | 1920 |
| `--height=1080` | 瀏覽器視窗高度 | 1080 |
| `--timeout=30000` | 頁面載入超時時間(ms) | 30000 |
| `--delay=1000` | 批量測試間隔時間(ms) | 0 |
| `--wait=5000` | 頁面載入後額外等待時間(ms) | 2000 |
| `--fullpage` | 截取完整頁面 | false |
| `--no-headless` | 顯示瀏覽器視窗 | headless |
| `--devtools` | 開啟開發者工具 | false |
| `--no-html` | 不保存HTML原始碼 | 保存 |
| `--html-only` | 只保存HTML，不截圖 | false |
| `--debug` | 顯示詳細除錯資訊 | false |

### 輸出文件

測試完成後會產生以下文件：
- `reports/test_report_[timestamp].json` - 詳細測試報告
- `screenshots/[url]_[timestamp].png` - 網站截圖
- `html/[url]_[timestamp].html` - 網站HTML原始碼

## PerformanceAnalyzer - 性能日誌分析器

### 基本用法

```bash
# 分析JSON格式日誌
node performance-analyzer.js log.json

# 分析文本格式日誌
node performance-analyzer.js log.txt
```

### 進階選項

```bash
# 顯示詳細處理過程
node performance-analyzer.js log.json --verbose

# 顯示事件配對過程
node performance-analyzer.js log.json --matching

# 啟用時間戳調試
node performance-analyzer.js log.json --debug-timestamp

# 組合使用多個選項
node performance-analyzer.js log.json -v -m -dt

# 靜默模式（只顯示結果）
node performance-analyzer.js log.json --quiet
```

### 參數說明

| 參數 | 簡寫 | 說明 |
|------|------|------|
| `--verbose` | `-v` | 顯示詳細事件日誌 |
| `--matching` | `-m` | 顯示配對過程詳細信息 |
| `--debug-timestamp` | `-dt` | 顯示時間戳解析調試信息 |
| `--quiet` | `-q` | 靜默模式，只顯示最終結果 |
| `--no-progress` | | 不顯示進度信息 |

### 支援的日誌格式

#### Google Cloud Logging textPayload 格式
```json
{
  "textPayload": "[\"2025-06-03T04:19:29.591Z\",\"+\",3,\"https://example.com/file.js\"]",
  "timestamp": "2025-06-03T04:19:29.591Z"
}
```

#### 簡單陣列格式
```json
[
  ["2025-06-03T04:19:29.591Z", "+", 3, "https://example.com/file.js"],
  ["2025-06-03T04:19:29.891Z", "-", 3, "https://example.com/file.js"]
]
```

#### 物件格式
```json
[
  {
    "timestamp": "2025-06-03T04:19:29.591Z",
    "action": "start",
    "url": "https://example.com/file.js"
  },
  {
    "timestamp": "2025-06-03T04:19:29.891Z", 
    "action": "end",
    "url": "https://example.com/file.js"
  }
]
```

#### 文本格式
```
2025-06-03T04:19:29.591Z + 3 https://example.com/file.js
2025-06-03T04:19:29.891Z - 3 https://example.com/file.js
```

## 📊 輸出示例

### WebsiteTester 控制台輸出

```
🚀 啟動 Headless Chrome...
✅ Chrome 啟動成功 (CORS 限制已繞過)

🔍 測試網站: https://www.example.com
✅ 測試成功: https://www.example.com
   頁面標題: Example Domain
   載入時間: 1248ms
   DNS 查詢: 12ms
   TCP 連線: 45ms
   SSL 握手: 89ms
   首位元組時間 (TTFB): 234ms
   響應下載: 67ms
   DOM 處理: 123ms
   總導航時間: 1248ms
   首次繪製 (FP): 456ms
   首次內容繪製 (FCP): 567ms
   總請求數: 23
   平均資源載入時間: 187ms
   最慢資源: https://example.com/large-image.jpg (1200ms)
   JS 記憶體使用: 25MB
   截圖檔案: ./screenshots/https___www_example_com_1733123456789.png
   HTML 原始碼: ./html/https___www_example_com_1733123456789.html
   HTML 大小: 45KB

📊 測試報告已產生:
   檔案位置: ./reports/test_report_1733123456789.json
   總測試數: 1
   成功: 1
   失敗: 0
   平均載入時間: 1248ms
```

### PerformanceAnalyzer 控制台輸出

```
🚀 網頁載入效能分析報告 (基於URL匹配)
==========================================

📊 整體統計摘要:
不重複URL數: 45
完成請求數: 42

⏱️ 時間統計:
📊 累積載入時間: 15240ms (15.24秒)
🕐 實際總載入時間: 3200ms (3.20秒)
⚡ 並行載入效率: 79.0%
📈 平均耗時: 363ms
⬆️ 最長耗時: 1850ms
⬇️ 最短耗時: 45ms

🔥 前20個最耗時的資源詳細分析:
===============================================================
排名 | 耗時(ms) | 類型       | 狀態 | 檔案名稱                    | 完整URL
-----|---------|------------|------|----------------------------|----------
 1   |    1850 | JavaScript | 實際 | main.bundle.js             | https://example.com/js/main.bundle.js
 2   |    1234 | API        | 實際 | product-data               | https://api.example.com/v1/product-data
 3   |     987 | 圖片       | 實際 | hero-image.jpg             | https://cdn.example.com/images/hero-image.jpg
 4   |     765 | CSS        | 實際 | styles.css                 | https://example.com/css/styles.css
 5   |     543 | 字體       | 實際 | font.woff2                 | https://fonts.example.com/font.woff2

💡 效能優化建議:
=====================================
1. 🔴 高優先級 - 最耗時資源: JavaScript
   問題詳情: main.bundle.js 載入時間 1850ms
   建議措施: 考慮程式碼分割、樹搖(tree shaking)、使用生產版本

2. 🟡 中優先級 - API載入過慢
   問題詳情: 平均載入時間 856ms，共 8 個資源
   建議措施: 優化API響應時間、實施快取、合併API請求

⭐ 整體效能評分:
綜合評分: 82/100 - B - 良好
```

## 🔧 技術特性

### WebsiteTester 特性

- **反偵測機制**：使用真實瀏覽器 User Agent，避免被識別為爬蟲
- **CORS 繞過**：自動處理跨域請求限制
- **性能監控**：集成 Performance API 和 Puppeteer Metrics
- **資源追蹤**：監控所有網路請求的載入時間
- **記憶體監控**：追蹤 JavaScript 堆記憶體使用情況
- **錯誤處理**：捕獲頁面錯誤和請求失敗
- **並行分析**：計算資源載入的並行效率

### PerformanceAnalyzer 特性

- **智能時間戳解析**：支援多種時間格式
- **URL 事件配對**：基於 URL 匹配請求開始和結束事件
- **重複資源檢測**：識別重複載入並過濾 CORS preflight 請求
- **資源類型分析**：自動分類資源類型（JS、CSS、API、圖片等）
- **並行載入分析**：計算累積時間 vs 實際總時間
- **性能評分系統**：多維度評估性能表現
- **優化建議引擎**：根據分析結果提供具體改善建議

## ❓ 常見問題

### Q: WebsiteTester 在某些網站無法獲取詳細時間指標？

A: 這通常發生在單頁應用程式(SPA)或使用特殊渲染技術的網站。可以使用 `--debug` 參數查看詳細的 Performance API 數據來診斷問題。

### Q: PerformanceAnalyzer 顯示很多估算數據怎麼辦？

A: 估算數據表示日誌中缺少完整的開始/結束事件配對。建議：
1. 檢查日誌記錄是否完整
2. 使用 `--debug-timestamp` 查看時間戳解析情況
3. 確保日誌格式正確

### Q: 如何提高分析準確性？

A: 
1. 確保日誌記錄完整的請求生命週期
2. 使用標準的時間戳格式
3. 避免日誌截斷或遺失
4. 對於 API 請求，確保記錄真實的業務請求而非 preflight 請求

### Q: 可以分析生產環境的性能嗎？

A: 是的，但建議：
1. 在測試環境先驗證工具行為
2. 注意 WebsiteTester 會產生真實的網路請求
3. PerformanceAnalyzer 只分析日誌文件，對生產環境無影響

### Q: 如何解讀並行載入效率？

A: 並行載入效率 = (1 - 實際總時間/累積時間) × 100%
- >80%：優秀，資源高度並行載入
- 60-80%：良好，適度並行載入  
- 30-60%：需改善，並行度不足
- <30%：需優化，幾乎為串行載入

---

**注意**：使用這些工具時請遵守目標網站的服務條款和 robots.txt 規則。
