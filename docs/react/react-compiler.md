---
id: react-compiler
title: React Compiler - 自動メモ化コンパイラの仕組みと導入
sidebar_position: 4
tags: [react, compiler, optimization, memoization]
last_update:
  date: 2026-03-06
---

# React Compiler - 自動メモ化コンパイラの仕組みと導入

## 概要

React Compiler（旧称React Forget）の仕組み、自動メモ化の原理、導入方法、および既存プロジェクトへの段階的導入戦略について調査した。React Compilerはビルド時にコンポーネントとフックを解析し、最適なメモ化を自動適用するコンパイラである。

## 背景・動機

Reactアプリケーションのパフォーマンス最適化では、従来`useMemo`、`useCallback`、`React.memo`を手動で適用する必要があった。しかし、これらの手動メモ化は以下の課題を抱えていた。

- 依存配列の指定ミスによるバグの発生
- メモ化すべき箇所の判断が開発者の経験に依存
- コードの可読性低下とメンテナンスコストの増大
- 不要なメモ化によるオーバーヘッド

2025年10月にReact Compiler v1.0が安定版としてリリースされ[[1]](#参考リンク)、本番環境での利用が推奨される段階に達した。プロジェクトへの導入可否を判断するため、技術的な仕組みと導入戦略を整理する。

## 調査内容

### 1. React Compilerの仕組み

React Compilerはビルド時に動作するツールで、Reactコンポーネントとフックを解析し、自動的に最適なメモ化を適用する[[2]](#参考リンク)。

#### コンパイルプロセス

コンパイラは以下のステップでコードを変換する。

1. **ソースコードの解析**: コンポーネントとフックの関数を解析し、Control Flow Graph（CFG）ベースのHigh-Level Intermediate Representation（HIR）に変換する[[1]](#参考リンク)
2. **純粋性解析**: データフローと変更可能性を分析し、関数が純粋であるかどうかを判定する
3. **メモ化の挿入**: 各propsに対する等価性チェックを自動挿入し、変更されていないサブツリーのレンダリングをスキップする
4. **最適化コードの出力**: `react/compiler-runtime`を利用した最適化済みコードを生成する

#### 自動メモ化の2つの最適化対象

**カスケード再レンダリングの抑制**: 親コンポーネントの状態変更時に、影響を受けない子コンポーネントの再レンダリングを自動的にスキップする。

**高コストな計算のメモ化**: コンポーネントやフック内の重い計算を自動的にキャッシュし、入力が変わらない限り再計算をスキップする。

#### 手動メモ化との比較

手動メモ化では対応が難しいケースでも、コンパイラは正確に最適化できる。例えば、条件分岐の後や早期リターンの後にある値でも、コンパイラは条件付きでメモ化を適用できる[[1]](#参考リンク)。

### 2. useMemo/useCallback/React.memoが不要になる世界

React Compilerが適用されたコードでは、手動のメモ化APIが原則として不要になる。

#### Before: 手動メモ化（バグを含みやすいコード）

```tsx title="ManualMemoization.tsx"
import { useMemo, useCallback, memo } from "react";

// React.memoで明示的にラップ
const ExpensiveComponent = memo(function ExpensiveComponent({
  data,
  onClick,
}: {
  data: Item[];
  onClick: (id: string) => void;
}) {
  // useMemoで計算結果をキャッシュ
  const processedData = useMemo(() => {
    return expensiveProcessing(data);
  }, [data]);

  // useCallbackでコールバックを安定化
  const handleClick = useCallback(
    (item: Item) => {
      onClick(item.id);
    },
    [onClick]
  );

  return (
    <div>
      {processedData.map((item) => (
        // アロー関数が毎回新しい参照を生成するバグ
        <Item key={item.id} onClick={() => handleClick(item)} />
      ))}
    </div>
  );
});
```

#### After: React Compiler適用後

```tsx title="WithCompiler.tsx"
// memo, useMemo, useCallbackは不要
function ExpensiveComponent({
  data,
  onClick,
}: {
  data: Item[];
  onClick: (id: string) => void;
}) {
  // コンパイラが自動的にメモ化を適用
  const processedData = expensiveProcessing(data);

  const handleClick = (item: Item) => {
    onClick(item.id);
  };

  return (
    <div>
      {processedData.map((item) => (
        // コンパイラがアロー関数の参照安定性も自動的に処理
        <Item key={item.id} onClick={() => handleClick(item)} />
      ))}
    </div>
  );
}
```

コンパイラは手動メモ化と同等以上の精度でメモ化を適用する[[2]](#参考リンク)。既存のuseMemo/useCallbackは残しても問題ないが、新規コードでは不要となる。

#### 手動メモ化が依然有効なケース

- メモ化した値をuseEffectの依存配列で使用する場合（エフェクトの不要な発火を防ぐ）
- React外部の関数で高コストな計算を行い、複数コンポーネント間で共有する場合

### 3. コンパイラの前提条件（Rules of React）

React Compilerは「Rules of React」に準拠したコードに対してのみ正しく動作する[[3]](#参考リンク)。

#### コンポーネントとフックは純粋でなければならない

- **冪等性**: 同じ入力（props、state、context）に対して常に同じ出力（JSX）を返す
- **レンダー中の副作用禁止**: DOM操作、データフェッチ、タイマー設定などをレンダー中に行わない
- **props・stateの不変性**: propsやstateを直接変更（ミューテーション）しない

```tsx
// NG: レンダー中の副作用
function BadComponent({ data }: { data: Item[] }) {
  // レンダー中にDOMを操作してはいけない
  document.title = `Items: ${data.length}`;
  return <List items={data} />;
}

// OK: useEffectで副作用を分離
function GoodComponent({ data }: { data: Item[] }) {
  useEffect(() => {
    document.title = `Items: ${data.length}`;
  }, [data.length]);
  return <List items={data} />;
}
```

```tsx
// NG: propsの直接変更
function BadSort({ items }: { items: Item[] }) {
  // 元の配列を変更してしまう
  items.sort((a, b) => a.name.localeCompare(b.name));
  return <List items={items} />;
}

// OK: 新しい配列を作成
function GoodSort({ items }: { items: Item[] }) {
  const sorted = items.slice().sort((a, b) => a.name.localeCompare(b.name));
  return <List items={sorted} />;
}
```

#### コンパイラが検出するルール違反

コンパイラのバリデーションパスは、データフローと変更可能性の分析に基づいて以下のルール違反を検出する[[1]](#参考リンク)。

- `set-state-in-render`: レンダー中のsetState呼び出し（レンダーループの原因）
- `set-state-in-effect`: Effect内での非効率なsetStateパターン
- `refs`: レンダー中のref参照（安全でないアクセス）

### 4. 導入方法と設定

#### インストール

```bash
npm install -D babel-plugin-react-compiler@latest
```

React 17/18を使用している場合は、追加でランタイムパッケージが必要:

```bash
npm install react-compiler-runtime
```

#### Viteでの設定

```ts title="vite.config.ts"
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react({
      babel: {
        // React Compilerは必ずプラグインリストの最初に配置
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
  ],
});
```

#### Next.jsでの設定

Next.js 15.3.1以降ではswc経由でのコンパイルがサポートされ、ビルドパフォーマンスが向上する[[1]](#参考リンク)。設定は[Next.js公式ドキュメント](https://nextjs.org/docs/app/api-reference/next-config-js/reactCompiler)を参照。

#### Babelでの設定

```js title="babel.config.js"
module.exports = {
  plugins: [
    "babel-plugin-react-compiler", // 必ず最初に配置
    // ... その他のプラグイン
  ],
};
```

#### 対応ビルドツール

| ビルドツール | サポート状況 |
|---|---|
| Babel | 安定版（プライマリ実装） |
| Vite | 安定版 |
| Next.js | 安定版（swc経由、v15.3.1+） |
| Rsbuild | 安定版 |
| Metro (React Native) | 安定版 |
| webpack | コミュニティローダー |
| swc | 実験的サポート |
| oxc | 開発中 |

#### 動作確認

React DevToolsで最適化されたコンポーネントに「Memo ✨」バッジが表示されることを確認できる[[4]](#参考リンク)。

### 5. eslint-plugin-react-compilerの役割

React Compiler v1.0のリリースに伴い、コンパイラ用のlintルールは`eslint-plugin-react-hooks`の`recommended-latest`プリセットに統合された[[1]](#参考リンク)[[9]](#参考リンク)。従来の`eslint-plugin-react-compiler`は不要になった。

#### 設定方法

```js title="eslint.config.mjs"
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // recommended-latestにコンパイラのルールが含まれる
  reactHooks.configs.flat["recommended-latest"],
]);
```

#### ESLintルールの役割

- Rules of Reactに違反するコードを検出し、コンパイラが最適化をスキップする箇所を開発者に通知する
- エラーが報告された場合、該当のコンポーネントやフックはコンパイラの最適化対象外となる
- 全ての違反を即座に修正する必要はなく、段階的に対応できる

### 6. 制約・既知の問題

#### メモ化のスコープ制限

- コンパイラのメモ化はコンポーネント単位であり、**複数コンポーネント間でキャッシュは共有されない**[[2]](#参考リンク)
- React外部のスタンドアロン関数はメモ化の対象外
- 同じ計算が複数のコンポーネントで使用される場合、それぞれで個別に実行される

#### ライブラリ互換性の問題

- **MobX**: 内部的なミュータブル状態管理がReact Compilerの前提と矛盾するため、`"use no memo"`ディレクティブが必要になる場合がある[[5]](#参考リンク)
- **react-hook-form**: 関数参照が同一のまま戻り値が変化する「内部ミュータビリティ」パターンは、コンパイラが検出できない[[5]](#参考リンク)

#### "use no memo"ディレクティブ

問題のあるコンポーネントをコンパイラの最適化対象から除外するエスケープハッチ:

```tsx
function ProblematicComponent() {
  "use no memo"; // このコンポーネントはコンパイル対象外
  // MobXやmutableな状態に依存するコード
  return <div>{store.value}</div>;
}
```

このディレクティブは一時的な回避策であり、`"use client"`のように恒久的に使用することは想定されていない[[5]](#参考リンク)。

#### バージョンアップ時の注意

将来のバージョンではメモ化の挙動が変更される可能性があり、メモ化された値に依存するEffectの動作が変わる場合がある。E2Eテストのカバレッジが限定的な場合は、コンパイラのバージョンを`--save-exact`で固定し、手動でアップグレードすることが推奨される[[1]](#参考リンク)。

### 7. パフォーマンス改善の実例

React Compilerの実プロダクションでの効果が複数の企業から報告されている。

| 企業/プロダクト | 改善内容 |
|---|---|
| Meta（Quest Store） | 初期ロード最大12%高速化、一部インタラクション2.5倍以上高速化[[1]](#参考リンク) |
| Meta（Instagram） | 全ページ平均3%改善[[6]](#参考リンク) |
| Sanity Studio | レンダリング時間・レイテンシ20〜30%削減、1,411コンポーネント中1,231がコンパイル成功[[6]](#参考リンク) |
| Wakelet | LCP 10%改善、INP 15%改善（純粋なReactコンポーネントでは30%近いINP改善）[[6]](#参考リンク) |

メモリ使用量はニュートラル（増減なし）とされている[[1]](#参考リンク)。

### 8. 既存プロジェクトへの段階的導入戦略

React Compilerは3つの段階的導入方式を提供しており、プロジェクトの状況に応じて選択できる[[7]](#参考リンク)。

#### 戦略1: ディレクトリ単位の導入

Babelの`overrides`オプションを使い、特定ディレクトリのみにコンパイラを適用する:

```js title="babel.config.js"
module.exports = {
  overrides: [
    {
      // まず新しいコードから適用開始
      test: "./src/features/**/*.{js,jsx,ts,tsx}",
      plugins: ["babel-plugin-react-compiler"],
    },
  ],
};
```

範囲を徐々に拡大:

```js title="babel.config.js"
module.exports = {
  overrides: [
    {
      test: [
        "./src/features/**/*.{js,jsx,ts,tsx}",
        "./src/components/**/*.{js,jsx,ts,tsx}", // 次のフェーズで追加
      ],
      plugins: ["babel-plugin-react-compiler"],
    },
  ],
};
```

#### 戦略2: アノテーションベースの導入

`compilationMode: 'annotation'`を設定し、`"use memo"`ディレクティブを付与したコンポーネントのみをコンパイルする:

```js title="babel.config.js"
module.exports = {
  plugins: [
    [
      "babel-plugin-react-compiler",
      {
        compilationMode: "annotation",
      },
    ],
  ],
};
```

```tsx title="OptedInComponent.tsx"
function TodoList({ todos }: { todos: Todo[] }) {
  "use memo"; // このコンポーネントのみコンパイル対象
  const sortedTodos = todos.slice().sort((a, b) => a.priority - b.priority);
  return (
    <ul>
      {sortedTodos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
```

#### 戦略3: ランタイムフィーチャーフラグによる制御

フィーチャーフラグを使ってA/Bテストや段階的ロールアウトを行う:

```js title="babel.config.js"
module.exports = {
  plugins: [
    [
      "babel-plugin-react-compiler",
      {
        gating: {
          source: "ReactCompilerFeatureFlags",
          importSpecifierName: "isCompilerEnabled",
        },
      },
    ],
  ],
};
```

```ts title="ReactCompilerFeatureFlags.ts"
export function isCompilerEnabled(): boolean {
  // 環境変数やフィーチャーフラグサービスを利用
  return getFeatureFlag("react-compiler-enabled");
}
```

#### 推奨する導入手順

1. `eslint-plugin-react-hooks`の`recommended-latest`を有効化し、ルール違反を確認
2. `react-compiler-healthcheck`ツールでコードベースの互換性を評価
3. 戦略1（ディレクトリ単位）または戦略2（アノテーション）で小さい範囲から開始
4. React DevToolsの「Memo ✨」バッジで最適化状況を確認
5. パフォーマンス計測（Lighthouse、React Profiler）で効果を検証
6. 対象範囲を段階的に拡大

## 検証結果

### コンパイル前後のコード比較

React Compiler Playground[[8]](#参考リンク)を使って、コンパイラがどのようなコードを出力するか確認した。

#### 入力コード

```tsx
function ProductList({ products, onSelect }) {
  const sorted = products.slice().sort((a, b) => a.price - b.price);
  const total = sorted.reduce((sum, p) => sum + p.price, 0);

  return (
    <div>
      <p>合計: {total}円</p>
      {sorted.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onClick={() => onSelect(product.id)}
        />
      ))}
    </div>
  );
}
```

#### コンパイラの動作

コンパイラは以下の最適化を自動適用する:

- `products`が変更されていない場合、`sort`と`reduce`の再計算をスキップ
- 各`ProductCard`に渡される`onClick`コールバックの参照安定性を確保
- `products`または`onSelect`が変更された場合のみ再レンダリングを実行

手動で同等の最適化を行う場合、`useMemo`を2箇所、`useCallback`を1箇所使用する必要があるが、コンパイラはこれを自動的に処理する。

### React DevToolsでの確認

コンパイラが適用されたコンポーネントはReact DevToolsのComponentsタブで「Memo ✨」バッジが表示される。このバッジの有無で、特定のコンポーネントが最適化されているかどうかを簡単に判別できる。

## まとめ

### 所感

React Compilerは手動メモ化の複雑さを解消する実用的なツールとして成熟した。Metaの大規模プロダクション（Instagram、Quest Store）での実績に加え、Sanity StudioやWakeletといった外部企業でも明確なパフォーマンス改善が報告されており、信頼性は十分に高い。

特にコンパイラが条件分岐後や早期リターン後の値もメモ化できる点は、手動メモ化では実現困難な最適化であり、技術的に優れている。

### プロジェクトへの適用可否

- **新規プロジェクト**: 導入を強く推奨。Expo SDK 54+、Next.js、Viteではテンプレートで有効化済み
- **既存プロジェクト**: Rules of Reactに準拠しているコードベースであれば導入可能。ディレクトリ単位の段階的導入が安全
- **注意が必要なケース**: MobXやreact-hook-formなど、内部ミュータビリティに依存するライブラリを使用している場合は、`"use no memo"`での除外が必要になる可能性がある
- **React 17/18プロジェクト**: `react-compiler-runtime`パッケージの追加で対応可能

### 導入判断のチェックリスト

- [ ] Rules of Reactに概ね準拠しているか
- [ ] `eslint-plugin-react-hooks`のrecommended-latestでエラーが少ないか
- [ ] ミュータブルな状態管理ライブラリ（MobX等）への依存が限定的か
- [ ] E2Eテストによる回帰検知体制があるか

## 参考リンク

1. [React Compiler v1.0 - React Blog](https://react.dev/blog/2025/10/07/react-compiler-1)
2. [Introduction - React Compiler](https://react.dev/learn/react-compiler/introduction)
3. [Rules of React](https://react.dev/reference/rules)
4. [Installation - React Compiler](https://react.dev/learn/react-compiler/installation)
5. ['use no memo' directive - React](https://react.dev/reference/react-compiler/directives/use-no-memo)
6. [Meta's React Compiler 1.0 Brings Automatic Memoization to Production - InfoQ](https://www.infoq.com/news/2025/12/react-compiler-meta/)
7. [Incremental Adoption - React Compiler](https://react.dev/learn/react-compiler/incremental-adoption)
8. [React Compiler Playground](https://playground.react.dev)
9. [eslint-plugin-react-hooks - GitHub](https://github.com/facebook/react/blob/main/packages/eslint-plugin-react-hooks/README.md)
