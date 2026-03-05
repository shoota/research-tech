---
id: playwright-e2e-testing-guide
title: PlaywrightによるE2Eテスト実践ガイド
sidebar_position: 2
---

# PlaywrightによるE2Eテスト実践ガイド

## 概要

Playwright は Microsoft が開発するE2Eテストフレームワークであり、Chromium・Firefox・WebKit のクロスブラウザテストをサポートする。本ドキュメントでは、Playwright のセットアップからテスト記述、実行方法、レポート出力、CI/CD 統合までを体系的にまとめる。

## 背景・動機

フロントエンド開発において、ユーザー操作を模したE2Eテストはリリース品質の担保に不可欠である。Playwright は以下の特徴から、2025-2026年現在、E2Eテストフレームワークの主要な選択肢となっている。

- 自動待機（Auto-wait）による安定したテスト実行
- ロケーター API によるユーザー視点のセレクタ戦略
- Trace Viewer による強力なデバッグ体験
- 組み込みの並列実行・リトライ機構
- GitHub Actions との容易な統合

## 調査内容

### 1. セットアップ

#### プロジェクト初期化

`npm init playwright@latest` を実行すると、対話形式で以下を設定できる。

- 言語選択（TypeScript / JavaScript）
- テストディレクトリ名（デフォルト: `tests`、既に `tests` が存在する場合は `e2e`）
- GitHub Actions ワークフローの追加
- ブラウザバイナリの自動インストール

```bash title="セットアップコマンド"
# プロジェクト初期化
npm init playwright@latest

# ブラウザのインストール（システム依存パッケージ含む）
npx playwright install --with-deps
```

#### playwright.config.ts の主要設定項目

```typescript title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // テストファイルの格納ディレクトリ
  testDir: './tests',

  // テストの完全並列実行を有効化
  fullyParallel: true,

  // CI 環境では test.only の残留を禁止
  forbidOnly: !!process.env.CI,

  // 失敗時のリトライ回数（CI では2回リトライ）
  retries: process.env.CI ? 2 : 0,

  // 並列ワーカー数（CI では制限する）
  workers: process.env.CI ? 1 : undefined,

  // レポーター設定
  reporter: 'html',

  // 全プロジェクト共通の設定
  use: {
    // ベース URL（page.goto('/login') のように相対パスが使える）
    baseURL: 'http://localhost:3000',

    // 失敗テストの初回リトライ時にトレースを記録
    trace: 'on-first-retry',

    // 失敗時にスクリーンショットを取得
    screenshot: 'only-on-failure',

    // 失敗時に動画を記録
    video: 'on-first-retry',
  },

  // ブラウザごとのプロジェクト定義
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // モバイルビューポートのテスト
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  // テスト実行前にローカルサーバーを起動
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 2. テスト記述方法

#### test() / expect() の基本構文

```typescript title="tests/example.spec.ts"
import { test, expect } from '@playwright/test';

// テストケースの定義
test('トップページが正しく表示される', async ({ page }) => {
  // ページへ遷移
  await page.goto('/');

  // タイトルを検証
  await expect(page).toHaveTitle(/My App/);

  // 見出しが表示されていることを検証
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
});

// テストグループ
test.describe('ユーザー登録', () => {
  test('必須項目が未入力だとエラーが表示される', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('button', { name: '登録' }).click();
    await expect(page.getByText('名前は必須です')).toBeVisible();
  });

  test('正常に登録できる', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('名前').fill('テストユーザー');
    await page.getByLabel('メールアドレス').fill('test@example.com');
    await page.getByRole('button', { name: '登録' }).click();
    await expect(page).toHaveURL('/dashboard');
  });
});
```

#### ロケーター戦略

Playwright はユーザー視点のロケーターを推奨している。優先度の高い順に以下を使い分ける。

```typescript title="tests/locators-example.spec.ts"
import { test, expect } from '@playwright/test';

