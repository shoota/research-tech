---
id: eslint-plugin-vitest-rules
title: "@vitest/eslint-plugin ルール Tier 表 — 有効性評価ガイド"
description: "Vitest公式ESLintプラグインの全80ルールを汎用性・重要度・便利さで評価し、必須/推奨/好み分かれるの3+1段階にTier分類。recommended設定例付き。"
sidebar_position: 4
tags: [vitest, eslint, testing, linter]
last_update:
  date: 2026-03-31
---

# @vitest/eslint-plugin ルール Tier 表 — 有効性評価ガイド

## 概要

Vitest 公式 ESLint プラグイン `@vitest/eslint-plugin`（旧 `eslint-plugin-vitest`）が提供する全 80 ルールについて、汎用性・重要度・便利さの観点から有効性を評価し、Tier 表として分類した[[1]](#参考リンク)。

## 背景・動機

Vitest を導入したプロジェクトで ESLint ルールを設定する際、`recommended` プリセットだけでは不十分なケースがある一方、`all` プリセットは過剰になりがちである。プロジェクトの性質に合わせてルールを取捨選択するための判断材料として、各ルールの有効性を体系的に整理した。

## 調査内容

### パッケージ情報

| 項目 | 内容 |
|------|------|
| **パッケージ名** | `@vitest/eslint-plugin`（`eslint-plugin-vitest` は非推奨）[[1]](#参考リンク) |
| **総ルール数** | 80 |
| **recommended 収録数** | 17（error: 16、warn: 1） |
| **自動修正対応** | 約 42 ルール |
| **要件** | ESLint v9.0.0 以上 |

### 設定プリセット

```ts title="eslint.config.ts"
import vitest from "@vitest/eslint-plugin";

export default [
  {
    files: ["**/*.test.ts"],
    ...vitest.configs.recommended,  // 17 ルール（推奨）
  },
];
```

`recommended` のほかに `all`（全ルール有効）、`legacy-recommended` / `legacy-all`（ESLint 8 向け）、`env`（Vitest グローバル変数定義）が提供されている[[1]](#参考リンク)。

---

## Tier 表

### 評価基準

| 観点 | 説明 |
|------|------|
| **汎用性** | プロジェクトの種類・規模を問わず適用できるか |
| **重要度** | 違反が CI の信頼性やバグ検出に直結するか |
| **便利度** | 自動修正の有無、開発体験の向上に寄与するか |

---

### Tier S — 必須（全プロジェクトで有効化すべき）

CI の信頼性やテスト品質に直結するルール。`recommended` に含まれるものが中心。

| ルール | 説明 | Fix | Rec |
|--------|------|:---:|:---:|
| `no-focused-tests` | `.only` の残留を検出。CI で一部テストしか実行されない事故を防ぐ | ✅ | ✅ |
| `no-identical-title` | 同一 `describe` 内でのテスト名重複を検出 | ✅ | ✅ |
| `expect-expect` | テスト本文にアサーションがないケースを検出 | — | ✅ |
| `valid-expect` | `expect()` の不正な使い方（引数なし、未完了チェーン等）を検出 | ✅ | ✅ |
| `valid-expect-in-promise` | Promise チェーン内の `expect` が `return` / `await` されているか検証 | — | ✅ |
| `valid-describe-callback` | `describe` のコールバックが正しい形式か検証 | — | ✅ |
| `valid-title` | テストタイトルの空文字・不正パターンを検出 | ✅ | ✅ |
| `no-conditional-expect` | 条件分岐内の `expect` を禁止し、テストの確実性を担保 | — | ✅ |
| `no-standalone-expect` | `it` / `test` ブロック外の `expect` を検出 | — | ✅ |
| `no-import-node-test` | `node:test` の誤インポートを検出（Vitest との混同防止） | ✅ | ✅ |
| `no-disabled-tests` | `.skip` テストの放置を警告 | — | ✅(warn) |
| `no-commented-out-tests` | コメントアウトされたテストを検出 | — | ✅ |

**導入のポイント**: これらは `recommended` プリセットでほぼカバーされる。最低限 `recommended` を適用するだけで Tier S の大半が有効になる。

---

### Tier A — 強く推奨（ほとんどのプロジェクトで有効化したい）

テストの可読性・保守性を大きく向上させるルール。`recommended` に含まれるものと含まれないものが混在。

| ルール | 説明 | Fix | Rec |
|--------|------|:---:|:---:|
| `no-interpolation-in-snapshots` | スナップショット内の文字列補間を禁止（スナップ安定性） | ✅ | ✅ |
| `no-mocks-import` | `__mocks__` ディレクトリからの直接インポートを禁止 | — | ✅ |
| `require-local-test-context-for-concurrent-snapshots` | concurrent テストでのスナップショット使用時に Test Context を要求 | — | ✅ |
| `no-unneeded-async-expect-function` | 不要な async ラッパーを検出・除去 | ✅ | ✅ |
| `prefer-called-exactly-once-with` | `toHaveBeenCalledExactlyOnceWith` の利用を促進 | ✅ | ✅ |
| `prefer-to-be` | `toBe()` の使用を促進（`toEqual(primitive)` より明確） | ✅ | — |
| `prefer-to-have-length` | `toHaveLength()` の使用を促進 | ✅ | — |
| `prefer-to-contain` | `toContain()` の使用を促進 | ✅ | — |
| `prefer-mock-promise-shorthand` | `mockResolvedValue` / `mockRejectedValue` の短縮形を強制 | ✅ | — |
| `prefer-spy-on` | `vi.spyOn` の使用を促進 | ✅ | — |
| `prefer-vi-mocked` | `fn as Mock` キャストの代わりに `vi.mocked()` を強制 | ✅ | — |
| `prefer-todo` | 空テストの代わりに `test.todo` を強制 | ✅ | — |
| `no-conditional-in-test` | テスト本文内の条件分岐を禁止（テストの明確性向上） | — | — |
| `hoisted-apis-on-top` | `vi.mock` / `vi.hoisted` をファイル先頭に配置 | — | — |
| `prefer-hooks-on-top` | フック定義をテストケースより上に配置 | — | — |
| `prefer-hooks-in-order` | `beforeAll` → `beforeEach` → `afterEach` → `afterAll` の順序を強制 | — | — |
| `no-done-callback` | done コールバック（Jasmine 形式）の代わりに async/await を推奨 | — | — |

**導入のポイント**: `recommended` + これらを追加設定するのが実用的。`prefer-*` 系は自動修正対応が多く、既存コードへの適用コストが低い。

---

### Tier B — 推奨（プロジェクト方針に応じて採用）

有用だが、プロジェクトの規模や方針によって判断が分かれるルール。

| ルール | 説明 | Fix |
|--------|------|:---:|
| `consistent-test-it` | `test` と `it` の混在を禁止 | ✅ |
| `no-alias-methods` | 非推奨エイリアスメソッド（`toBeCalled` → `toHaveBeenCalled` 等）を禁止 | ✅ |
| `no-test-prefixes` | `fit` / `xit` 等の古いプレフィックスを禁止（`.only` / `.skip` を使う） | ✅ |
| `prefer-called-with` | `toHaveBeenCalled()` の代わりに `toHaveBeenCalledWith()` を推奨 | ✅ |
| `prefer-called-once` | `toHaveBeenCalledTimes(1)` の代わりに `toHaveBeenCalledOnce()` を推奨 | ✅ |
| `prefer-comparison-matcher` | `toBe(a > b)` の代わりに `toBeGreaterThan` 等を推奨 | ✅ |
| `prefer-equality-matcher` | 組み込み等価マッチャーの使用を推奨 | — |
| `prefer-mock-return-shorthand` | `mockReturnValue` 短縮形を推奨 | ✅ |
| `prefer-expect-resolves` | `expect(await fn())` より `await expect(fn()).resolves` を推奨 | ✅ |
| `prefer-strict-equal` | `toEqual` より `toStrictEqual` を推奨 | — |
| `require-to-throw-message` | `toThrow()` にエラーメッセージ引数を要求 | — |
| `require-top-level-describe` | 全テストをトップレベル `describe` で囲むことを要求 | — |
| `no-duplicate-hooks` | 同じスコープ内での重複フック定義を禁止 | — |
| `no-large-snapshots` | 大きすぎるスナップショットを禁止（閾値設定可能） | — |
| `max-nested-describe` | `describe` のネスト深度を制限 | — |
| `max-expects` | 1テストあたりの `expect` 数を制限 | — |
| `require-mock-type-parameters` | `vi.fn()` / `vi.spyOn()` の型パラメータを要求 | ✅ |
| `consistent-vitest-vi` | `vitest` と `vi` の混在を禁止 | ✅ |

**導入のポイント**: チーム内でコーディング規約を統一したい場合に有効。`consistent-*` 系はチーム合意が前提。`max-*` 系は閾値の調整が必要。

---

### Tier C — 好みが分かれる（特定ユースケース向け）

有用な場面はあるが、万人向けではないルール。プロジェクトの特性や個人の好みで判断する。

| ルール | 説明 | Fix |
|--------|------|:---:|
| `prefer-each` | ループ内テストの代わりに `.each` を推奨 | — |
| `prefer-expect-assertions` | テスト冒頭に `expect.assertions(N)` を要求 | — |
| `prefer-snapshot-hint` | 外部スナップショットにヒント文字列を要求 | — |
| `prefer-describe-function-title` | `describe` のタイトルに関数参照を強制 | ✅ |
| `prefer-lowercase-title` | テストタイトルの先頭小文字を強制 | ✅ |
| `prefer-to-be-truthy` / `prefer-to-be-falsy` | `toBeTruthy()` / `toBeFalsy()` を推奨 | ✅ |
| `prefer-to-be-object` | `toBeObject()` を推奨 | ✅ |
| `prefer-strict-boolean-matchers` | `toBeTruthy` の代わりに `toBe(true)` を推奨 | ✅ |
| `prefer-expect-type-of` | `expect(typeof x)` の代わりに `expectTypeOf` を推奨 | ✅ |
| `prefer-import-in-mock` | mock 内で動的 import を推奨 | ✅ |
| `no-importing-vitest-globals` | Vitest グローバルの import を禁止（`globals: true` 前提） | ✅ |
| `prefer-importing-vitest-globals` | Vitest グローバルの import を強制（`globals: false` 前提） | ✅ |
| `consistent-each-for` | `.each` と `.for` の統一 | — |
| `consistent-test-filename` | テストファイル名パターンを強制 | — |
| `no-conditional-tests` | 条件付きテスト登録（`if (cond) it(...)`）を禁止 | — |
| `no-test-return-statement` | テストの `return` 文を禁止 | — |
| `no-restricted-matchers` | 特定マッチャーの使用禁止（カスタマイズ前提） | — |
| `no-restricted-vi-methods` | 特定 `vi.*` メソッドの使用禁止（カスタマイズ前提） | — |
| `require-hook` | セットアップコードのフック内配置を強制 | — |
| `require-test-timeout` | テストにタイムアウト設定を要求 | — |
| `require-awaited-expect-poll` | `expect.poll` の await を要求 | — |
| `no-hooks` | フック自体を禁止（ファクトリ関数パターン向け） | — |
| `unbound-method` | 非バインドメソッドの使用を検出（TS ESLint 派生） | — |
| `warn-todo` | `test.todo` に警告を出す | — |
| `padding-around-*`（8 ルール） | ブロック前後の空行を強制 | ✅ |

**補足**:
- `prefer-to-be-truthy` と `prefer-strict-boolean-matchers` は互いに矛盾するため、どちらか一方のみ有効化すること
- `no-importing-vitest-globals` と `prefer-importing-vitest-globals` も排他的な関係
- `padding-around-all` を使えば 8 つの padding ルールをまとめて有効化できる

---

## 検証結果 — おすすめ設定例

### ミニマル構成（Tier S のみ）

```ts title="eslint.config.ts"
import vitest from "@vitest/eslint-plugin";

export default [
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    ...vitest.configs.recommended,
  },
];
```

`recommended` を適用するだけで Tier S の 17 ルールが有効になる。

### バランス構成（Tier S + A の主要ルール）

```ts title="eslint.config.ts"
import vitest from "@vitest/eslint-plugin";

export default [
  {
    files: ["**/*.test.ts", "**/*.spec.ts"],
    ...vitest.configs.recommended,
    rules: {
      // Tier A 追加ルール
      "vitest/prefer-to-be": "error",
      "vitest/prefer-to-have-length": "error",
      "vitest/prefer-to-contain": "error",
      "vitest/prefer-mock-promise-shorthand": "error",
      "vitest/prefer-spy-on": "error",
      "vitest/prefer-vi-mocked": "error",
      "vitest/prefer-todo": "error",
      "vitest/no-conditional-in-test": "error",
      "vitest/hoisted-apis-on-top": "warn",
      "vitest/prefer-hooks-on-top": "error",
      "vitest/prefer-hooks-in-order": "error",
      "vitest/no-done-callback": "error",
    },
  },
];
```

### フル構成（Tier S + A + B）

バランス構成に加えて、チーム規約として以下を追加:

```ts title="eslint.config.ts（rules 追加分のみ）"
{
  // Tier B 追加ルール（チーム合意の上で）
  "vitest/consistent-test-it": ["error", { fn: "it" }],
  "vitest/no-alias-methods": "error",
  "vitest/no-test-prefixes": "error",
  "vitest/prefer-called-with": "error",
  "vitest/prefer-strict-equal": "warn",
  "vitest/require-to-throw-message": "warn",
  "vitest/no-duplicate-hooks": "error",
  "vitest/max-nested-describe": ["error", { max: 3 }],
  "vitest/require-mock-type-parameters": "error",
}
```

---

## まとめ

- **まず `recommended` から始めるのが正解**。17 ルールで CI 信頼性に関わる重大な問題を網羅している
- **Tier A の `prefer-*` 系ルール**は自動修正対応が多く、既存プロジェクトへの導入コストが低い。段階的に追加していくのが現実的
- **Tier B の `consistent-*` / `max-*` 系**はチーム合意が前提。コードレビューで議論になりがちなスタイルを機械的に統一できる利点がある
- **Tier C は「入れるかどうか」を考える必要がある**ルール群。`no-hooks` のようにテスト設計哲学に踏み込むものは、チームのテスト方針が明確でないと逆効果になる
- `prefer-to-be-truthy` と `prefer-strict-boolean-matchers` のような**排他的ルール**の存在に注意。設定前に矛盾がないか確認すること

## 参考リンク

1. [vitest-dev/eslint-plugin-vitest — GitHub](https://github.com/vitest-dev/eslint-plugin-vitest)
2. [@vitest/eslint-plugin — npm](https://www.npmjs.com/package/@vitest/eslint-plugin)
3. [Vitest 公式ドキュメント](https://vitest.dev/)
