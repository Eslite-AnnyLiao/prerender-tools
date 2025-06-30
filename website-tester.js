const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class WebsiteTester {
    constructor() {
        this.browser = null;
        this.results = [];
    }

    async init(options = {}) {
        try {
            console.log('🚀 啟動 Headless Chrome...');

            const defaultArgs = [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ];

            // 加入繞過 CORS 和安全限制的參數
            const corsArgs = [
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-ipc-flooding-protection',
                '--allow-running-insecure-content',
                '--disable-site-isolation-trials',
                '--disable-features=TranslateUI',
                '--disable-background-networking'
            ];

            this.browser = await puppeteer.launch({
                headless: options.headless !== false ? 'new' : false,
                args: [...defaultArgs, ...corsArgs],
                ignoreHTTPSErrors: true,
                ignoreDefaultArgs: ['--enable-automation'],
                devtools: options.devtools || false
            });
            console.log('✅ Chrome 啟動成功 (CORS 限制已繞過)');
        } catch (error) {
            console.error('❌ Chrome 啟動失敗:', error.message);
            throw error;
        }
    }

    // 新增：curl 測試方法
    async testWithCurl(url, options = {}) {
        const startTime = Date.now();
        const testResult = {
            url,
            method: 'curl',
            timestamp: new Date().toISOString(),
            startTime,
            endTime: null,
            duration: null,
            status: 'pending',
            response: {
                statusCode: null,
                headers: {},
                body: null,
                bodySize: 0
            },
            curlMetrics: {},
            htmlAnalysis: null,
            htmlFile: null,
            errors: []
        };

        try {
            console.log(`\n🌐 使用 curl 測試: ${url}`);

            // 建構 curl 命令
            let curlCommand = `curl -w "%{http_code}|%{time_total}|%{size_download}|%{time_namelookup}|%{time_connect}|%{time_starttransfer}" -s -S --compressed`;

            // 如果使用 Prerender.io
            if (options.prerenderToken) {
                const prerenderUrl = `https://service.prerender.io/${url}`;
                curlCommand += ` -H "X-Prerender-Token: ${options.prerenderToken}"`;
                curlCommand += ` "${prerenderUrl}"`;
                testResult.prerenderUrl = prerenderUrl;
                console.log(`   使用 Prerender.io 服務`);
                console.log(`   Token: ${options.prerenderToken}`);
            } else {
                curlCommand += ` "${url}"`;
            }

            // 設定 User Agent
            curlCommand += ` -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"`;

            // 設定其他 headers（移除 Accept-Encoding，讓 --compressed 自動處理）
            curlCommand += ` -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"`;
            curlCommand += ` -H "Accept-Language: zh-TW,zh;q=0.9,en;q=0.8"`;

            // 設定超時
            if (options.timeout) {
                curlCommand += ` --max-time ${Math.ceil(options.timeout / 1000)}`;
            }

            // 跟隨重定向
            curlCommand += ` -L`;

            if (options.debug) {
                console.log(`   執行命令: ${curlCommand}`);
            }

            const { stdout, stderr } = await execAsync(curlCommand);

            // 更安全的解析 curl 輸出
            // curl 的統計數據總是在最後，用特定分隔符分隔
            const lines = stdout.split('\n');
            const lastLine = lines[lines.length - 1];
            const parts = lastLine.split('|');

            if (parts.length >= 6) {
                // 響應體是除了最後一行的所有內容
                const responseBody = lines.slice(0, -1).join('\n');
                const metrics = parts;

                testResult.response.statusCode = parseInt(metrics[0]);
                testResult.response.body = responseBody;
                testResult.response.bodySize = parseInt(metrics[2]);

                testResult.curlMetrics = {
                    totalTime: parseFloat(metrics[1]) * 1000, // 轉換為毫秒
                    downloadSize: parseInt(metrics[2]),
                    dnsLookupTime: parseFloat(metrics[3]) * 1000,
                    connectTime: parseFloat(metrics[4]) * 1000,
                    timeToFirstByte: parseFloat(metrics[5]) * 1000
                };

                // 計算各階段時間
                testResult.curlMetrics.tcpConnectTime = testResult.curlMetrics.connectTime - testResult.curlMetrics.dnsLookupTime;
                testResult.curlMetrics.serverProcessingTime = testResult.curlMetrics.timeToFirstByte - testResult.curlMetrics.connectTime;
                testResult.curlMetrics.contentDownloadTime = testResult.curlMetrics.totalTime - testResult.curlMetrics.timeToFirstByte;
            } else {
                // 如果解析失敗，至少保存響應內容
                testResult.response.body = stdout;
                testResult.response.statusCode = 200; // 假設成功，因為沒有拋出錯誤
                testResult.curlMetrics = {
                    totalTime: 0,
                    downloadSize: stdout.length,
                    dnsLookupTime: 0,
                    connectTime: 0,
                    timeToFirstByte: 0,
                    tcpConnectTime: 0,
                    serverProcessingTime: 0,
                    contentDownloadTime: 0
                };
                console.log(`   ⚠️  curl 統計數據解析失敗，使用基本數據`);
            }

            // 記錄狀態碼，但不立即拋出錯誤（某些服務在 404 時仍返回有用內容）
            const isHttpError = testResult.response.statusCode < 200 || testResult.response.statusCode >= 400;
            if (isHttpError) {
                console.log(`   ⚠️  HTTP 狀態碼: ${testResult.response.statusCode}（但會繼續處理響應內容）`);
            }

            // 分析 HTML 內容（放寬檢測條件）
            const responseBody = testResult.response.body;
            const isHtmlContent = responseBody && (
                responseBody.includes('<html') ||
                responseBody.includes('<!DOCTYPE html') ||
                responseBody.includes('<!doctype html') ||
                responseBody.includes('<HTML') ||
                responseBody.includes('<head') ||
                responseBody.includes('<body') ||
                responseBody.includes('<div') ||
                responseBody.includes('<title')
            );

            if (isHtmlContent) {
                testResult.htmlAnalysis = this.analyzeHtmlContent(responseBody);

                // 儲存 HTML 檔案
                if (options.saveHtml !== false) {
                    const htmlFileName = `${this.sanitizeFilename(url)}_curl_${Date.now()}.html`;
                    const htmlFilePath = path.join(__dirname, 'html', htmlFileName);
                    await this.ensureDirectory(path.dirname(htmlFilePath));
                    await fs.writeFile(htmlFilePath, responseBody, 'utf8');
                    testResult.htmlFile = htmlFilePath;
                    console.log(`📄 HTML 內容已存至: ${htmlFilePath}`);
                }
            } else {
                console.log(`   ⚠️  響應內容不是 HTML 格式`);
                console.log(`   響應長度: ${responseBody.length} 字元`);
                console.log(`   Content-Type: ${testResult.response.headers['content-type'] || '未知'}`);

                if (options.debug) {
                    // 檢查是否為二進制內容
                    const isBinary = responseBody.split('').some(char => {
                        const code = char.charCodeAt(0);
                        return code < 32 && code !== 9 && code !== 10 && code !== 13; // 排除 tab, newline, carriage return
                    });

                    if (isBinary) {
                        console.log(`   內容類型: 可能是二進制或壓縮內容`);
                        console.log(`   前 50 字元的字元碼: ${responseBody.substring(0, 50).split('').map(c => c.charCodeAt(0)).join(', ')}`);
                    } else {
                        console.log(`   響應內容前 200 字元: ${responseBody.substring(0, 200)}`);
                    }
                }

                // 即使不是 HTML，也可以選擇保存原始響應
                if (options.saveAll) {
                    const rawFileName = `${this.sanitizeFilename(url)}_curl_raw_${Date.now()}.txt`;
                    const rawFilePath = path.join(__dirname, 'raw', rawFileName);
                    await this.ensureDirectory(path.dirname(rawFilePath));
                    await fs.writeFile(rawFilePath, responseBody, 'utf8');
                    testResult.rawFile = rawFilePath;
                    console.log(`📄 原始響應已存至: ${rawFilePath}`);
                }
            }

            // 根據狀態碼和內容決定最終狀態
            if (testResult.response.statusCode >= 200 && testResult.response.statusCode < 300) {
                testResult.status = 'success';
            } else if (isHtmlContent && testResult.htmlFile) {
                // 雖然狀態碼不是 2xx，但獲得了 HTML 內容
                testResult.status = 'partial_success';
                testResult.errors.push({
                    type: 'http_status_warning',
                    message: `HTTP ${testResult.response.statusCode} 但獲得了 HTML 內容`,
                    timestamp: Date.now()
                });
            } else {
                // 狀態碼不是 2xx 且沒有有用的內容
                throw new Error(`HTTP ${testResult.response.statusCode}`);
            }

            testResult.status = testResult.status || 'success';

            console.log(`✅ curl 測試${testResult.status === 'partial_success' ? '部分成功' : '成功'}: ${url}`);
            console.log(`   狀態碼: ${testResult.response.statusCode}`);

            if (testResult.curlMetrics && testResult.curlMetrics.totalTime > 0) {
                console.log(`   總時間: ${testResult.curlMetrics.totalTime.toFixed(1)}ms`);
                console.log(`   DNS 查詢: ${testResult.curlMetrics.dnsLookupTime.toFixed(1)}ms`);
                console.log(`   TCP 連線: ${testResult.curlMetrics.tcpConnectTime.toFixed(1)}ms`);
                console.log(`   伺服器處理: ${testResult.curlMetrics.serverProcessingTime.toFixed(1)}ms`);
                console.log(`   首位元組時間: ${testResult.curlMetrics.timeToFirstByte.toFixed(1)}ms`);
                console.log(`   內容下載: ${testResult.curlMetrics.contentDownloadTime.toFixed(1)}ms`);
            }
            console.log(`   下載大小: ${testResult.curlMetrics?.downloadSize || testResult.response.bodySize || 0} bytes`);

            if (testResult.htmlAnalysis) {
                console.log(`   HTML 大小: ${testResult.htmlAnalysis.sizeKB}KB`);
                console.log(`   外部腳本: ${testResult.htmlAnalysis.externalResources.scripts.length} 個`);
                console.log(`   外部樣式: ${testResult.htmlAnalysis.externalResources.stylesheets.length} 個`);
                console.log(`   圖片: ${testResult.htmlAnalysis.externalResources.images.length} 個`);
            }

        } catch (error) {
            testResult.status = 'failed';
            testResult.errors.push({
                type: 'curl_error',
                message: error.message,
                timestamp: Date.now()
            });
            console.log(`❌ curl 測試失敗: ${url} - ${error.message}`);
        }

        testResult.endTime = Date.now();
        testResult.duration = testResult.endTime - testResult.startTime;
        this.results.push(testResult);

        return testResult;
    }

    async testWebsite(url, options = {}) {
        const startTime = Date.now();
        const testResult = {
            url,
            timestamp: new Date().toISOString(),
            startTime,
            endTime: null,
            duration: null,
            status: 'pending',
            httpStatusCode: null,    // 新增：HTTP 狀態碼
            httpStatusText: null,    // 新增：HTTP 狀態文字
            screenshot: null,
            htmlSource: null,
            htmlFile: null,
            pageTitle: null,
            pageDescription: null,
            metrics: {},
            errors: [],
            console: [],
            network: [],
            resourceTiming: [], // 新增：資源載入時間詳細資訊
            resourceSummary: {  // 新增：資源載入時間統計摘要
                totalRequests: 0,
                averageLoadTime: 0,
                slowestResource: null,
                fastestResource: null,
                totalDataTransferred: 0
            }
        };

        let page = null;
        // 追蹤每個請求的開始時間
        const requestStartTimes = new Map();

        try {
            console.log(`\n🔍 測試網站: ${url}`);

            page = await this.browser.newPage();

            // 設置視窗大小
            await page.setViewport({
                width: options.width || 1920,
                height: options.height || 1080
            });

            // 設置 User Agent 避免被偵測為爬蟲
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // 設置額外的 headers
            await page.setExtraHTTPHeaders({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'X-Prerender-Token': options.prerenderToken || '',
            });

            // 攔截請求來處理 CORS 問題
            await page.setRequestInterception(true);

            // 監聽請求開始 - 記錄開始時間
            page.on('request', (request) => {
                const requestId = request.url() + '_' + Date.now();
                requestStartTimes.set(request.url(), {
                    startTime: Date.now(),
                    requestId: requestId,
                    method: request.method(),
                    resourceType: request.resourceType()
                });

                // 允許所有請求通過，但修改 headers
                const headers = Object.assign({}, request.headers(), {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                });

                request.continue({ headers });
            });

            // 監聽控制台訊息
            page.on('console', msg => {
                testResult.console.push({
                    type: msg.type(),
                    text: msg.text(),
                    timestamp: Date.now()
                });
            });

            // 監聽網路響應 - 計算載入時間
            page.on('response', async (response) => {
                const responseTime = Date.now();
                const requestUrl = response.url();
                const requestInfo = requestStartTimes.get(requestUrl);

                let loadTime = 0;
                let contentLength = 0;

                if (requestInfo) {
                    loadTime = responseTime - requestInfo.startTime;
                }

                // 嘗試獲取響應大小
                try {
                    const headers = response.headers();
                    contentLength = parseInt(headers['content-length'] || '0');

                    // 如果沒有 content-length header，嘗試讀取響應內容來計算大小
                    if (!contentLength && response.ok()) {
                        try {
                            const buffer = await response.buffer();
                            contentLength = buffer.length;
                        } catch (e) {
                            // 忽略無法讀取內容的情況
                        }
                    }
                } catch (e) {
                    // 忽略讀取 headers 失敗的情況
                }

                const resourceInfo = {
                    url: requestUrl,
                    status: response.status(),
                    statusText: response.statusText(),
                    contentType: response.headers()['content-type'] || '',
                    loadTime: loadTime,
                    contentLength: contentLength,
                    resourceType: requestInfo?.resourceType || 'unknown',
                    method: requestInfo?.method || 'GET',
                    fromCache: response.fromCache(),
                    timestamp: responseTime
                };

                testResult.network.push(resourceInfo);

                // 如果載入時間大於 0，加入到詳細資源時間追蹤
                if (loadTime > 0) {
                    testResult.resourceTiming.push({
                        url: requestUrl,
                        loadTime: loadTime,
                        contentLength: contentLength,
                        resourceType: requestInfo?.resourceType || 'unknown',
                        status: response.status(),
                        fromCache: response.fromCache()
                    });
                }

                // 清理已完成的請求記錄
                requestStartTimes.delete(requestUrl);
            });

            // 監聽頁面錯誤
            page.on('pageerror', error => {
                testResult.errors.push({
                    type: 'pageerror',
                    message: error.message,
                    timestamp: Date.now()
                });
            });

            // 監聽請求失敗
            page.on('requestfailed', request => {
                testResult.errors.push({
                    type: 'requestfailed',
                    url: request.url(),
                    failure: request.failure()?.errorText || 'Unknown error',
                    timestamp: Date.now()
                });
            });

            // 啟用性能監控
            await page.coverage.startJSCoverage();
            await page.coverage.startCSSCoverage();

            // 導航到目標網址
            const navigationStart = Date.now();
            const response = await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: options.timeout || 30000
            });

            const navigationEnd = Date.now();

            // 記錄響應狀態，但不立即拋出錯誤（某些服務在 404 時仍返回有用內容）
            const httpStatusCode = response.status();
            const httpStatusText = response.statusText();
            const isHttpError = !response.ok();
            if (isHttpError) {
                console.log(`   ⚠️  HTTP 狀態碼: ${httpStatusCode}（但會繼續處理頁面內容）`);
            }

            // 保存狀態碼到測試結果中
            testResult.httpStatusCode = httpStatusCode;
            testResult.httpStatusText = httpStatusText;

            // 等待頁面完全加載
            await page.waitForTimeout(options.waitTime || 2000);

            // 獲取頁面基本資訊
            const pageInfo = await page.evaluate(() => {
                return {
                    title: document.title || '',
                    description: document.querySelector('meta[name="description"]')?.content || '',
                    url: window.location.href,
                    userAgent: navigator.userAgent
                };
            });

            testResult.pageTitle = pageInfo.title;
            testResult.pageDescription = pageInfo.description;

            // 獲取頁面原始碼
            if (options.saveHtml !== false) {
                const htmlContent = await page.content();
                testResult.htmlSource = htmlContent;
                testResult.htmlAnalysis = this.analyzeHtmlContent(htmlContent);

                // 保存 HTML 檔案
                const htmlFileName = `${this.sanitizeFilename(url)}_${Date.now()}.html`;
                const htmlFilePath = path.join(__dirname, 'html', htmlFileName);
                await this.ensureDirectory(path.dirname(htmlFilePath));
                await fs.writeFile(htmlFilePath, htmlContent, 'utf8');
                testResult.htmlFile = htmlFilePath;

                console.log(`📄 HTML 原始碼已存至: ${htmlFilePath}`);
            }

            // 獲取性能指標 - 使用現代 Performance API
            const performanceData = await page.evaluate(() => {
                const result = {
                    navigation: null,
                    paint: [],
                    resources: [],
                    memory: null
                };

                // 獲取導航時間 (替代 performance.timing)
                const navEntries = performance.getEntriesByType('navigation');
                if (navEntries.length > 0) {
                    result.navigation = navEntries[0];
                }

                // 獲取繪製時間 (First Paint, First Contentful Paint)
                result.paint = performance.getEntriesByType('paint');

                // 獲取資源載入時間
                result.resources = performance.getEntriesByType('resource').map(entry => ({
                    name: entry.name,
                    duration: entry.duration,
                    transferSize: entry.transferSize || 0,
                    encodedBodySize: entry.encodedBodySize || 0,
                    decodedBodySize: entry.decodedBodySize || 0,
                    startTime: entry.startTime,
                    responseEnd: entry.responseEnd,
                    initiatorType: entry.initiatorType
                }));

                // 獲取記憶體使用情況 (如果支援)
                if ('memory' in performance) {
                    result.memory = {
                        usedJSHeapSize: performance.memory.usedJSHeapSize,
                        totalJSHeapSize: performance.memory.totalJSHeapSize,
                        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                    };
                }

                return result;
            });

            const performanceMetrics = await page.metrics();

            // 建構性能指標物件
            const metrics = {
                navigationTime: navigationEnd - navigationStart,
                puppeteerMetrics: performanceMetrics,
                performanceAPI: performanceData
            };

            // 如果有導航資料，加入詳細時間
            if (performanceData.navigation) {
                const nav = performanceData.navigation;

                // 安全的時間計算函數
                const safeDuration = (end, start) => {
                    if (!end || !start || end === 0 || start === 0 || end < start) {
                        return null;
                    }
                    return Math.round(end - start);
                };

                metrics.timings = {
                    // DNS 查詢時間
                    dnsLookup: safeDuration(nav.domainLookupEnd, nav.domainLookupStart),
                    // TCP 連線時間
                    tcpConnect: safeDuration(nav.connectEnd, nav.connectStart),
                    // SSL 握手時間 (HTTPS)
                    sslHandshake: nav.secureConnectionStart > 0 ?
                        safeDuration(nav.connectEnd, nav.secureConnectionStart) : null,
                    // 請求時間 (TTFB - Time to First Byte)
                    timeToFirstByte: safeDuration(nav.responseStart, nav.requestStart),
                    // 響應下載時間
                    responseDownload: safeDuration(nav.responseEnd, nav.responseStart),
                    // DOM 建構時間
                    domProcessing: safeDuration(nav.domComplete, nav.domLoading),
                    // DOM 內容載入時間
                    domContentLoaded: safeDuration(nav.domContentLoadedEventEnd, nav.domContentLoadedEventStart),
                    // 完整載入時間
                    loadEvent: safeDuration(nav.loadEventEnd, nav.loadEventStart),
                    // 總導航時間
                    totalNavigation: safeDuration(nav.loadEventEnd, nav.fetchStart),
                    // 重定向時間
                    redirect: safeDuration(nav.redirectEnd, nav.redirectStart),
                    // 頁面卸載時間
                    unload: safeDuration(nav.unloadEventEnd, nav.unloadEventStart)
                };

                // 移除所有 null 值，只保留有效的時間
                Object.keys(metrics.timings).forEach(key => {
                    if (metrics.timings[key] === null) {
                        delete metrics.timings[key];
                    }
                });
            }

            // 加入繪製時間
            if (performanceData.paint.length > 0) {
                metrics.paintTimes = {};
                performanceData.paint.forEach(paint => {
                    if (paint.name === 'first-paint') {
                        metrics.paintTimes.firstPaint = paint.startTime;
                    } else if (paint.name === 'first-contentful-paint') {
                        metrics.paintTimes.firstContentfulPaint = paint.startTime;
                    }
                });
            }

            // 加入記憶體使用情況
            if (performanceData.memory) {
                metrics.memoryUsage = performanceData.memory;
            }

            // 從 Performance API 獲取的資源時間統計
            if (performanceData.resources.length > 0) {
                metrics.resourceStats = {
                    totalResources: performanceData.resources.length,
                    averageDuration: Math.round(
                        performanceData.resources.reduce((sum, r) => sum + r.duration, 0) /
                        performanceData.resources.length
                    ),
                    totalTransferSize: performanceData.resources.reduce((sum, r) => sum + r.transferSize, 0),
                    resourcesByType: this.groupResourcesByType(performanceData.resources)
                };
            }

            testResult.metrics = metrics;

            // 除錯模式：顯示原始 Performance API 數據
            if (options.debug && performanceData.navigation) {
                console.log('\n🔍 除錯資訊 - 原始 Performance Navigation 數據:');
                const nav = performanceData.navigation;
                console.log(`   fetchStart: ${nav.fetchStart}`);
                console.log(`   domainLookupStart: ${nav.domainLookupStart}`);
                console.log(`   domainLookupEnd: ${nav.domainLookupEnd}`);
                console.log(`   connectStart: ${nav.connectStart}`);
                console.log(`   connectEnd: ${nav.connectEnd}`);
                console.log(`   secureConnectionStart: ${nav.secureConnectionStart}`);
                console.log(`   requestStart: ${nav.requestStart}`);
                console.log(`   responseStart: ${nav.responseStart}`);
                console.log(`   responseEnd: ${nav.responseEnd}`);
                console.log(`   domLoading: ${nav.domLoading}`);
                console.log(`   domComplete: ${nav.domComplete}`);
                console.log(`   loadEventStart: ${nav.loadEventStart}`);
                console.log(`   loadEventEnd: ${nav.loadEventEnd}`);
            }

            // 計算資源載入時間統計
            testResult.resourceSummary = this.calculateResourceSummary(testResult.resourceTiming);

            // 截取螢幕截圖
            if (options.saveScreenshot !== false) {
                const screenshotPath = path.join(__dirname, 'screenshots', `${this.sanitizeFilename(url)}_${Date.now()}.png`);
                await this.ensureDirectory(path.dirname(screenshotPath));
                await page.screenshot({
                    path: screenshotPath,
                    fullPage: options.fullPage || false
                });

                testResult.screenshot = screenshotPath;
                console.log(`📸 截圖已存至: ${screenshotPath}`);
            }

            testResult.status = 'success';

            console.log(`✅ 測試成功: ${url}`);
            console.log(`   頁面標題: ${testResult.pageTitle}`);
            console.log(`   載入時間: ${testResult.metrics.navigationTime}ms`);

            // 顯示詳細性能指標 - 只顯示有效值
            if (testResult.metrics.timings && Object.keys(testResult.metrics.timings).length > 0) {
                const timings = testResult.metrics.timings;

                if (timings.dnsLookup !== undefined) {
                    console.log(`   DNS 查詢: ${timings.dnsLookup}ms`);
                }
                if (timings.tcpConnect !== undefined) {
                    console.log(`   TCP 連線: ${timings.tcpConnect}ms`);
                }
                if (timings.sslHandshake !== undefined) {
                    console.log(`   SSL 握手: ${timings.sslHandshake}ms`);
                }
                if (timings.timeToFirstByte !== undefined) {
                    console.log(`   首位元組時間 (TTFB): ${timings.timeToFirstByte}ms`);
                }
                if (timings.responseDownload !== undefined) {
                    console.log(`   響應下載: ${timings.responseDownload}ms`);
                }
                if (timings.domProcessing !== undefined) {
                    console.log(`   DOM 處理: ${timings.domProcessing}ms`);
                }
                if (timings.totalNavigation !== undefined) {
                    console.log(`   總導航時間: ${timings.totalNavigation}ms`);
                }
                if (timings.redirect !== undefined && timings.redirect > 0) {
                    console.log(`   重定向時間: ${timings.redirect}ms`);
                }
            } else {
                console.log(`   ⚠️  詳細時間指標無法獲取 (可能是 SPA 或特殊頁面)`);
            }

            if (testResult.metrics.paintTimes) {
                const paint = testResult.metrics.paintTimes;
                if (paint.firstPaint && paint.firstPaint > 0) {
                    console.log(`   首次繪製 (FP): ${Math.round(paint.firstPaint)}ms`);
                }
                if (paint.firstContentfulPaint && paint.firstContentfulPaint > 0) {
                    console.log(`   首次內容繪製 (FCP): ${Math.round(paint.firstContentfulPaint)}ms`);
                }
            }

            console.log(`   總請求數: ${testResult.resourceSummary.totalRequests}`);
            console.log(`   平均資源載入時間: ${testResult.resourceSummary.averageLoadTime}ms`);
            if (testResult.resourceSummary.slowestResource) {
                console.log(`   最慢資源: ${testResult.resourceSummary.slowestResource.url} (${testResult.resourceSummary.slowestResource.loadTime}ms)`);
            }

            if (testResult.metrics.memoryUsage) {
                console.log(`   JS 記憶體使用: ${Math.round(testResult.metrics.memoryUsage.usedJSHeapSize / 1024 / 1024)}MB`);
            }

            if (testResult.screenshot) {
                console.log(`   截圖檔案: ${testResult.screenshot}`);
            }
            if (testResult.htmlFile) {
                console.log(`   HTML 原始碼: ${testResult.htmlFile}`);
                console.log(`   HTML 大小: ${Math.round(testResult.htmlSource.length / 1024)}KB`);
            }

            if (testResult.status === 'partial_success') {
                console.log(`   ℹ️  注意：雖然 HTTP 狀態碼為 ${testResult.httpStatusCode}，但成功獲取了頁面內容`);
            }

        } catch (error) {
            testResult.status = 'failed';
            testResult.errors.push({
                type: 'test_error',
                message: error.message,
                timestamp: Date.now()
            });
            console.log(`❌ 測試失敗: ${url} - ${error.message}`);

            // 如果有 HTTP 狀態碼信息，也要顯示
            if (testResult.httpStatusCode) {
                console.log(`   HTTP 狀態碼: ${testResult.httpStatusCode}`);
            }
        } finally {
            testResult.endTime = Date.now();
            testResult.duration = testResult.endTime - testResult.startTime;

            if (page) {
                await page.close();
            }

            this.results.push(testResult);
        }

        return testResult;
    }

    // 新增：測試多個網站（支援 curl 或 puppeteer）
    async testMultipleWebsites(urls, options = {}) {
        console.log(`\n📋 開始測試 ${urls.length} 個網站...`);

        if (options.method === 'curl') {
            console.log(`   使用方法: curl`);
        } else {
            console.log(`   使用方法: Puppeteer`);
        }

        const results = [];
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            console.log(`\n[${i + 1}/${urls.length}] 測試進度`);

            let result;
            if (options.method === 'curl') {
                result = await this.testWithCurl(url, options);
            } else {
                result = await this.testWebsite(url, options);
            }
            results.push(result);

            // 可選的延遲時間
            if (options.delay && i < urls.length - 1) {
                await new Promise(resolve => setTimeout(resolve, options.delay));
            }
        }

        return results;
    }

    // 新增：計算資源載入時間統計
    calculateResourceSummary(resourceTiming) {
        if (!resourceTiming || resourceTiming.length === 0) {
            return {
                totalRequests: 0,
                averageLoadTime: 0,
                slowestResource: null,
                fastestResource: null,
                totalDataTransferred: 0
            };
        }

        const loadTimes = resourceTiming.map(resource => resource.loadTime);
        const totalLoadTime = loadTimes.reduce((sum, time) => sum + time, 0);
        const averageLoadTime = Math.round(totalLoadTime / loadTimes.length);

        const slowestResource = resourceTiming.reduce((slowest, current) =>
            current.loadTime > slowest.loadTime ? current : slowest
        );

        const fastestResource = resourceTiming.reduce((fastest, current) =>
            current.loadTime < fastest.loadTime ? current : fastest
        );

        const totalDataTransferred = resourceTiming.reduce((sum, resource) =>
            sum + (resource.contentLength || 0), 0
        );

        return {
            totalRequests: resourceTiming.length,
            averageLoadTime,
            slowestResource: {
                url: slowestResource.url,
                loadTime: slowestResource.loadTime,
                resourceType: slowestResource.resourceType
            },
            fastestResource: {
                url: fastestResource.url,
                loadTime: fastestResource.loadTime,
                resourceType: fastestResource.resourceType
            },
            totalDataTransferred
        };
    }

    async generateReport(outputPath = null) {
        const reportPath = outputPath || path.join(__dirname, 'reports', `test_report_${Date.now()}.json`);
        await this.ensureDirectory(path.dirname(reportPath));

        const htmlResults = this.results.filter(r => r.htmlAnalysis);
        const successfulResults = this.results.filter(r => r.status === 'success' || r.status === 'partial_success');
        const curlResults = this.results.filter(r => r.method === 'curl');

        // 計算資源載入統計
        const puppeteerResults = this.results.filter(r => r.method !== 'curl' && r.resourceTiming);
        const allResourceTiming = puppeteerResults.flatMap(r => r.resourceTiming || []);
        const resourceStats = this.calculateGlobalResourceStats(allResourceTiming);

        const summary = {
            totalTests: this.results.length,
            successfulTests: successfulResults.length,
            partialSuccessTests: this.results.filter(r => r.status === 'partial_success').length,
            failedTests: this.results.filter(r => r.status === 'failed').length,
            curlTests: curlResults.length,
            puppeteerTests: this.results.length - curlResults.length,
            averageLoadTime: this.calculateAverageLoadTime(),
            resourceStatistics: resourceStats,
            htmlStatistics: htmlResults.length > 0 ? {
                totalHtmlFiles: htmlResults.length,
                averageHtmlSize: Math.round(htmlResults.reduce((sum, r) => sum + r.htmlAnalysis.sizeKB, 0) / htmlResults.length),
                totalExternalScripts: htmlResults.reduce((sum, r) => sum + r.htmlAnalysis.externalResources.scripts.length, 0),
                totalExternalStylesheets: htmlResults.reduce((sum, r) => sum + r.htmlAnalysis.externalResources.stylesheets.length, 0),
                totalImages: htmlResults.reduce((sum, r) => sum + r.htmlAnalysis.externalResources.images.length, 0)
            } : null,
            generatedAt: new Date().toISOString()
        };

        // 為了節省空間，在最終報告中移除完整的 HTML 原始碼
        const processedResults = this.results.map(result => {
            const { htmlSource, ...resultWithoutHtml } = result;
            return {
                ...resultWithoutHtml,
                htmlSourceLength: htmlSource ? htmlSource.length : (result.response?.body?.length || 0)
            };
        });

        const report = {
            summary,
            results: processedResults
        };

        await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

        console.log(`\n📊 測試報告已產生:`);
        console.log(`   檔案位置: ${reportPath}`);
        console.log(`   總測試數: ${summary.totalTests}`);
        console.log(`   完全成功: ${summary.successfulTests - summary.partialSuccessTests}`);
        console.log(`   部分成功: ${summary.partialSuccessTests}`);
        console.log(`   失敗: ${summary.failedTests}`);
        console.log(`   curl 測試: ${summary.curlTests}`);
        console.log(`   Puppeteer 測試: ${summary.puppeteerTests}`);
        console.log(`   平均載入時間: ${summary.averageLoadTime}ms`);

        if (summary.resourceStatistics && summary.resourceStatistics.totalRequests > 0) {
            console.log(`   總資源請求數: ${summary.resourceStatistics.totalRequests}`);
            console.log(`   平均資源載入時間: ${summary.resourceStatistics.averageLoadTime}ms`);
            console.log(`   最慢資源類型: ${summary.resourceStatistics.slowestResourceType}`);
            console.log(`   總數據傳輸量: ${Math.round(summary.resourceStatistics.totalDataTransferred / 1024)}KB`);
        }

        if (summary.htmlStatistics) {
            console.log(`   HTML 檔案數: ${summary.htmlStatistics.totalHtmlFiles}`);
            console.log(`   平均 HTML 大小: ${summary.htmlStatistics.averageHtmlSize}KB`);
            console.log(`   外部腳本總數: ${summary.htmlStatistics.totalExternalScripts}`);
            console.log(`   外部樣式表總數: ${summary.htmlStatistics.totalExternalStylesheets}`);
        }

        return reportPath;
    }

    // 新增：按類型分組資源統計
    groupResourcesByType(resources) {
        const groups = {};

        resources.forEach(resource => {
            const type = resource.initiatorType || 'other';
            if (!groups[type]) {
                groups[type] = {
                    count: 0,
                    totalDuration: 0,
                    totalTransferSize: 0,
                    averageDuration: 0
                };
            }

            groups[type].count++;
            groups[type].totalDuration += resource.duration;
            groups[type].totalTransferSize += resource.transferSize;
        });

        // 計算平均時間
        Object.keys(groups).forEach(type => {
            groups[type].averageDuration = Math.round(
                groups[type].totalDuration / groups[type].count
            );
        });

        return groups;
    }

    // 新增：計算全域資源統計
    calculateGlobalResourceStats(allResourceTiming) {
        if (!allResourceTiming || allResourceTiming.length === 0) {
            return {
                totalRequests: 0,
                averageLoadTime: 0,
                slowestResourceType: null,
                resourceTypeStats: {},
                totalDataTransferred: 0
            };
        }

        const loadTimes = allResourceTiming.map(resource => resource.loadTime);
        const totalLoadTime = loadTimes.reduce((sum, time) => sum + time, 0);
        const averageLoadTime = Math.round(totalLoadTime / loadTimes.length);

        // 按資源類型分組統計
        const resourceTypeStats = {};
        allResourceTiming.forEach(resource => {
            const type = resource.resourceType;
            if (!resourceTypeStats[type]) {
                resourceTypeStats[type] = {
                    count: 0,
                    totalLoadTime: 0,
                    averageLoadTime: 0,
                    maxLoadTime: 0,
                    minLoadTime: Infinity
                };
            }

            resourceTypeStats[type].count++;
            resourceTypeStats[type].totalLoadTime += resource.loadTime;
            resourceTypeStats[type].maxLoadTime = Math.max(resourceTypeStats[type].maxLoadTime, resource.loadTime);
            resourceTypeStats[type].minLoadTime = Math.min(resourceTypeStats[type].minLoadTime, resource.loadTime);
        });

        // 計算每種資源類型的平均載入時間
        Object.keys(resourceTypeStats).forEach(type => {
            resourceTypeStats[type].averageLoadTime = Math.round(
                resourceTypeStats[type].totalLoadTime / resourceTypeStats[type].count
            );
        });

        // 找出最慢的資源類型
        const slowestResourceType = Object.keys(resourceTypeStats).reduce((slowest, current) => {
            return resourceTypeStats[current].averageLoadTime > (resourceTypeStats[slowest]?.averageLoadTime || 0)
                ? current : slowest;
        }, '');

        const totalDataTransferred = allResourceTiming.reduce((sum, resource) =>
            sum + (resource.contentLength || 0), 0
        );

        return {
            totalRequests: allResourceTiming.length,
            averageLoadTime,
            slowestResourceType,
            resourceTypeStats,
            totalDataTransferred
        };
    }

    calculateAverageLoadTime() {
        const successfulResults = this.results.filter(r => r.status === 'success' || r.status === 'partial_success');
        if (successfulResults.length === 0) return 0;

        let totalTime = 0;
        let count = 0;

        successfulResults.forEach(result => {
            if (result.method === 'curl' && result.curlMetrics?.totalTime) {
                totalTime += result.curlMetrics.totalTime;
                count++;
            } else if (result.metrics?.navigationTime) {
                totalTime += result.metrics.navigationTime;
                count++;
            }
        });

        return count > 0 ? Math.round(totalTime / count) : 0;
    }

    analyzeHtmlContent(htmlContent) {
        if (!htmlContent) return {};

        const analysis = {
            size: htmlContent.length,
            sizeKB: Math.round(htmlContent.length / 1024),
            lines: htmlContent.split('\n').length,
            elements: {},
            externalResources: {
                scripts: [],
                stylesheets: [],
                images: []
            }
        };

        // 計算各種 HTML 元素數量
        const elementCounts = {
            div: (htmlContent.match(/<div/gi) || []).length,
            img: (htmlContent.match(/<img/gi) || []).length,
            a: (htmlContent.match(/<a /gi) || []).length,
            script: (htmlContent.match(/<script/gi) || []).length,
            link: (htmlContent.match(/<link/gi) || []).length,
            meta: (htmlContent.match(/<meta/gi) || []).length
        };

        analysis.elements = elementCounts;

        // 提取外部資源 URL
        const scriptMatches = htmlContent.match(/<script[^>]*src\s*=\s*["']([^"']+)["']/gi) || [];
        analysis.externalResources.scripts = scriptMatches.map(match => {
            const srcMatch = match.match(/src\s*=\s*["']([^"']+)["']/i);
            return srcMatch ? srcMatch[1] : '';
        }).filter(Boolean);

        const linkMatches = htmlContent.match(/<link[^>]*href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']stylesheet["']/gi) || [];
        analysis.externalResources.stylesheets = linkMatches.map(match => {
            const hrefMatch = match.match(/href\s*=\s*["']([^"']+)["']/i);
            return hrefMatch ? hrefMatch[1] : '';
        }).filter(Boolean);

        const imgMatches = htmlContent.match(/<img[^>]*src\s*=\s*["']([^"']+)["']/gi) || [];
        analysis.externalResources.images = imgMatches.map(match => {
            const srcMatch = match.match(/src\s*=\s*["']([^"']+)["']/i);
            return srcMatch ? srcMatch[1] : '';
        }).filter(Boolean);

        return analysis;
    }

    sanitizeFilename(url) {
        return url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    }

    async ensureDirectory(dirPath) {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('🔒 Chrome 已關閉');
        }
    }
}