test('各種ロケーターの使い方', async ({ page }) => {
  await page.goto('/form');

  // getByRole: アクセシビリティロールで要素を特定（最も推奨）
  await page.getByRole('button', { name: '送信' }).click();
  await page.getByRole('heading', { name: 'お問い合わせ' }).isVisible();

  // getByLabel: フォームコントロールをラベルで特定
  await page.getByLabel('ユーザー名').fill('taro');
  await page.getByLabel('パスワード').fill('secret123');

  // getByPlaceholder: プレースホルダーテキストで特定
  await page.getByPlaceholder('name@example.com').fill('taro@example.com');

  // getByText: テキスト内容で要素を特定
  await expect(page.getByText('登録が完了しました')).toBeVisible();
  // 完全一致を指定する場合
  await expect(page.getByText('完了', { exact: true })).toBeVisible();
  // 正規表現も利用可能
  await expect(page.getByText(/welcome, [A-Za-z]+$/i)).toBeVisible();

  // getByAltText: 画像の alt テキストで特定
  await page.getByAltText('プロフィール画像').click();

  // getByTitle: title 属性で特定
  await expect(page.getByTitle('件数')).toHaveText('25件');

  // getByTestId: data-testid 属性で特定（他のロケーターが使えない場合）
  await page.getByTestId('submit-button').click();
});
```

#### アサーション

Playwright の Web-first アサーションは条件が満たされるまで自動的にリトライする。

```typescript title="tests/assertions-example.spec.ts"
import { test, expect } from '@playwright/test';

test('主要なアサーション', async ({ page }) => {
  await page.goto('/dashboard');

  // 要素の可視性
  await expect(page.getByRole('heading')).toBeVisible();
  await expect(page.getByText('ローディング')).toBeHidden();

  // テキスト内容
  await expect(page.getByRole('alert')).toHaveText('保存しました');
  await expect(page.getByRole('alert')).toContainText('保存');

  // URL の検証
  await expect(page).toHaveURL('/dashboard');
  await expect(page).toHaveURL(/\/dashboard/);

  // ページタイトルの検証
  await expect(page).toHaveTitle('ダッシュボード');

  // 要素の属性
  await expect(page.getByRole('link')).toHaveAttribute('href', '/profile');

  // CSS クラス
  await expect(page.getByRole('button')).toHaveClass(/primary/);

  // 要素数
  await expect(page.getByRole('listitem')).toHaveCount(5);

  // 入力値
  await expect(page.getByLabel('名前')).toHaveValue('テストユーザー');

  // 有効/無効状態
  await expect(page.getByRole('button', { name: '送信' })).toBeEnabled();
  await expect(page.getByRole('button', { name: '削除' })).toBeDisabled();
});
```

#### Page Object Model パターン

ページ固有のロケーターと操作をクラスにまとめ、テストの可読性と保守性を高める。

```typescript title="pages/login-page.ts"
import { type Locator, type Page } from '@playwright/test';

export class LoginPage {
  // ページオブジェクトとロケーターの定義
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    // ロケーターはコンストラクタで定義し、テストコードから分離する
    this.emailInput = page.getByLabel('メールアドレス');
    this.passwordInput = page.getByLabel('パスワード');
    this.submitButton = page.getByRole('button', { name: 'ログイン' });
    this.errorMessage = page.getByRole('alert');
  }

  // ページ遷移
  async goto() {
    await this.page.goto('/login');
  }

  // ログイン操作を1つのメソッドにまとめる
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

```typescript title="tests/login.spec.ts"
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login-page';

test.describe('ログイン', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('正しい認証情報でログインできる', async ({ page }) => {
    await loginPage.login('user@example.com', 'password123');
    // アサーションはテストファイル側に書く
    await expect(page).toHaveURL('/dashboard');
  });

  test('不正な認証情報でエラーが表示される', async () => {
    await loginPage.login('wrong@example.com', 'wrongpass');
    await expect(loginPage.errorMessage).toHaveText('認証に失敗しました');
  });
});
```

#### フィクスチャ（fixtures）の活用

カスタムフィクスチャを使うと、Page Object の初期化を自動化し、テストコードをさらに簡潔にできる。

```typescript title="tests/fixtures.ts"
import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/login-page';
import { DashboardPage } from '../pages/dashboard-page';

// カスタムフィクスチャの型定義
type MyFixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
};

// test.extend でフィクスチャを拡張
export const test = base.extend<MyFixtures>({
  // 各テストで自動的に LoginPage インスタンスが利用可能になる
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await use(loginPage);
  },

  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },
});

export { expect } from '@playwright/test';
```

