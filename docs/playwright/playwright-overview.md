---
id: playwright-overview
title: Playwrightの基本と技術的位置付け
sidebar_position: 1
last_update:
  date: 2026-03-05
---

# Playwrightの基本と技術的位置付け

## 概要

Playwright は Microsoft が開発したオープンソースのブラウザ自動化・E2Eテストフレームワークである[^1]。Chromium、Firefox、WebKit をクロスブラウザで制御でき、Auto-wait 機構やテスト分離の仕組みにより、信頼性の高いテスト自動化を実現する[^1]。

## 背景・動機

ブラウザ自動化ツールは約20年の歴史の中で大きく進化してきた。Selenium が長年デファクトスタンダードとして君臨する一方、モダンな Web アプリケーションの複雑化に伴い、より高速で信頼性の高いツールが求められてきた。Playwright はその最新世代に位置するツールであり、先行するツールの課題をどのように解決しているかを理解することは、テスト戦略の選定において重要である。

## 調査内容

### 1. ブラウザ自動化ツールの歴史的変遷

#### Selenium（2004年〜）

Jason Huggins によって2004年に開発された、最も歴史のあるブラウザ自動化ツール。W3C WebDriver プロトコルを標準化し、ブラウザ自動化の基盤を築いた。

- **通信方式**: テストコードが HTTP リクエストをブラウザドライバに送信し、ドライバがブラウザを操作する（WebDriver プロトコル）
- **特徴**: 多言語対応（Java, Python, C#, Ruby, JavaScript）、幅広いブラウザサポート
- **課題**: ブラウザドライバを介した間接的な通信のため速度が遅く、タイミング制御が難しくテストが不安定（フレーキー）になりやすい

#### Puppeteer（2017年〜）

Google の Chrome DevTools チームが開発。Selenium の不安定さを解決するため、Chrome DevTools Protocol（CDP）を直接利用する設計を採用した。

- **通信方式**: Chrome DevTools Protocol（CDP）による直接通信
- **特徴**: Chrome/Chromium に特化した高速な自動化、ヘッドレスモード対応
- **課題**: Chrome/Chromium のみの対応で、クロスブラウザテストには別ツールが必要

#### Playwright（2020年〜）

Microsoft が2020年にリリース[^7]。**Puppeteer の主要開発者が Google から Microsoft に移籍して開発した**という経緯を持つ[^7]。Puppeteer のコントリビューターページを見ると、上位2名の開発者が現在は Playwright の開発に携わっている。

- **通信方式**: Playwright 独自のプロトコル（内部的に CDP や Firefox Remote Debug Protocol を使用）
- **特徴**: クロスブラウザ対応、Auto-wait、テスト分離、多言語サポート
- **移籍の動機**: Puppeteer が Chrome のみに限定されていた制約を超え、真のクロスブラウザ自動化を実現するため

### 2. 通信プロトコルの技術的な違い

各世代のツールは、ブラウザとの通信方式が根本的に異なる。

| プロトコル | 採用ツール | 特徴 |
|---|---|---|
| **W3C WebDriver** | Selenium | W3C標準。HTTP経由でブラウザドライバと通信。クロスブラウザだが間接的で遅い[^10] |
| **Chrome DevTools Protocol (CDP)** | Puppeteer | Chromium のデバッグ用低レベルAPI。高速だが Chromium 専用[^10] |
| **Playwright プロトコル** | Playwright | Node.js WebSocket サーバーが RPC を受け、CDP や Firefox Remote Debug Protocol に変換。クロスブラウザかつ高速[^10] |

Playwright は、クライアント-サーバーモデルを採用している[^12]。クライアント（ユーザーコード）がチャネルプロトコル経由でコマンドを送信し、サーバーがブラウザエンジンに対して実行する。この分離により、リモート実行やプロセス分離、多言語対応が実現されている[^12]。

### 3. 技術的な特徴

#### クロスブラウザ対応

Playwright は Chromium、Firefox、WebKit の3つのブラウザエンジンを単一の API で制御できる[^1]。重要な点は、**Playwright が独自にパッチを当てたブラウザバージョンを管理している**ことである[^12]。これにより、ネットワークインターセプトやマルチコンテキストなどの機能がすべてのブラウザで同一に動作することを保証している。

