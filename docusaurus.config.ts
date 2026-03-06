import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Research Tech',
  tagline: 'Web技術の調査・ドキュメント',
  favicon: 'img/favicon.ico',

  url: 'https://shoota.github.io',
  baseUrl: '/research-tech/',

  headTags: [
    {
      tagName: 'link',
      attributes: {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/research-tech/img/favicon-180.png',
      },
    },
  ],

  organizationName: 'shoota',
  projectName: 'research-tech',

  onBrokenLinks: 'throw',

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'ja',
    locales: ['ja'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    metadata: [
      {name: 'description', content: 'React, CSS, テストなどWeb技術の調査・検証結果をまとめたドキュメントサイト'},
      {property: 'og:title', content: 'Research Tech'},
      {property: 'og:description', content: 'React, CSS, テストなどWeb技術の調査・検証結果をまとめたドキュメントサイト'},
      {property: 'og:image', content: 'https://shoota.github.io/research-tech/img/og-image.png'},
      {property: 'og:type', content: 'website'},
      {name: 'twitter:card', content: 'summary_large_image'},
      {name: 'twitter:title', content: 'Research Tech'},
      {name: 'twitter:description', content: 'React, CSS, テストなどWeb技術の調査・検証結果をまとめたドキュメントサイト'},
      {name: 'twitter:image', content: 'https://shoota.github.io/research-tech/img/og-image.png'},
    ],
    navbar: {
      title: 'Research Tech',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://github.com/shoota/research-tech',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `Copyright © ${new Date().getFullYear()} shoota. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