```typescript title="tests/login-with-fixtures.spec.ts"
// カスタムフィクスチャをインポート
import { test, expect } from './fixtures';

// loginPage がフィクスチャとして自動注入される
test('ログインフローのテスト', async ({ loginPage, page }) => {
  await loginPage.login('user@example.com', 'password123');
  await expect(page).toHaveURL('/dashboard');
});
```

**ワーカースコープのフィクスチャ**は、ワーカープロセスごとに一度だけセットアップされ、複数テストで共有される。

```typescript title="tests/worker-fixtures.ts"
import { test as base } from '@playwright/test';

// ワーカースコープのフィクスチャ（高コストな初期化を共有）
export const test = base.extend<{}, { sharedAccount: { email: string; password: string } }>({
  sharedAccount: [async ({ browser }, use) => {
    // ワーカーごとに1回だけ実行される
    const account = { email: 'shared@example.com', password: 'pass' };
    await use(account);
  }, { scope: 'worker' }],
});
```

### 3. テスト内容の種類

#### ナビゲーション・ページ遷移テスト

```typescript title="tests/navigation.spec.ts"
import { test, expect } from '@playwright/test';

test('ナビゲーションリンクが正しく遷移する', async ({ page }) => {
  await page.goto('/');

  // リンクをクリックして遷移を検証
  await page.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL('/about');

  // ブラウザの戻るボタン
  await page.goBack();
  await expect(page).toHaveURL('/');

  // 進むボタン
  await page.goForward();
  await expect(page).toHaveURL('/about');
});

test('リダイレクトが正しく動作する', async ({ page }) => {
  // 未認証ユーザーはログインページにリダイレクト
  await page.goto('/settings');
  await expect(page).toHaveURL('/login?redirect=/settings');
});
```

#### フォーム入力・送信テスト

```typescript title="tests/form.spec.ts"
import { test, expect } from '@playwright/test';

test('お問い合わせフォームを送信できる', async ({ page }) => {
  await page.goto('/contact');

  // テキスト入力
  await page.getByLabel('お名前').fill('山田太郎');
  await page.getByLabel('メールアドレス').fill('yamada@example.com');

  // テキストエリア
  await page.getByLabel('お問い合わせ内容').fill('テストメッセージです');

  // セレクトボックス
  await page.getByLabel('カテゴリ').selectOption('support');

  // チェックボックス
  await page.getByLabel('利用規約に同意する').check();

  // ラジオボタン
  await page.getByLabel('個人').check();

  // フォーム送信
  await page.getByRole('button', { name: '送信' }).click();

  // 送信完了の確認
  await expect(page.getByText('送信が完了しました')).toBeVisible();
});
```

#### 認証フロー（storageState）

セットアッププロジェクトで一度ログインし、認証状態を再利用することでテストを高速化する。

```typescript title="tests/auth.setup.ts"
import { test as setup, expect } from '@playwright/test';

// 認証状態の保存先
const authFile = 'playwright/.auth/user.json';

setup('認証状態をセットアップ', async ({ page }) => {
  // ログインページでログイン操作を実行
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill('test@example.com');
  await page.getByLabel('パスワード').fill('password123');
  await page.getByRole('button', { name: 'ログイン' }).click();

  // ログイン完了を確認
  await expect(page).toHaveURL('/dashboard');

  // 認証状態（Cookie, localStorage）をファイルに保存
  await page.context().storageState({ path: authFile });
});
```

```typescript title="playwright.config.ts（認証セットアップ部分）"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  projects: [
    // セットアッププロジェクト（認証を実行）
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // 認証済み状態でテストを実行
    {
      name: 'chromium',
      use: {
        storageState: 'playwright/.auth/user.json',
      },
      // setup プロジェクトに依存
      dependencies: ['setup'],
    },
  ],
});
```

**API 経由の認証**も可能で、UI 操作より高速に認証状態を取得できる。