```typescript title="cross-browser.config.ts"
// playwright.config.ts でクロスブラウザテストを定義
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    // Chromium（Chrome, Edge）
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Firefox
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // WebKit（Safari）
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

#### Auto-wait 機構

Playwright はアクション実行前に自動で要素の操作可能性（Actionability）をチェックする[^2]。これにより、`sleep` や明示的な `waitFor` を書く必要がなくなり、フレーキーテストの主原因を排除する。

チェックされる条件[^2]:

| チェック項目 | 内容 |
|---|---|
| **Visible** | 要素が非空のバウンディングボックスを持ち、`visibility: hidden` でないこと。`opacity: 0` は visible とみなされる |
| **Stable** | 要素が少なくとも2連続のアニメーションフレームで同じバウンディングボックスを維持していること |
| **Enabled** | 要素が `disabled` 属性を持っていないこと |
| **Receives Events** | 要素がポインターイベントのヒットターゲットであること（オーバーレイ等に遮られていないこと） |

アクションごとに必要なチェックは異なる。例えば `click()` は4つすべてのチェックが必要だが、`selectText()` は Visible のみが必要である[^2]。

```typescript title="auto-wait-example.ts"
// Auto-wait の動作例
// Playwright は自動的にボタンが操作可能になるまで待機する
await page.click('#submit-button');
// ↑ 内部的に以下を自動実行:
// 1. 要素が DOM に存在するまで待つ
// 2. 要素が visible になるまで待つ
// 3. 要素が stable になるまで待つ（アニメーション完了）
// 4. 要素が enabled になるまで待つ
// 5. 要素がイベントを受け取れるまで待つ（オーバーレイなし）

// 強制実行も可能（actionability チェックをスキップ）
await page.click('#submit-button', { force: true });
```

#### BrowserContext によるテスト分離

BrowserContext は、独立したブラウザセッションを提供する[^3]。各コンテキストは独自の Cookie、ストレージ、キャッシュ、パーミッションを持ちながら、同一のブラウザプロセスを共有する[^3]。これにより、テスト間の副作用を排除しつつ、ブラウザの起動コストを削減できる。

```typescript title="browser-context-example.ts"
import { test } from '@playwright/test';

// 各テストは独立した BrowserContext で実行される
test('ユーザーAのテスト', async ({ page }) => {
  // この page は独立した BrowserContext に属する
  await page.goto('https://example.com/login');
  // Cookie やストレージは他のテストと完全に分離
});

test('ユーザーBのテスト', async ({ page }) => {
  // 上のテストとは別の BrowserContext
  // ユーザーAのログイン状態は影響しない
  await page.goto('https://example.com/login');
});

// 手動で複数のコンテキストを作成することも可能
test('マルチユーザーシナリオ', async ({ browser }) => {
  // 2つの独立したコンテキストを作成
  const adminContext = await browser.newContext();
  const userContext = await browser.newContext();

  // 各コンテキストからページを作成
  const adminPage = await adminContext.newPage();
  const userPage = await userContext.newPage();

  // 異なるユーザーとして同時に操作
  await adminPage.goto('https://example.com/admin');
  await userPage.goto('https://example.com/dashboard');
});
```

#### ネットワークインターセプト

`page.route()` や `browserContext.route()` を使い、ネットワークリクエストのインターセプト・モック・変更が可能である[^4]。API レスポンスのモックやネットワーク状態のシミュレーションに活用できる。

```typescript title="network-intercept-example.ts"
import { test, expect } from '@playwright/test';

test('APIレスポンスをモックする', async ({ page }) => {
  // /api/users へのリクエストをインターセプトしてモックレスポンスを返す
  await page.route('**/api/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, name: 'テストユーザー' },
      ]),
    });
  });

  await page.goto('https://example.com/users');
  // モックデータが表示されることを検証
  await expect(page.getByText('テストユーザー')).toBeVisible();
});

