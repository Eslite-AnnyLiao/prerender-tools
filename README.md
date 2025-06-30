# 網站性能測試工具 (WebsiteTester)

一套完整的網站性能測試和分析工具，支援兩種測試方法：快速的 curl 測試和詳細的 Puppeteer 瀏覽器測試。

## 📋 目錄

- [功能概述](#功能概述)
- [安裝依賴](#安裝依賴)
- [測試方法比較](#測試方法比較)
- [使用方法](#使用方法)
- [輸出示例](#輸出示例)
- [常見問題](#常見問題)
- [技術特性](#技術特性)

## 🚀 功能概述

### 雙重測試模式
- **curl 模式**：超快速測試，獲取 HTML 內容，支援 Prerender.io 服務
- **Puppeteer 模式**：完整瀏覽器環境測試，包含截圖和詳細性能指標

### 核心功能
- **實時網站性能測試**：支援單個或批量網站測試
- **全面性能指標**：DNS查詢、TCP連線、SSL握手、TTFB、DOM處理等詳細時間
- **資源載入分析**：追蹤每個資源的載入時間和類型
- **Prerender.io 整合**：支援預渲染服務測試
- **HTML 內容分析**：自動分析 HTML 結構和外部資源
- **視覺化輸出**：自動截圖和HTML原始碼保存
- **智能錯誤處理**：容錯機制，即使 HTTP 錯誤也嘗試獲取內容
- **繞過限制**：自動處理CORS和反爬蟲機制

## 📦 安裝依賴

```bash
npm install puppeteer
# 或使用 yarn
yarn add puppeteer
```

## 🔄 測試方法比較

| 特性 | curl 模式 | Puppeteer 模式 |
|------|-----------|----------------|
| **速度** | ⚡ 超快 | 🐌 較慢 |
| **HTML 保存** | ✅ | ✅ |
| **截圖** | ❌ | ✅ |
| **詳細性能指標** | 基礎指標 | 完整指標 |
| **JavaScript 執行** | ❌ | ✅ |
| **Prerender.io 支援** | ✅ | ❌ |
| **資源載入追蹤** | ❌ | ✅ |
| **記憶體使用監控** | ❌ | ✅ |
| **適用場景** | SEO測試、批量檢查 | 完整性能分析 |

## 🛠 使用方法

### 基本用法

```bash
# 預設 Puppeteer 測試（詳細但較慢）
node website-tester.js https://www.example.com

# 快速 curl 測試（包含 HTML 保存）
node website-tester.js --curl-only https://www.example.com

# 使用 Prerender.io 測試
node website-tester.js --curl-only --prerender-token=your_token https://www.example.com

# 批量測試多個網站
node website-tester.js --curl-only https://www.site1.com https://www.site2.com https://www.site3.com
```

### 進階選項

```bash
# 自定義視窗大小和超時時間 (Puppeteer)
node website-tester.js https://www.example.com --width=1920 --height=1080 --timeout=30000

# 顯示瀏覽器視窗進行調試 (Puppeteer)
node website-tester.js https://www.example.com --no-headless --devtools

# 截取完整頁面並延長等待時間 (Puppeteer)
node website-tester.js https://www.example.com --fullpage --wait=5000

# curl 測試並保存所有響應內容
node website-tester.js --curl-only --save-all https://www.example.com

# 啟用詳細調試信息
node website-tester.js --curl-only --debug https://www.example.com

# 批量測試時添加延遲
node website-tester.js --curl-only --delay=1000 https://www.site1.com https://www.site2.com
```

### 完整參數說明

#### 測試方法選項
| 參數 | 說明 | 預設值 |
|------|------|--------|
| `--curl-only` | 使用 curl 進行快速測試 | Puppeteer |

#### curl 專用選項
| 參數 | 說明 | 預設值 |
|------|------|--------|
| `--prerender-token=xxx` | Prerender.io 服務 Token | 無 |
| `--save-all` | 保存所有響應內容，即使不是 HTML | 僅保存 HTML |

#### 通用選項
| 參數 | 說明 | 預設值 |
|------|------|--------|
| `--width=1920` | 瀏覽器視窗寬度 (僅 Puppeteer) | 1920 |
| `--height=1080` | 瀏覽器視窗高度 (僅 Puppeteer) | 1080 |
| `--timeout=30000` | 頁面載入超時時間(ms) | 30000 |
| `--delay=1000` | 批量測試間隔時間(ms) | 0 |
| `--wait=5000` | 頁面載入後額外等待時間(ms) (僅 Puppeteer) | 2000 |
| `--fullpage` | 截取完整頁面 (僅 Puppeteer) | false |
| `--no-headless` | 顯示瀏覽器視窗 (僅 Puppeteer) | headless |
| `--devtools` | 開啟開發者工具 (僅 Puppeteer) | false |
| `--no-html` | 不保存HTML原始碼 | 保存 |
| `--debug` | 顯示詳細除錯資訊 | false |

### 實用範例

#### SEO 和預渲染測試
```bash
# 測試 Prerender.io 預渲染效果
node website-tester.js --curl-only --prerender-token=Ma5RAsX7v3mwQXfKqYni \
  https://www.stg.eslite.com/product/1001173072855709

# 批量測試產品頁面的預渲染效果
node website-tester.js --curl-only --prerender-token=your_token \
  https://www.example.com/product/123 \
  https://www.example.com/product/456 \
  https://www.example.com/product/789
```

#### 完整性能分析
```bash
# 完整的性能分析（包含截圖）
node website-tester.js https://www.example.com --fullpage --wait=3000

# 調試模式查看詳細信息
node website-tester.js https://www.example.com --debug --no-headless --devtools
```

#### CI/CD 整合
```bash
# 快速批量檢查（適合 CI/CD）
node website-tester.js --curl-only --no-html --delay=500 \
  https://www.example.com \
  https://www.example.com/about \
  https://www.example.com/products
```

## 📊 輸出示例

### curl 模式輸出

```
🌐 使用 curl 測試: https://www.example.com
✅ curl 測試成功: https://www.example.com
   狀態碼: 200
   總時間: 1234.5ms
   DNS 查詢: 12.3ms
   TCP 連線: 45.6ms
   伺服器處理: 234.5ms
   首位元組時間: 456.7ms
   內容下載: 234.5ms
   下載大小: 45678 bytes
   HTML 大小: 45KB
   外部腳本: 8 個
   外部樣式: 3 個
   圖片: 12 個
📄 HTML 內容已存至: ./html/https___www_example_com_curl_1733123456789.html
```

### Puppeteer 模式輸出

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
```

### 測試報告摘要

```
📊 測試報告已產生:
   檔案位置: ./reports/test_report_1733123456789.json
   總測試數: 3
   完全成功: 2
   部分成功: 1
   失敗: 0
   curl 測試: 2
   Puppeteer 測試: 1
   平均載入時間: 1234ms
   總資源請求數: 45
   平均資源載入時間: 234ms
   最慢資源類型: image
   總數據傳輸量: 1234KB
   HTML 檔案數: 3
   平均 HTML 大小: 45KB
   外部腳本總數: 24
   外部樣式表總數: 9
```

## 🗂 輸出文件結構

```
project/
├── reports/
│   └── test_report_[timestamp].json    # 詳細測試報告
├── screenshots/ (僅 Puppeteer)
│   └── [url]_[timestamp].png           # 網站截圖
├── html/
│   ├── [url]_[timestamp].html          # Puppeteer HTML
│   └── [url]_curl_[timestamp].html     # curl HTML
└── raw/ (使用 --save-all)
    └── [url]_curl_raw_[timestamp].txt  # 原始響應
```

## 🔧 技術特性

### curl 模式特性

- **高速測試**：直接 HTTP 請求，無瀏覽器開銷
- **Prerender.io 整合**：完整支援預渲染服務 API
- **詳細時間測量**：DNS、TCP、SSL、TTFB、下載時間分解
- **智能 HTML 檢測**：自動識別 HTML 內容並分析結構
- **容錯機制**：即使 HTTP 錯誤狀態也嘗試處理響應內容
- **壓縮支援**：自動處理 gzip、deflate、br 壓縮
- **完整 Headers**：模擬真實瀏覽器請求 headers

### Puppeteer 模式特性

- **真實瀏覽器環境**：完整的 Chrome 瀏覽器模擬
- **反偵測機制**：使用真實瀏覽器 User Agent，避免被識別為爬蟲
- **CORS 繞過**：自動處理跨域請求限制
- **性能監控**：集成 Performance API 和 Puppeteer Metrics
- **資源追蹤**：監控所有網路請求的載入時間
- **記憶體監控**：追蹤 JavaScript 堆記憶體使用情況
- **錯誤處理**：捕獲頁面錯誤和請求失敗
- **並行分析**：計算資源載入的並行效率

### 共同特性

- **批量處理**：支援多個網站同時測試
- **HTML 分析**：自動統計元素數量和外部資源
- **智能檔名**：安全的檔案命名避免系統衝突
- **詳細報告**：JSON 格式的結構化測試報告
- **靈活配置**：豐富的命令列參數支援各種需求

## ❓ 常見問題

### Q: 什麼時候使用 curl 模式？什麼時候使用 Puppeteer 模式？

A: 
- **curl 模式**：適用於 SEO 測試、預渲染服務驗證、快速批量檢查、CI/CD 流程
- **Puppeteer 模式**：適用於完整性能分析、需要截圖、測試 JavaScript 應用、詳細除錯

### Q: Prerender.io Token 如何獲取？

A: 從 Prerender.io 官網註冊帳號後，在控制台可以找到您的 API Token。免費方案有每月請求次數限制。

### Q: curl 模式顯示 "響應內容不是 HTML 格式" 怎麼辦？

A: 這表示伺服器回傳的不是 HTML 內容。可能原因：
1. 網址指向 API 端點或檔案下載
2. 伺服器回傳壓縮或二進制內容
3. 使用 `--debug` 參數查看實際響應內容
4. 使用 `--save-all` 保存原始響應進行分析

### Q: Puppeteer 模式在某些網站無法獲取詳細時間指標？

A: 這通常發生在單頁應用程式(SPA)或使用特殊渲染技術的網站。可以使用 `--debug` 參數查看詳細的 Performance API 數據來診斷問題。

### Q: 如何處理需要登入的網站？

A: 目前工具不支援自動登入。建議：
1. 測試公開可訪問的頁面
2. 手動獲取已登入的 Cookie 並修改程式碼
3. 使用 `--no-headless --devtools` 手動操作後測試

### Q: 批量測試時如何避免被伺服器封鎖？

A: 
1. 使用 `--delay` 參數設定請求間隔
2. curl 模式天然更不容易被偵測
3. 避免短時間內大量請求同一網站
4. 尊重網站的 robots.txt 和服務條款

### Q: 測試報告中的性能數據如何解讀？

A: 
- **TTFB (首位元組時間)**：<200ms 優秀，200-500ms 普通，>500ms 需優化
- **FCP (首次內容繪製)**：<1.8s 優秀，1.8-3s 普通，>3s 需優化
- **總載入時間**：<3s 優秀，3-5s 普通，>5s 需優化
- **並行載入效率**：>80% 優秀，60-80% 良好，<60% 需改善

---

**注意**：使用此工具時請遵守目標網站的服務條款和 robots.txt 規則。curl 模式會產生真實的 HTTP 請求，請合理控制測試頻率。