```typescript title="tests/auth-api.setup.ts"
import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('API経由で認証', async ({ request }) => {
  // API エンドポイントにログインリクエストを送信
  await request.post('/api/login', {
    data: {
      email: 'test@example.com',
      password: 'password123',
    },
  });

  // request コンテキストの認証状態を保存
  await request.storageState({ path: authFile });
});
```

#### API テスト（request fixture）

ブラウザを起動せずに API エンドポイントを直接テストできる。

```typescript title="tests/api.spec.ts"
import { test, expect } from '@playwright/test';

test.describe('API テスト', () => {
  test('ユーザー一覧を取得できる', async ({ request }) => {
    // GET リクエスト
    const response = await request.get('/api/users');

    // ステータスコードの検証
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    // レスポンスボディの検証
    const users = await response.json();
    expect(users).toHaveLength(3);
    expect(users[0]).toHaveProperty('name');
  });

  test('新しいユーザーを作成できる', async ({ request }) => {
    // POST リクエスト
    const response = await request.post('/api/users', {
      data: {
        name: '新しいユーザー',
        email: 'new@example.com',
      },
    });

    expect(response.ok()).toBeTruthy();
    const user = await response.json();
    expect(user.name).toBe('新しいユーザー');
  });

  test.afterAll('テストデータをクリーンアップ', async ({ request }) => {
    // DELETE リクエストでテストデータを削除
    await request.delete('/api/users/test-user');
  });
});
```

#### ビジュアルリグレッション（スクリーンショット比較）

ページやコンポーネントの見た目をピクセル単位で比較し、意図しないUI変更を検出する。内部では Pixelmatch ライブラリが使用される。

```typescript title="tests/visual.spec.ts"
import { test, expect } from '@playwright/test';

test('トップページの見た目が変わっていない', async ({ page }) => {
  await page.goto('/');

  // ページ全体のスクリーンショット比較
  // 初回実行時にベースラインが生成される
  await expect(page).toHaveScreenshot('homepage.png');
});

test('コンポーネント単位のスクリーンショット比較', async ({ page }) => {
  await page.goto('/components');

  // 特定要素のスクリーンショット比較
  const card = page.getByTestId('user-card');
  await expect(card).toHaveScreenshot('user-card.png');
});

test('許容差を指定したスクリーンショット比較', async ({ page }) => {
  await page.goto('/');

  // maxDiffPixelRatio でピクセル差分の許容率を指定
  await expect(page).toHaveScreenshot('homepage-tolerant.png', {
    maxDiffPixelRatio: 0.05, // 5%まで差分を許容
  });
});
```

ベースラインの更新は以下のコマンドで行う。

```bash title="ベースラインスクリーンショットの更新"
# ベースラインを更新
npx playwright test --update-snapshots
```

#### アクセシビリティテスト

Playwright の ARIA スナップショット機能を使い、アクセシビリティツリーの構造を検証できる。

```typescript title="tests/accessibility.spec.ts"
import { test, expect } from '@playwright/test';

test('ナビゲーションのアクセシビリティ構造を検証', async ({ page }) => {
  await page.goto('/');

  const nav = page.getByRole('navigation');

  // ARIA スナップショットで構造を検証
  await expect(nav).toMatchAriaSnapshot(`
    - navigation:
      - list:
        - listitem:
          - link "ホーム"
        - listitem:
          - link "About"
        - listitem:
          - link "お問い合わせ"
  `);
});

test('フォームのアクセシビリティを検証', async ({ page }) => {
  await page.goto('/contact');

  // 全てのフォームコントロールにラベルが付いていることを確認
  const inputs = page.locator('input:not([type="hidden"])');
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    // aria-label または関連 label 要素の存在を確認
    const input = inputs.nth(i);
    const hasLabel = await input.evaluate((el) => {
      return !!(el.getAttribute('aria-label') || el.labels?.length);
    });
    expect(hasLabel).toBeTruthy();
  }
});
```

### 4. 実行方法

#### CLI オプション