test('リクエストを監視する', async ({ page }) => {
  // 特定のAPIリクエストが発行されることを検証
  const responsePromise = page.waitForResponse('**/api/submit');

  await page.goto('https://example.com/form');
  await page.fill('#name', 'テスト');
  await page.click('#submit');

  const response = await responsePromise;
  expect(response.status()).toBe(200);
});
```

#### マルチタブ・マルチウィンドウ対応

Playwright はマルチタブ・マルチウィンドウ操作をネイティブにサポートする。`target="_blank"` で開くリンクや `window.open()` で生成される新しいタブも制御できる。

```typescript title="multi-tab-example.ts"
import { test, expect } from '@playwright/test';

test('新しいタブを操作する', async ({ page, context }) => {
  await page.goto('https://example.com');

  // 新しいタブが開くイベントを待機しつつクリック
  const [newPage] = await Promise.all([
    context.waitForEvent('page'), // 新しいタブのイベントを待つ
    page.click('a[target="_blank"]'), // リンクをクリック
  ]);

  // 新しいタブの読み込みを待機
  await newPage.waitForLoadState();

  // 新しいタブの内容を検証
  await expect(newPage).toHaveTitle(/新しいページ/);

  // 元のタブに戻って操作を続行
  await page.bringToFront();
});
```

### 4. 競合ツールとの比較

| 比較項目 | Playwright | Cypress | Selenium | Puppeteer |
|---|---|---|---|---|
| **開発元** | Microsoft | Cypress.io | SeleniumHQ | Google |
| **初版** | 2020年 | 2017年 | 2004年 | 2017年 |
| **対応ブラウザ** | Chromium, Firefox, WebKit | Chromium系, Firefox（限定的） | 全主要ブラウザ | Chromium |
| **通信方式** | 独自プロトコル（CDP/FRDP変換） | ブラウザ内実行 | W3C WebDriver | CDP |
| **言語** | JS/TS, Python, Java, C# | JavaScript/TypeScript のみ | Java, Python, C#, Ruby, JS | JavaScript/TypeScript |
| **速度** | 最速 | Playwright より約23%遅い[^9] | 最も遅い | 高速（Chromiumのみ） |
| **テスト分離** | BrowserContext | テストごとにクリア | 手動管理 | 手動管理 |
| **Auto-wait** | 組み込み | 組み込み | なし（手動実装） | なし（手動実装） |
| **マルチタブ** | ネイティブ対応 | 非対応 | 対応 | 対応 |
| **GitHub Stars** | 74,000+（2026年時点）[^8] | 47,000+[^8] | 31,000+[^8] | 89,000+[^8] |

**アーキテクチャの違い**:
- **Selenium**: ブラウザの外部から HTTP 経由で操作。間接的なため遅延が発生しやすい[^6]
- **Cypress**: ブラウザ内部で実行される。高速だが、アーキテクチャ上の制約が大きい（マルチタブ非対応等）[^8]
- **Playwright**: ブラウザと直接通信しつつ、Selenium 並みの柔軟性を持つ。速度と柔軟性を両立[^7]

### 5. エコシステム

#### VS Code 拡張

Microsoft 公式の VS Code 拡張が提供されており、以下の機能を備える[^5]:

- テストエクスプローラーからのテスト実行・デバッグ
- ブレークポイント設定、変数インスペクション
- テスト実行結果の詳細なエラーメッセージ表示
- AI によるテスト失敗の解決提案[^11]

#### Codegen（テストジェネレーター）

ブラウザ操作を記録してテストコードを自動生成するツール。

```bash
# Codegen の起動
npx playwright codegen https://example.com
```

- ブラウザ上での操作を記録し、適切なロケーターとアサーションを含むテストコードに変換
- VS Code 拡張からは「Record new」ボタンで起動可能
- 「Pick Locator」で要素をクリックすると最適なロケーターを自動選定

#### Trace Viewer

テスト実行のトレースを GUI で詳細分析できるツール。

```typescript title="trace-config.ts"
// playwright.config.ts でトレースを有効化
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // テスト失敗時のみトレースを記録（推奨設定）
    trace: 'on-first-retry',
  },
});
```

```bash
# トレースファイルを開いて分析
npx playwright show-trace trace.zip
```

Trace Viewer で確認できる情報:

- 各アクションのステップバイステップ再生とタイムスタンプ
- 任意の時点での DOM スナップショット
- ネットワークリクエスト・レスポンスの詳細
- コンソールログ
- ソースコードへのマッピング
- スクリーンショットによるビジュアルデバッグ

#### UI Mode

`npx playwright test --ui` で起動する対話型のテスト実行環境。Trace Viewer の機能をリアルタイムで利用しながらテストを実行・デバッグできる。

## 検証結果

Playwright のセットアップと基本的なテスト実行の流れは以下の通りである。

```bash
# プロジェクト初期化
npm init playwright@latest

