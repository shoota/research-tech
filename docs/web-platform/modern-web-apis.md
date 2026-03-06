---
id: web-platform-modern-web-apis
title: Web API 最新動向 - View Transitions, Popover, Anchor Positioning
sidebar_position: 1
tags: [web-api, view-transitions, popover, css, browser]
last_update:
  date: 2026-03-06
---

## 概要

2025〜2026年にかけてブラウザに実装が進んでいる最新 Web API（View Transitions API、Popover API、CSS Anchor Positioning、Navigation API、Speculation Rules API、Scroll-driven Animations）について、仕様・ブラウザサポート状況・実践的なコード例を調査した。

## 背景・動機

近年、従来は JavaScript ライブラリに頼っていた UI パターン（ページ遷移アニメーション、ポップオーバー、ツールチップ配置、ルーティング、プリレンダリング、スクロール連動アニメーション）が Web 標準 API として実装されつつある。これらの API を理解し、ライブラリ依存を減らしつつモダンな UX を実現する選択肢を把握するために調査を行った。

## 調査内容

### 1. View Transitions API

ページ遷移時のアニメーションをブラウザネイティブで実現する API。SPA（同一ドキュメント内）と MPA（クロスドキュメント）の両方に対応する[[1]](#参考リンク)。

#### 仕組み

1. 遷移前の状態をスナップショットとしてキャプチャ
2. DOM を更新
3. 遷移後の状態をキャプチャ
4. 擬似要素ツリーを生成し、old/new の間でクロスフェードアニメーションを実行

#### CSS 擬似要素

| 擬似要素 | 役割 |
|---|---|
| `::view-transition` | トランジションオーバーレイのルート |
| `::view-transition-group()` | 個別トランジションのルート |
| `::view-transition-image-pair()` | old/new ビューのコンテナ |
| `::view-transition-old()` | 遷移前のスナップショット |
| `::view-transition-new()` | 遷移後のライブ表現 |

#### SPA での使用

`document.startViewTransition()` を呼び出し、コールバック内で DOM を更新する[[1]](#参考リンク)。

```ts title="spa-transition.ts"
// SPA でのページ遷移アニメーション
function navigateTo(newContent: string) {
  // View Transition が未サポートの場合のフォールバック
  if (!document.startViewTransition) {
    updateDOM(newContent);
    return;
  }

  // トランジション開始
  const transition = document.startViewTransition(() => {
    updateDOM(newContent);
  });

  // トランジション完了後の処理
  transition.finished.then(() => {
    console.log("Transition completed");
  });
}

function updateDOM(content: string) {
  document.querySelector("#main-content")!.innerHTML = content;
}
```

#### MPA での使用

CSS の `@view-transition` at-rule でオプトインする。同一オリジン間のナビゲーションに限定される[[2]](#参考リンク)。

```css title="mpa-transition.css"
/* 両方のページで宣言する */
@view-transition {
  navigation: auto;
}

/* 要素に view-transition-name を付与して個別にアニメーション */
.hero-image {
  view-transition-name: hero;
}

.page-title {
  view-transition-name: title;
}

/* カスタムアニメーション */
::view-transition-old(hero) {
  animation: fade-out 0.3s ease-out;
}

::view-transition-new(hero) {
  animation: fade-in 0.3s ease-in;
}
```

#### ブラウザサポート

| ブラウザ | SPA（同一ドキュメント） | MPA（クロスドキュメント） |
|---|---|---|
| Chrome | 111+ | 126+ |
| Edge | 111+ | 126+ |
| Firefox | 133+ | 未対応（開発中） |
| Safari | 18+ | 18.2+ |

SPA（同一ドキュメント）についてはほぼ全主要ブラウザで対応済み。MPA（クロスドキュメント）については Firefox が未対応のため、完全なクロスブラウザ対応には至っていない（2026年3月時点）[[2]](#参考リンク)。

---

### 2. Popover API

JavaScript なしでポップオーバー UI を実現するネイティブ HTML API。2025年4月に Baseline Widely Available に到達した[[3]](#参考リンク)。

#### 主な特徴

- トップレイヤーに表示されるため `z-index` の管理が不要
- 外部クリックで自動的に閉じる（light dismiss）
- Esc キーで閉じる
- フォーカス管理が自動化される

#### HTML 属性

| 属性 | 説明 |
|---|---|
| `popover` | 要素をポップオーバーにする（`auto` / `hint` / `manual`） |
| `popovertarget` | ボタンをポップオーバーの制御要素にする |
| `popovertargetaction` | 動作を指定（`show` / `hide` / `toggle`） |

#### 基本的な使い方

```html title="popover-basic.html"
<!-- ポップオーバーのトリガーボタン -->
<button popovertarget="my-popover">メニューを開く</button>

<!-- ポップオーバー本体 -->
<div id="my-popover" popover>
  <nav>
    <ul>
      <li><a href="/settings">設定</a></li>
      <li><a href="/profile">プロフィール</a></li>
      <li><a href="/logout">ログアウト</a></li>
    </ul>
  </nav>
</div>
```

#### JavaScript API

```ts title="popover-api.ts"
const popover = document.getElementById("my-popover") as HTMLElement;

// プログラムから制御
popover.showPopover();   // 表示
popover.hidePopover();   // 非表示
popover.togglePopover(); // トグル

// イベントリスナー
popover.addEventListener("toggle", (event: ToggleEvent) => {
  if (event.newState === "open") {
    console.log("ポップオーバーが開きました");
  } else {
    console.log("ポップオーバーが閉じました");
  }
});
```

#### CSS スタイリング

```css title="popover-style.css"
/* ポップオーバーが開いている状態のスタイル */
[popover]:popover-open {
  opacity: 1;
  transform: scale(1);
}

/* ポップオーバーの背景（オーバーレイ） */
[popover]::backdrop {
  background-color: rgba(0, 0, 0, 0.3);
}

/* 開閉アニメーション */
[popover] {
  opacity: 0;
  transform: scale(0.95);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    display 0.2s allow-discrete,
    overlay 0.2s allow-discrete;
}
```

#### `popover` 属性の値による違い

| 値 | 外部クリックで閉じる | Esc で閉じる | 他の auto を閉じる |
|---|---|---|---|
| `auto`（デフォルト） | はい | はい | はい |
| `hint` | はい | はい | `hint` のみ閉じる |
| `manual` | いいえ | いいえ | いいえ |

#### ブラウザサポート

全主要ブラウザ（Chrome、Firefox、Safari、Edge）で対応済み。Baseline Widely Available（2025年4月）[[4]](#参考リンク)。

---

### 3. CSS Anchor Positioning

要素を別の「アンカー要素」に相対的に配置する CSS 仕様。ツールチップ、ドロップダウン、ポップオーバーの配置に最適[[5]](#参考リンク)。

#### 主な CSS プロパティ

| プロパティ / 関数 | 役割 |
|---|---|
| `anchor-name` | 要素をアンカーとして定義 |
| `position-anchor` | 参照するアンカーを指定 |
| `anchor()` 関数 | アンカーの特定の辺の位置を取得 |
| `position-area` | アンカー周囲の領域を指定（簡易配置） |
| `position-try-fallbacks` | フォールバック位置を定義 |
| `position-visibility` | 表示・非表示の条件を設定 |

#### 基本的な使い方

```css title="anchor-basic.css"
/* アンカー要素を定義 */
.trigger-button {
  anchor-name: --menu-trigger;
}

/* アンカーに相対配置 */
.dropdown-menu {
  position: fixed;
  position-anchor: --menu-trigger;

  /* アンカーの下中央に配置 */
  position-area: bottom center;
  margin-top: 8px;
}
```

#### フォールバック位置の指定

画面端でポップオーバーがはみ出す場合、自動的に代替位置へ切り替える[[5]](#参考リンク)。

```css title="anchor-fallback.css"
.tooltip {
  position: fixed;
  position-anchor: --target;
  position-area: top center;

  /* 上に表示できない場合は下、右、左の順に試す */
  position-try-fallbacks: bottom center, right center, left center;

  /* どの位置にも収まらない場合は非表示 */
  position-visibility: anchors-visible;
}
```

#### `@position-try` によるカスタムフォールバック

```css title="anchor-position-try.css"
@position-try --below-end {
  position-area: bottom end;
  margin-top: 4px;
  width: 200px;
}

@position-try --above-start {
  position-area: top start;
  margin-bottom: 4px;
  width: 300px;
}

.popover {
  position: fixed;
  position-anchor: --trigger;
  position-area: bottom start;
  position-try-fallbacks: --below-end, --above-start;
}
```

#### 機能検出

```css title="anchor-feature-detection.css"
@supports (anchor-name: --test) {
  /* Anchor Positioning 対応ブラウザ向けのスタイル */
  .tooltip {
    position: fixed;
    position-anchor: --btn;
    position-area: top center;
  }
}

@supports not (anchor-name: --test) {
  /* フォールバック: 従来の position: absolute で配置 */
  .tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
  }
}
```

#### ブラウザサポート

Interop 2025 の対象として主要ブラウザの相互運用が進められた[[6]](#参考リンク)。

| ブラウザ | 対応状況 |
|---|---|
| Chrome | 125+ |
| Edge | 125+ |
| Safari | 26+（2025年リリース） |
| Firefox | 149+（2026年1月〜） |

---

### 4. Navigation API

History API の後継として設計された、SPA 向けのナビゲーション制御 API。2026年1月に Firefox 147 での対応により Baseline Newly Available に到達した[[7]](#参考リンク)。

#### History API との比較

| 観点 | History API | Navigation API |
|---|---|---|
| ナビゲーション検出 | `popstate` + クリックイベントの手動管理 | `navigate` イベントで一元管理 |
| 履歴アクセス | `history.length`（脆弱） | `navigation.entries()`（信頼性高） |
| 状態管理 | `pushState()` / `replaceState()` | `state` プロパティで直接操作 |
| 戻り値 | `void` | Promise（`{ committed, finished }`） |

#### 基本的な使い方

```ts title="navigation-api.ts"
// すべてのナビゲーションを一元的にインターセプト
navigation.addEventListener("navigate", (event: NavigateEvent) => {
  // インターセプト不可なナビゲーションはスキップ
  if (!event.canIntercept) return;

  // フラグメント変更やダウンロードはスキップ
  if (event.hashChange || event.downloadRequest !== null) return;

  const url = new URL(event.destination.url);

  // ルーティング: パスに応じてコンテンツをロード
  if (url.pathname.startsWith("/articles/")) {
    event.intercept({
      // スクロール位置の自動管理
      scroll: "after-transition",
      // フォーカス管理の自動化
      focusReset: "after-transition",
      async handler() {
        // プレースホルダーを即座に表示
        renderLoadingState();
        // コンテンツを非同期で取得・表示
        const content = await fetchArticle(url.pathname);
        renderArticle(content);
      },
    });
  }
});

// ナビゲーションの成功・失敗をハンドリング
navigation.addEventListener("navigatesuccess", () => {
  hideLoadingIndicator();
});

navigation.addEventListener("navigateerror", (event) => {
  showErrorPage(event.error);
});
```

#### プログラムによるナビゲーション

```ts title="navigation-programmatic.ts"
// ページ遷移
const result = navigation.navigate("/new-page", {
  state: { fromButton: true },
});
await result.finished; // 遷移完了を待つ

// 履歴の移動
navigation.back();
navigation.forward();

// 特定の履歴エントリへ移動
const entries = navigation.entries();
const targetEntry = entries.find((e) => new URL(e.url!).pathname === "/target");
if (targetEntry) {
  navigation.traverseTo(targetEntry.key);
}

// 現在のエントリの状態を更新（ナビゲーションなし）
navigation.updateCurrentEntry({
  state: { scrollPosition: window.scrollY },
});
```

#### ブラウザサポート

| ブラウザ | 対応状況 |
|---|---|
| Chrome | 102+ |
| Edge | 102+ |
| Safari | 対応済み（2025年〜） |
| Firefox | 147+（2026年1月） |

---

### 5. Speculation Rules API

ページ遷移を高速化するための投機的読み込み API。`<script type="speculationrules">` でプリフェッチ・プリレンダリングのルールを宣言的に定義する[[8]](#参考リンク)。

#### Prefetch と Prerender の違い

| 特性 | Prefetch | Prerender |
|---|---|---|
| 処理内容 | レスポンスボディのみダウンロード | 全リソース取得 + レンダリング実行 |
| サブリソース | 取得しない | すべて取得・実行 |
| JavaScript | 実行しない | 完全に実行 |
| リソースコスト | 低い | 高い（iframe と同等） |
| 遷移速度 | 通常より高速 | ほぼ瞬時 |
| クロスオリジン | 制限付きで可能 | 同一オリジンのみ（デフォルト） |

#### 基本的な使い方

```html title="speculation-rules.html"
<!-- URL リストによる指定 -->
<script type="speculationrules">
{
  "prerender": [
    {
      "urls": ["/about", "/contact"]
    }
  ],
  "prefetch": [
    {
      "urls": ["/blog", "/products"],
      "eagerness": "moderate"
    }
  ]
}
</script>
```

#### 条件ベースのルール定義

```html title="speculation-rules-where.html"
<!-- パターンマッチングによる柔軟な指定 -->
<script type="speculationrules">
{
  "prerender": [
    {
      "where": {
        "and": [
          { "href_matches": "/*" },
          { "not": { "href_matches": "/logout" } },
          { "not": { "href_matches": "/api/*" } },
          { "not": { "selector_matches": ".no-prerender" } }
        ]
      },
      "eagerness": "moderate"
    }
  ]
}
</script>
```

#### Eagerness レベル

| レベル | 動作 |
|---|---|
| `immediate` | ルール追加時に即座に投機的読み込み |
| `eager` | `immediate` と同等（将来変更の可能性あり） |
| `moderate` | ホバー後200ms で実行（モバイルではビューポート進入時） |
| `conservative` | ポインターダウンまたはタッチダウン時に実行 |

#### 機能検出とフォールバック

```ts title="speculation-feature-detect.ts"
// Speculation Rules API の機能検出
if (
  HTMLScriptElement.supports &&
  HTMLScriptElement.supports("speculationrules")
) {
  // Speculation Rules を動的に追加
  const specScript = document.createElement("script");
  specScript.type = "speculationrules";
  specScript.textContent = JSON.stringify({
    prefetch: [
      {
        urls: ["/next-page"],
        eagerness: "moderate",
      },
    ],
  });
  document.body.append(specScript);
} else {
  // フォールバック: 従来の <link rel="prefetch"> を使用
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = "/next-page";
  document.head.append(link);
}
```

#### ブラウザサポート

現時点では主に Chromium 系ブラウザ（Chrome 121+、Edge 121+）で対応。Firefox・Safari は未対応だが、標準化が WICG で進められている[[9]](#参考リンク)。

---

### 6. Scroll-driven Animations

スクロール位置に連動したアニメーションを CSS だけで実現する仕様。従来は `IntersectionObserver` や `scroll` イベント + JavaScript が必要だった処理を宣言的に記述できる[[10]](#参考リンク)。

#### 2つのタイムライン

| タイムライン | トリガー | ユースケース |
|---|---|---|
| ScrollTimeline | コンテナのスクロール位置 | プログレスバー、パララックス |
| ViewTimeline | 要素のビューポート内位置 | フェードイン、スライドイン |

#### ScrollTimeline の例

```css title="scroll-timeline.css"
/* スクロール進捗に連動するプログレスバー */
.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 4px;
  background: linear-gradient(to right, #3b82f6, #8b5cf6);
  transform-origin: left;

  /* スクロールに連動するアニメーション */
  animation: grow-progress linear;
  animation-timeline: scroll(root block);
}

@keyframes grow-progress {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
```

#### ViewTimeline の例

```css title="view-timeline.css"
/* ビューポートに入ったらフェードインする要素 */
.fade-in-section {
  animation: fade-slide-in linear both;
  animation-timeline: view();
  /* 要素が25%見えた時点から75%見えた時点までアニメーション */
  animation-range: entry 25% cover 50%;
}

@keyframes fade-slide-in {
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### JavaScript API

```ts title="scroll-animation-js.ts"
// JavaScript での ScrollTimeline 作成
const scrollTimeline = new ScrollTimeline({
  source: document.documentElement,
  axis: "block",
});

// ViewTimeline の作成
const card = document.querySelector(".card") as HTMLElement;
const viewTimeline = new ViewTimeline({
  subject: card,
  axis: "block",
});

// Web Animations API と組み合わせて使用
card.animate(
  [
    { opacity: 0, transform: "scale(0.8)" },
    { opacity: 1, transform: "scale(1)" },
  ],
  {
    timeline: viewTimeline,
    rangeStart: "entry 0%",
    rangeEnd: "cover 40%",
    fill: "both",
  }
);
```

#### 機能検出

```css title="scroll-animation-fallback.css"
/* スクロールアニメーション非対応ブラウザ向けフォールバック */
@supports not (animation-timeline: scroll()) {
  .fade-in-section {
    /* JavaScript による IntersectionObserver フォールバックを前提 */
    opacity: 0;
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  .fade-in-section.is-visible {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### ブラウザサポート

| ブラウザ | 対応状況 |
|---|---|
| Chrome | 115+ |
| Edge | 115+ |
| Safari | 26+（2025年リリース） |
| Firefox | フラグ付き実験的サポート（デフォルト無効） |

---

## 検証結果

### Popover API + CSS Anchor Positioning の組み合わせ

Popover API と CSS Anchor Positioning を組み合わせることで、JavaScript なしでツールチップやドロップダウンメニューを実装できる。

```html title="popover-anchor-combined.html"
<!-- アンカー要素（トリガーボタン） -->
<button popovertarget="tooltip" class="anchor-btn">
  ヘルプ
</button>

<!-- ポップオーバー + アンカー配置 -->
<div id="tooltip" popover="hint" class="tooltip-content">
  この機能についての説明テキストです。
  詳しくは<a href="/docs">ドキュメント</a>をご覧ください。
</div>
```

```css title="popover-anchor-combined.css"
/* アンカーの定義 */
.anchor-btn {
  anchor-name: --help-btn;
}

/* ポップオーバーをアンカーに相対配置 */
.tooltip-content {
  position: fixed;
  position-anchor: --help-btn;
  position-area: top center;
  margin-bottom: 8px;

  /* フォールバック位置 */
  position-try-fallbacks: bottom center;

  /* スタイル */
  background: #1e293b;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  max-width: 250px;
}

/* 開閉アニメーション */
.tooltip-content:popover-open {
  opacity: 1;
  transform: translateY(0);
}

.tooltip-content {
  opacity: 0;
  transform: translateY(4px);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    display 0.15s allow-discrete,
    overlay 0.15s allow-discrete;
}
```

### View Transitions API + Navigation API の組み合わせ

SPA フレームワークなしで、ネイティブ API だけでルーティングとページ遷移アニメーションを実現する例。

```ts title="spa-routing.ts"
// Navigation API + View Transitions によるルーティング
navigation.addEventListener("navigate", (event: NavigateEvent) => {
  if (!event.canIntercept) return;
  if (event.hashChange || event.downloadRequest !== null) return;

  const url = new URL(event.destination.url);

  event.intercept({
    async handler() {
      const response = await fetch(url.pathname);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const newContent = doc.querySelector("#content")!.innerHTML;

      // View Transitions でアニメーション付きで DOM を更新
      if (document.startViewTransition) {
        const transition = document.startViewTransition(() => {
          document.querySelector("#content")!.innerHTML = newContent;
          document.title = doc.title;
        });
        await transition.finished;
      } else {
        document.querySelector("#content")!.innerHTML = newContent;
        document.title = doc.title;
      }
    },
  });
});
```

```css title="spa-routing-transitions.css"
/* ページ遷移アニメーション */
::view-transition-old(content) {
  animation: slide-out 0.25s ease-in;
}

::view-transition-new(content) {
  animation: slide-in 0.25s ease-out;
}

@keyframes slide-out {
  to {
    opacity: 0;
    transform: translateX(-20px);
  }
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
}

#content {
  view-transition-name: content;
}
```

### Polyfill・フォールバック戦略まとめ

| API | Polyfill / フォールバック |
|---|---|
| View Transitions | `document.startViewTransition` の存在チェック。未対応時は即座に DOM 更新 |
| Popover API | `@oddbird/popover-polyfill` が利用可能 |
| CSS Anchor Positioning | `@supports (anchor-name: --test)` で検出。フォールバックは `position: absolute` |
| Navigation API | History API へフォールバック |
| Speculation Rules | `HTMLScriptElement.supports("speculationrules")` で検出。`<link rel="prefetch">` にフォールバック |
| Scroll-driven Animations | `scroll-timeline-polyfill` が利用可能。`IntersectionObserver` へフォールバック |

## まとめ

- **View Transitions API** は SPA（同一ドキュメント）については全主要ブラウザで対応済み。MPA（クロスドキュメント）は Firefox が未対応のため、MPA での利用時はフォールバックを考慮する必要がある
- **Popover API** は Baseline Widely Available に到達しており、即座に本番採用可能。`dialog` 要素との使い分け（モーダル vs 非モーダル）を意識する
- **CSS Anchor Positioning** は Popover API と組み合わせることで、Floating UI などの JavaScript ライブラリを置き換えられる。Firefox 149+ で対応が完了し、全主要ブラウザで利用可能になった
- **Navigation API** は 2026年1月に Baseline Newly Available に到達。SPA のルーティング処理を簡素化できるが、フレームワークが内部的に採用するケースが多くなると予想される
- **Speculation Rules API** は Chromium 系のみの対応だが、プログレッシブエンハンスメントとして導入しやすい。MPA サイトのパフォーマンス改善に効果的
- **Scroll-driven Animations** は Chrome・Edge・Safari 26 で対応済みだが、Firefox はフラグ付き実験的サポートにとどまる。`@supports` による段階的導入が推奨される

全体として、これらの API は「JavaScript ライブラリで行っていた処理をブラウザネイティブに移行する」というトレンドを強く推進しており、バンドルサイズの削減・パフォーマンス向上・アクセシビリティ改善に寄与する。`@supports` や機能検出によるプログレッシブエンハンスメントを前提に、段階的な導入を進めるのが現実的なアプローチである。

## 参考リンク

1. [View Transition API - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API)
2. [Smooth transitions with the View Transition API | Chrome for Developers](https://developer.chrome.com/docs/web-platform/view-transitions)
3. [Popover API - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API)
4. [Popover API lands in Baseline | web.dev](https://web.dev/blog/popover-api)
5. [CSS Anchor Positioning - CSS | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning)
6. [Interop 2025: Anchor Positioning, View Transitions, Storage Access Soon Stable across Browsers - InfoQ](https://www.infoq.com/news/2025/04/interop-2025-key-features/)
7. [Navigation API - a better way to navigate, is now Baseline Newly Available | web.dev](https://web.dev/blog/baseline-navigation-api)
8. [Speculation Rules API - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/Speculation_Rules_API)
9. [Improvements to the Speculation Rules API | Chrome for Developers](https://developer.chrome.com/blog/speculation-rules-improvements)
10. [CSS scroll-driven animations - CSS | MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations)