```bash title="テスト実行コマンド"
# 全テストを実行
npx playwright test

# ヘッドモード（ブラウザ画面を表示して実行）
npx playwright test --headed

# デバッグモード（Playwright Inspector 付き）
npx playwright test --debug

# UI モード（ステップ実行・ロケーターピッカー付き）
npx playwright test --ui

# 特定のプロジェクト（ブラウザ）を指定
npx playwright test --project=chromium
npx playwright test --project=webkit --project=firefox

# テスト名でフィルタリング
npx playwright test -g "ログイン"

# 特定のファイルやディレクトリのみ実行
npx playwright test tests/login.spec.ts
npx playwright test tests/auth/

# 前回失敗したテストのみ再実行
npx playwright test --last-failed
```

#### 並列実行（workers）

```bash title="並列ワーカー数の制御"
# ワーカー数を指定
npx playwright test --workers=4

# シングルプロセスで実行（デバッグ時に有用）
npx playwright test --workers=1
```

`playwright.config.ts` で `fullyParallel: true` を設定すると、テストファイル内の各テストケースも並列実行される。デフォルトではファイル単位で並列化される。

#### リトライ戦略（retries）

```bash title="リトライの指定"
# リトライ回数を CLI で指定
npx playwright test --retries=2
```

```typescript title="playwright.config.ts（リトライ設定）"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // CI 環境では2回リトライ、ローカルではリトライなし
  retries: process.env.CI ? 2 : 0,
});
```

リトライ時のトレース取得と組み合わせることで、不安定なテストの原因特定が容易になる。

#### CI/CD 統合（GitHub Actions）

```yaml title=".github/workflows/playwright.yml"
name: Playwright Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest

    steps:
      # リポジトリのチェックアウト
      - uses: actions/checkout@v4

      # Node.js のセットアップ
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*

      # 依存パッケージのインストール
      - name: Install dependencies
        run: npm ci

      # Playwright ブラウザのインストール（システム依存パッケージ含む）
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      # テスト実行
      - name: Run Playwright tests
        run: npx playwright test

      # テストレポートをアーティファクトとしてアップロード
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

**Docker での実行**も公式イメージを利用できる。

```yaml title=".github/workflows/playwright-docker.yml（Docker使用時のjobsセクション）"
jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: mcr.microsoft.com/playwright:v1.52.0-noble
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
      - run: npm ci
      - run: npx playwright test
        env:
          HOME: /root
```

### 5. レポート

#### HTML Reporter

テスト結果をインタラクティブなHTML形式で出力する。ブラウザ・テスト名・ステータスでフィルタリング可能。

```typescript title="playwright.config.ts（HTMLレポーター設定）"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['html', {
    // レポートの出力先ディレクトリ
    outputFolder: 'playwright-report',
    // 失敗時のみブラウザで自動オープン
    open: 'on-failure',
  }]],
});
```

```bash title="レポートの手動表示"
# HTML レポートをブラウザで表示
npx playwright show-report
```

#### Trace Viewer

テスト実行のタイムラインを記録し、各ステップのスクリーンショット・DOM・ネットワークリクエスト・コンソールログを確認できる「タイムトラベルデバッグ」ツール。

```typescript title="playwright.config.ts（トレース設定）"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // 失敗テストの初回リトライ時にトレースを記録（CI推奨設定）
    trace: 'on-first-retry',

    // 開発時は常にトレースを記録することも可能
    // trace: 'on',
  },
});
```

```bash title="トレースの確認"
# トレースファイルをブラウザで表示
npx playwright show-trace trace.zip