# テスト実行（全ブラウザ）
npx playwright test

# 特定のブラウザでのみ実行
npx playwright test --project=chromium

# UI Mode でインタラクティブに実行
npx playwright test --ui

# テストレポートの表示
npx playwright show-report
```

```typescript title="example.spec.ts"
import { test, expect } from '@playwright/test';

// 基本的なテスト例
test('トップページのタイトルを検証', async ({ page }) => {
  // ページ遷移（Auto-wait でロード完了まで自動待機）
  await page.goto('https://playwright.dev/');

  // タイトルの検証
  await expect(page).toHaveTitle(/Playwright/);
});

test('Get Started リンクが正しく遷移する', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // ロケーターを取得（role ベースの推奨ロケーター）
  const getStarted = page.getByRole('link', { name: 'Get started' });

  // クリック（Auto-wait で操作可能になるまで自動待機）
  await getStarted.click();

  // 遷移先の検証
  await expect(page).toHaveURL(/.*intro/);
});
```

## まとめ

Playwright は、Selenium から Puppeteer を経て到達した「第3世代」のブラウザ自動化ツールである。Puppeteer の開発チームが Microsoft に移籍して開発したという経緯は、単なる後発ツールではなく、先行ツールの知見を直接引き継いだ正統進化であることを示している。

**技術的な優位性**:
- クロスブラウザ対応を独自パッチのブラウザで実現し、一貫した動作を保証
- Auto-wait 機構でフレーキーテストの主因を設計レベルで排除
- BrowserContext による軽量かつ確実なテスト分離
- ネットワークインターセプト、マルチタブ対応など、実践的な機能が充実

**選定の判断基準**:
- モダンな Web アプリケーションの E2E テストには Playwright が最も適している
- レガシーシステムや多言語チームで広範なブラウザサポートが必要な場合は Selenium も選択肢
- 小規模なフロントエンドチームで Chromium テストに限定できる場合は Cypress も有効

2026年現在、Playwright は GitHub で74,000以上のスター、412,000以上のリポジトリで使用されており[^8]、E2E テストフレームワークとしてデファクトスタンダードの地位を確立しつつある。

## 参考リンク

[^1]: [Playwright 公式ドキュメント](https://playwright.dev/)
[^2]: [Auto-waiting | Playwright](https://playwright.dev/docs/actionability)
[^3]: [BrowserContext | Playwright](https://playwright.dev/docs/api/class-browsercontext)
[^4]: [Network | Playwright](https://playwright.dev/docs/network)
[^5]: [Getting started - VS Code | Playwright](https://playwright.dev/docs/getting-started-vscode)
[^6]: [Playwright vs Selenium: What are the Main Differences?](https://applitools.com/blog/playwright-vs-selenium/)
[^7]: [Playwright vs Puppeteer: Which Browser Automation Tool Should You Choose in 2026?](https://www.firecrawl.dev/blog/playwright-vs-puppeteer)
[^8]: [Selenium vs Cypress vs Playwright: Best Testing Tool in 2026 | TestDino](https://testdino.com/blog/selenium-vs-cypress-vs-playwright/)
[^9]: [Performance Benchmark: Playwright vs Cypress vs Selenium 2026 | TestDino](https://testdino.com/blog/performance-benchmarks/)
[^10]: [WebDriver vs CDP vs WebDriver BiDi](https://substack.thewebscraping.club/p/webdriver-vs-cdp-vs-bidi)
[^11]: [The Complete Playwright End-to-End Story | Microsoft](https://developer.microsoft.com/blog/the-complete-playwright-end-to-end-story-tools-ai-and-real-world-workflows)
[^12]: [Explaining Playwright Architecture | BrowserStack](https://www.browserstack.com/guide/playwright-architecture)