// CLI 介面
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
用法: node website-tester.js <網址1> [網址2] [網址3] ...

測試方法:
  (預設)                使用 Puppeteer 進行詳細測試（包含截圖）
  --curl-only          只使用 curl 進行快速測試（包含 HTML 保存）

curl 相關選項:
  --prerender-token=xxx  使用 Prerender.io 服務的 Token

一般選項:
  --width=1920      設定視窗寬度 (預設: 1920)
  --height=1080     設定視窗高度 (預設: 1080)  
  --timeout=30000   設定超時時間 (預設: 30000ms)
  --delay=1000      設定測試間隔 (預設: 0ms)
  --wait=5000       頁面載入後額外等待時間 (僅 Puppeteer，預設: 2000ms)
  --fullpage        截取完整頁面 (僅 Puppeteer，預設: false)
  --no-headless     顯示瀏覽器視窗 (僅 Puppeteer，預設: headless)
  --devtools        開啟開發者工具 (僅 Puppeteer，預設: false)
  --no-html         不保存 HTML 原始碼 (預設: 保存)
  --save-all        保存所有響應內容，即使不是 HTML (預設: 僅保存 HTML)
  --debug           顯示詳細除錯資訊

範例:
  # 預設 Puppeteer 測試（詳細但較慢）
  node website-tester.js https://www.google.com
  
  # 快速 curl 測試（包含 HTML 保存）
  node website-tester.js --curl-only https://www.google.com
  
  # 使用 Prerender.io 測試
  node website-tester.js --curl-only --prerender-token=Ma5RAsX7v3mwQXfKqYni https://www.stg.eslite.com/product/1001173072855709
  
  # 批量測試
  node website-tester.js --curl-only --prerender-token=Ma5RAsX7v3mwQXfKqYni \\
    https://www.stg.eslite.com/product/1001173072855709 \\
    https://www.stg.eslite.com/product/1001279052682495