# CLI で --trace on を指定して実行
npx playwright test --trace on
```

#### JUnit / JSON Reporter

CI ツールとの連携やカスタム分析用にJUnit XML・JSON形式で出力できる。

```typescript title="playwright.config.ts（複数レポーター設定）"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    // ローカル実行時はリスト形式で表示
    ['list'],
    // HTML レポートも出力
    ['html', { outputFolder: 'playwright-report' }],
    // CI 用に JUnit XML を出力
    ['junit', { outputFile: 'test-results/results.xml' }],
    // JSON 形式でも出力
    ['json', { outputFile: 'test-results/results.json' }],
  ],
});
```

GitHub Actions 上では `github` レポーターを使うと、テスト失敗がアノテーションとして PR に表示される。

```typescript title="playwright.config.ts（CI環境でのレポーター切り替え）"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: process.env.CI
    ? [
        ['github'],              // GitHub Actions のアノテーション
        ['html'],                // HTML レポート
        ['json', { outputFile: 'test-results/results.json' }],
      ]
    : [
        ['list'],                // ローカルではリスト表示
        ['html', { open: 'on-failure' }],
      ],
});
```

#### CI 上でのアーティファクト保存

テストレポート・トレースファイル・スクリーンショットなどを GitHub Actions のアーティファクトとして保存し、失敗原因の調査に活用する。保存されたアーティファクトには機密情報が含まれる可能性があるため、取り扱いに注意が必要である。

## 検証結果

主要な検証ポイントと結果を以下にまとめる。

| 項目 | 結果 |
|------|------|
| セットアップ | `npm init playwright@latest` で設定ファイル・サンプルテスト・CI ワークフローが一括生成される |
| ロケーター | `getByRole` を中心にユーザー視点のセレクタを使うことで、UI 変更に強いテストが書ける |
| 自動待機 | Playwright のロケーターとアサーションは自動で待機・リトライするため、明示的な `waitFor` が不要 |
| 認証 | `storageState` によるセッション再利用で、テストごとのログイン不要。API 経由の認証も可能 |
| 並列実行 | `fullyParallel: true` とワーカー数調整により、テストスイートの実行時間を大幅に短縮可能 |
| ビジュアルテスト | `toHaveScreenshot` でピクセル単位の比較が組み込みで可能。許容差の設定も柔軟 |
| Trace Viewer | 失敗テストのスクリーンショット・DOM・ネットワークログをタイムラインで追跡でき、デバッグ効率が高い |
| CI 統合 | GitHub Actions との統合が容易で、レポートのアーティファクト保存も標準的なパターンが確立されている |

## まとめ

Playwright は E2E テストに必要な機能を包括的に備えたフレームワークであり、以下の点でプロジェクトへの導入に適している。

- **低い導入障壁**: `npm init playwright` による一括セットアップ、TypeScript ファーストの設計
- **安定したテスト**: 自動待機・リトライ機構により、フレーキーテスト（不安定なテスト）を抑制
- **優れたデバッグ体験**: UI モード・Trace Viewer・デバッグモードの3段階のデバッグ手段
- **スケーラブルなテスト設計**: Page Object Model + カスタムフィクスチャによる保守性の高い設計
- **CI/CD との親和性**: GitHub Actions 向けの公式ガイド・Docker イメージ・レポーターが揃っている

導入にあたっては、まずクリティカルなユーザージャーニー（ログイン、主要機能の操作フロー）からテストを書き始め、Page Object Model でテストコードを整理しながら段階的にカバレッジを拡大していく戦略が推奨される。

## 参考リンク

- [Playwright 公式ドキュメント - Installation](https://playwright.dev/docs/intro)
- [Playwright 公式ドキュメント - Locators](https://playwright.dev/docs/locators)
- [Playwright 公式ドキュメント - Fixtures](https://playwright.dev/docs/test-fixtures)
- [Playwright 公式ドキュメント - Authentication](https://playwright.dev/docs/auth)
- [Playwright 公式ドキュメント - API Testing](https://playwright.dev/docs/api-testing)
- [Playwright 公式ドキュメント - Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Playwright 公式ドキュメント - ARIA Snapshots](https://playwright.dev/docs/aria-snapshots)
- [Playwright 公式ドキュメント - Reporters](https://playwright.dev/docs/test-reporters)
- [Playwright 公式ドキュメント - Trace Viewer](https://playwright.dev/docs/trace-viewer)
- [Playwright 公式ドキュメント - CI Setup](https://playwright.dev/docs/ci-intro)
- [Playwright 公式ドキュメント - Running Tests](https://playwright.dev/docs/running-tests)
- [Playwright 公式ドキュメント - Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright 公式ドキュメント - Page Object Models](https://playwright.dev/docs/pom)
- [Playwright E2E Testing: Step-by-Step Setup Guide 2026 | TestDino](https://testdino.com/blog/playwright-e2e-testing/)
- [Guide to Playwright end-to-end testing in 2026 - DeviQA](https://www.deviqa.com/blog/guide-to-playwright-end-to-end-testing-in-2025/)
