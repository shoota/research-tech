import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

import styles from './index.module.css';

function AiIcon() {
  return (
    <svg
      className={styles.heroIcon}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 外側の円 */}
      <circle cx="60" cy="60" r="56" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <circle cx="60" cy="60" r="44" stroke="currentColor" strokeWidth="1" opacity="0.1" />
      {/* ブレイン/ネットワーク */}
      <circle cx="60" cy="38" r="4" fill="currentColor" opacity="0.8" />
      <circle cx="40" cy="55" r="3.5" fill="currentColor" opacity="0.6" />
      <circle cx="80" cy="55" r="3.5" fill="currentColor" opacity="0.6" />
      <circle cx="45" cy="75" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="75" cy="75" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="60" cy="60" r="5" fill="currentColor" opacity="0.9" />
      {/* 接続線 */}
      <line x1="60" y1="38" x2="60" y2="60" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
      <line x1="40" y1="55" x2="60" y2="60" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
      <line x1="80" y1="55" x2="60" y2="60" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
      <line x1="45" y1="75" x2="60" y2="60" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
      <line x1="75" y1="75" x2="60" y2="60" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
      <line x1="40" y1="55" x2="60" y2="38" stroke="currentColor" strokeWidth="0.8" opacity="0.15" />
      <line x1="80" y1="55" x2="60" y2="38" stroke="currentColor" strokeWidth="0.8" opacity="0.15" />
      <line x1="40" y1="55" x2="45" y2="75" stroke="currentColor" strokeWidth="0.8" opacity="0.15" />
      <line x1="80" y1="55" x2="75" y2="75" stroke="currentColor" strokeWidth="0.8" opacity="0.15" />
      {/* コードブラケット */}
      <text x="22" y="64" fontSize="20" fontWeight="bold" fill="currentColor" opacity="0.15" fontFamily="monospace">{'{'}</text>
      <text x="90" y="64" fontSize="20" fontWeight="bold" fill="currentColor" opacity="0.15" fontFamily="monospace">{'}'}</text>
    </svg>
  );
}

function CodeLine({width, opacity, delay}: {width: string; opacity: number; delay: string}) {
  return (
    <div
      className={styles.codeLine}
      style={{width, opacity, animationDelay: delay}}
    />
  );
}

function FeatureCard({icon, title, description}: {icon: string; title: string; description: string}) {
  return (
    <div className={styles.featureCard}>
      <div className={styles.featureIcon}>{icon}</div>
      <h3 className={styles.featureTitle}>{title}</h3>
      <p className={styles.featureDescription}>{description}</p>
    </div>
  );
}

function HomepageHeader() {
  return (
    <header className={styles.hero}>
      <div className={styles.heroBackground}>
        <div className={styles.gridOverlay} />
      </div>
      <div className={styles.heroContent}>
        <div className={styles.heroText}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            Powered by Claude Code
          </div>
          <h1 className={styles.heroTitle}>
            Research<br />
            <span className={styles.heroTitleAccent}>Tech</span>
          </h1>
          <p className={styles.heroSubtitle}>
            AIが調査・執筆するWeb技術ドキュメント。<br />
            Claude Code が最新の技術トレンドを<br className={styles.brMobile} />
            網羅的にリサーチし、体系的に整理します。
          </p>
          <div className={styles.heroCta}>
            <Link className={styles.ctaPrimary} to="/docs/intro">
              ドキュメントを読む
            </Link>
            <Link
              className={styles.ctaSecondary}
              href="https://github.com/shoota/research-tech"
            >
              GitHub
              <span className={styles.ctaArrow}>&rarr;</span>
            </Link>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.codeWindow}>
            <div className={styles.codeWindowHeader}>
              <span className={styles.codeWindowDot} data-color="red" />
              <span className={styles.codeWindowDot} data-color="yellow" />
              <span className={styles.codeWindowDot} data-color="green" />
              <span className={styles.codeWindowTitle}>claude-research</span>
            </div>
            <div className={styles.codeWindowBody}>
              <div className={styles.codePrompt}>
                <span className={styles.codePromptSymbol}>$</span>
                <span className={styles.codePromptText}>claude /research &quot;Agentic Coding&quot;</span>
                <span className={styles.codePromptCursor} />
              </div>
              <div className={styles.codeOutput}>
                <CodeLine width="85%" opacity={0.6} delay="0.5s" />
                <CodeLine width="70%" opacity={0.4} delay="0.8s" />
                <CodeLine width="92%" opacity={0.5} delay="1.1s" />
                <CodeLine width="60%" opacity={0.3} delay="1.4s" />
                <CodeLine width="78%" opacity={0.45} delay="1.7s" />
              </div>
              <AiIcon />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function FeaturesSection() {
  return (
    <section className={styles.features}>
      <div className={styles.featuresContainer}>
        <FeatureCard
          icon="&lt;/&gt;"
          title="AI 駆動リサーチ"
          description="Claude Code がWeb検索と公式ドキュメントを横断的に調査し、技術情報を収集・整理します"
        />
        <FeatureCard
          icon="&#9670;"
          title="体系的なドキュメント"
          description="背景・技術詳細・コード例・所感まで統一フォーマットで記述。出典付きで信頼性を担保します"
        />
        <FeatureCard
          icon="&#8634;"
          title="継続的なアップデート"
          description="技術の進化に合わせて定期的に調査・更新。各ドキュメントに最終更新日を明記しています"
        />
      </div>
    </section>
  );
}

function DisclaimerSection() {
  return (
    <section className={styles.disclaimer}>
      <div className={styles.disclaimerContainer}>
        <div className={styles.disclaimerIcon}>i</div>
        <div className={styles.disclaimerText}>
          <strong>ご注意</strong>: 本サイトの全コンテンツは Claude Code（Anthropic の AI）が
          100% 調査・執筆しています。すべての情報の正確性を保証するものではありません。
          重要な意思決定には一次情報の確認をお願いします。
        </div>
      </div>
    </section>
  );
}

export default function Home(): React.JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <HomepageHeader />
      <main>
        <FeaturesSection />
        <DisclaimerSection />
      </main>
    </Layout>
  );
}