測試方法比較:
  --curl-only   ⚡ 快速，有 HTML，無截圖，適合批量檢查和 SEO 測試
  (預設)        🔍 詳細，有 HTML，有截圖，適合完整分析

注意事項:
  - curl 測試速度快，適合批量檢查或 CI/CD
  - curl 測試會保存 HTML 原始碼但無法截圖
  - 使用 --prerender-token 可以測試預渲染效果
`);
        process.exit(1);
    }

    // 解析參數
    const urls = [];
    const options = {
        method: 'puppeteer', // 預設使用 puppeteer
        width: 1920,
        height: 1080,
        timeout: 30000,
        delay: 0,
        fullPage: false,
        headless: true,
        devtools: false,
        debug: false,
        waitTime: 2000,
        saveHtml: true,
        saveScreenshot: true,
        saveAll: false,  // 新增：是否保存所有響應內容
        prerenderToken: null
    };

    args.forEach(arg => {
        if (arg === '--curl-only') {
            options.method = 'curl';
        } else if (arg.startsWith('--prerender-token=')) {
            options.prerenderToken = arg.split('=')[1];
        } else if (arg.startsWith('--width=')) {
            options.width = parseInt(arg.split('=')[1]);
        } else if (arg.startsWith('--height=')) {
            options.height = parseInt(arg.split('=')[1]);
        } else if (arg.startsWith('--timeout=')) {
            options.timeout = parseInt(arg.split('=')[1]);
        } else if (arg.startsWith('--delay=')) {
            options.delay = parseInt(arg.split('=')[1]);
        } else if (arg.startsWith('--wait=')) {
            options.waitTime = parseInt(arg.split('=')[1]);
        } else if (arg === '--fullpage') {
            options.fullPage = true;
        } else if (arg === '--no-headless') {
            options.headless = false;
        } else if (arg === '--devtools') {
            options.devtools = true;
        } else if (arg === '--debug') {
            options.debug = true;
        } else if (arg === '--no-html') {
            options.saveHtml = false;
        } else if (arg === '--save-all') {
            options.saveAll = true;
        } else if (arg.startsWith('http')) {
            urls.push(arg);
        }
    });

    if (urls.length === 0) {
        console.error('❌ 請提供至少一個有效的網址');
        process.exit(1);
    }

    const tester = new WebsiteTester();

    try {
        // 只有在使用 Puppeteer 時才初始化瀏覽器
        if (options.method !== 'curl') {
            await tester.init({
                headless: options.headless,
                devtools: options.devtools
            });
        }

        await tester.testMultipleWebsites(urls, options);
        await tester.generateReport();
    } catch (error) {
        console.error('❌ 測試過程發生錯誤:', error.message);
        if (options.debug) {
            console.error('完整錯誤資訊:', error);
        }
        process.exit(1);
    } finally {
        await tester.close();
    }
}

// 如果直接執行此檔案
if (require.main === module) {
    main().catch(console.error);
}

module.exports = WebsiteTester;
