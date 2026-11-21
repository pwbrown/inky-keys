/**
 * The website's plain pages beside the game (milestone 27, SEO): How to play,
 * For parents and teachers, Privacy and the 404 page, plus sitemap.xml. They
 * are static HTML with real text, so search engines and link previews have
 * something to read, while the game itself stays a canvas app.
 *
 * English pages are at the root and French ones under /fr/, linked with
 * hreflang. Page bodies live in site/<locale>/*.html (a short header comment gives the
 * title and description); the Privacy page is made from PRIVACY.md so there
 * is one source. Each page is wrapped in one shared layout and stylesheet
 * (site/site.css, inlined) with the game's bundled fonts. Served by the dev server
 * and emitted into the build, where the service worker precaches them too.
 *
 * Like the game: no scripts, nothing from other origins.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { ACCENT_CHAPTERS, howToType, type KeyStep } from '../src/core/accents';
import { FR_AZERTY, US_QWERTY, forPlatform } from '../src/content/layouts';
import type { KeyboardLayout, Platform } from '../src/content/layouts/types';

export const SITE_URL = 'https://inkykeys.com';

/** Languages the website is in: English at the root, others under /<locale>/. */
export const SITE_LOCALES = ['en', 'fr'] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];

export interface SitePage {
  /** Served at /<slug>/ (the 404 page at /404.html), or /<locale>/<slug>/ outside English. */
  slug: string;
  locale: SiteLocale;
  title: string;
  description: string;
  body: string;
}

const FONTS: Record<string, string> = {
  'atkinson-400.woff2': '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-400-normal.woff2',
  'atkinson-700.woff2': '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff2',
  'caveat-700.woff2': '@fontsource/caveat/files/caveat-latin-700-normal.woff2',
};

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline Markdown: code, bold and links (the little PRIVACY.md uses). Input is escaped first. */
function inline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => `<a href="${href}">${label}</a>`);
}

/** Just enough Markdown for PRIVACY.md: headings, paragraphs and bullet lists. */
export function markdownToHtml(markdown: string): string {
  const out: string[] = [];
  let list: string[] | null = null;
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
    if (list) out.push(`<ul>${list.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`);
    list = null;
  };
  for (const line of markdown.split('\n')) {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!)}</h${level}>`);
    } else if (bullet) {
      if (paragraph.length) flush();
      (list ??= []).push(bullet[1]!);
    } else if (line.trim() === '') {
      flush();
    } else if (list) {
      list[list.length - 1] += ` ${line.trim()}`;
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return out.join('\n');
}

/** A page body file: `<!-- title: … -->` and `<!-- description: … -->`, then HTML. */
function parsePage(slug: string, locale: SiteLocale, source: string): SitePage {
  const field = (name: string) => new RegExp(`<!--\\s*${name}:\\s*([\\s\\S]*?)\\s*-->`).exec(source)?.[1] ?? '';
  const body = source.replace(/<!--[\s\S]*?-->\s*/g, '').trim();
  return { slug, locale, title: field('title'), description: field('description'), body };
}

/** Words of the shared layout, per locale (the pages' own text is in site/<locale>/). */
const CHROME: Record<SiteLocale, { nav: [string, string][]; navLabel: string; play: string; footer: string; ogAlt: string; privacyTitle: string; privacyDescription: string; other: string }> = {
  en: {
    nav: [
      ['how-to-play', 'How to play'],
      ['parents-and-teachers', 'For parents and teachers'],
      ['privacy', 'Privacy'],
    ],
    navLabel: 'Inky Keys pages',
    play: 'Play Inky Keys',
    footer: 'Inky Keys is free and open source (<a href="https://github.com/pwbrown/inky-keys">source code</a>). No ads, no accounts, no tracking.',
    ogAlt: 'Inky Keys: ink-blot creatures carrying words crawl across a ruled notebook page toward a fountain-pen nib.',
    privacyTitle: 'Privacy',
    privacyDescription: 'Inky Keys collects nothing about you: no accounts, analytics, ads or tracking. Your progress stays on your device.',
    other: 'Français',
  },
  fr: {
    nav: [
      ['how-to-play', 'Comment jouer'],
      ['parents-and-teachers', 'Pour les parents et les enseignants'],
      ['accents', 'Taper les accents'],
      ['privacy', 'Confidentialité'],
    ],
    navLabel: 'Les pages d’Inky Keys',
    play: 'Jouer à Inky Keys',
    footer: 'Inky Keys est gratuit et open source (<a href="https://github.com/pwbrown/inky-keys">code source</a>). Ni publicité, ni compte, ni pistage.',
    ogAlt: 'Inky Keys\u202f: des créatures en taches d’encre portant des mots traversent la page d’un cahier vers une plume.',
    privacyTitle: 'Confidentialité',
    privacyDescription: 'Inky Keys ne collecte rien sur toi\u202f: ni compte, ni statistiques, ni publicité, ni pistage. Ta progression reste sur ton appareil.',
    other: 'English',
  },
};

/** Where a page is served: /slug/ in English, /fr/slug/ in French (the 404 page is at /404.html). */
export function pagePath(page: Pick<SitePage, 'slug' | 'locale'>): string {
  const prefix = page.locale === 'en' ? '/' : `/${page.locale}/`;
  return page.slug === '404' ? '/404.html' : `${prefix}${page.slug}/`;
}

export function loadPages(root: string, locale: SiteLocale = 'en'): SitePage[] {
  const dir = join(root, 'site', locale);
  const pages = readdirSync(dir)
    .filter((file) => file.endsWith('.html'))
    .sort()
    .map((file) => parsePage(file.replace(/\.html$/, ''), locale, readFileSync(join(dir, file), 'utf8')));
  // English Privacy is PRIVACY.md itself; a translation sits beside the other pages as privacy.md.
  const source = locale === 'en' ? join(root, 'PRIVACY.md') : join(dir, 'privacy.md');
  const privacy = readFileSync(source, 'utf8').replace(/^# .*\n/, '');
  const chrome = CHROME[locale];
  pages.push({
    slug: 'privacy',
    locale,
    title: chrome.privacyTitle,
    description: chrome.privacyDescription,
    body: `<h1>${chrome.privacyTitle}</h1>\n${markdownToHtml(privacy)}`,
  });
  if (locale === 'fr') pages.push(accentsPage());
  return pages;
}

/** Every page in every language. */
export function loadAllPages(root: string): SitePage[] {
  return SITE_LOCALES.flatMap((locale) => loadPages(root, locale));
}

/** The ink-drop logo, as in the game's menu (src/ui/menu.ts). */
const LOGO = `<svg class="logo" viewBox="0 0 390 96" role="img" aria-label="Inky Keys">
  <path class="logo-drop" d="M44 6 L26 48 A21 21 0 1 0 62 48 Z"/>
  <circle class="logo-eye" cx="38" cy="62" r="4.2"/><circle class="logo-eye" cx="52" cy="62" r="4.2"/>
  <circle class="logo-eye" cx="34" cy="50" r="3" opacity="0.5"/>
  <path class="logo-smile" d="M39 72 q6 5 12 0"/>
  <text class="logo-word" x="80" y="70">Inky Keys</text>
  <path class="logo-underline" d="M84 82 C160 74 270 90 366 78"/>
</svg>`;

/**
 * `css`: the shared stylesheet, inlined so nothing blocks the first paint.
 * `all`: every page, to link each to its translations (hreflang) and offer the other language.
 */
export function renderPage(page: SitePage, css = '', all: readonly SitePage[] = []): string {
  const url = page.slug === '404' ? `${SITE_URL}/` : `${SITE_URL}${pagePath(page)}`;
  const fullTitle = `${page.title} · Inky Keys`;
  const chrome = CHROME[page.locale];
  const nav = chrome.nav
    .map(([slug, label]) => {
      const href = pagePath({ slug, locale: page.locale });
      const current = slug === page.slug ? ' aria-current="page"' : '';
      return `<a href="${href}"${current}>${label}</a>`;
    })
    .join('\n        ');
  // The same page in each language, for search engines and the language link.
  const versions = page.slug === '404' ? [] : all.filter((p) => p.slug === page.slug);
  const alternates =
    versions.length > 1
      ? versions.map((p) => `\n    <link rel="alternate" hreflang="${p.locale}" href="${SITE_URL}${pagePath(p)}" />`).join('') +
        `\n    <link rel="alternate" hreflang="x-default" href="${SITE_URL}${pagePath({ slug: page.slug, locale: 'en' })}" />`
      : '';
  const other = SITE_LOCALES.find((l) => l !== page.locale) ?? 'en';
  const otherPage = versions.find((p) => p.locale === other) ?? { slug: 'how-to-play', locale: other };
  const languageLink = `<a href="${pagePath(otherPage)}" hreflang="${other}" lang="${other}">${CHROME[page.locale].other}</a>`;
  const robots = page.slug === '404' ? '\n    <meta name="robots" content="noindex" />' : '';
  return `<!doctype html>
<html lang="${page.locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; font-src 'self'" />
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />${robots}
    <meta name="theme-color" content="#1f2a44" />
    <link rel="canonical" href="${url}" />${alternates}
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
${Object.keys(FONTS)
  .map((name) => `    <link rel="preload" href="/site/fonts/${name}" as="font" type="font/woff2" crossorigin />\n`)
  .join('')}    <style>
${css.trim()}
    </style>
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Inky Keys" />
    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE_URL}/social-card.png" />
    <meta property="og:image:alt" content="${escapeHtml(chrome.ogAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
  </head>
  <body>
    <header class="site-header">
      <a class="home" href="/">${LOGO}</a>
      <nav aria-label="${escapeHtml(chrome.navLabel)}">
        ${nav}
        ${languageLink}
      </nav>
    </header>
    <main class="page">
${page.body}
      <p class="play"><a class="play-button" href="/">${chrome.play}</a></p>
    </main>
    <footer class="site-footer">
      <p>${chrome.footer}</p>
    </footer>
  </body>
</html>
`;
}

export function sitemap(pages: readonly SitePage[], lastmod: string): string {
  const urls = ['/', ...pages.filter((p) => p.slug !== '404').map(pagePath)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${SITE_URL}${path}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
}

/** Keys as <kbd>s: "Maj + ^ → E". */
function stepsHtml(steps: readonly KeyStep[], words: { shift: string; option: string }): string {
  const cap = (key: string) => (/^[a-z]$/.test(key) ? key.toUpperCase() : key);
  return steps
    .map((s) => {
      const mods = [s.option ? words.option : null, s.altGr ? 'AltGr' : null, s.shift ? words.shift : null].filter(Boolean) as string[];
      return [...mods, cap(s.key)].map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join(' + ');
    })
    .join(' → ');
}

/**
 * The French accent help page (site/fr/accents/): every accented letter of
 * French with its keys on AZERTY and on a US keyboard (Mac and
 * Windows/Chromebook), drawn from the same howToType the game uses.
 */
function accentsPage(): SitePage {
  const words = { shift: 'Maj', option: 'Option' };
  const keyboards: [string, KeyboardLayout, Platform, string][] = [
    ['Clavier AZERTY (France)', FR_AZERTY, 'pc', 'Les lettres é, è, ç, à et ù ont leur propre touche. Pour les autres, appuie d’abord sur la touche d’accent ^ (avec Maj pour ¨), qui attend, puis sur la lettre. Sur un Mac, c’est pareil.'],
    ['Clavier américain sur un Mac', US_QWERTY, 'mac', 'Maintiens Option et appuie sur une touche pour choisir l’accent, relâche\u202f: l’accent attend. Puis tape la lettre.'],
    ['Clavier américain sur Windows ou un Chromebook', US_QWERTY, 'pc', 'Active d’abord le clavier «\u202fÉtats-Unis international\u202f» dans les paramètres. Les touches d’accent attendent alors la lettre suivante. Pour une simple apostrophe, appuie dessus puis sur la barre d’espace.'],
  ];
  const letters = ACCENT_CHAPTERS.fr.flat();
  const sections = keyboards.map(([title, layout, platform, intro]) => {
    const variant = forPlatform(layout, platform);
    const rows = letters
      .map((ch) => {
        const steps = howToType(ch, variant, platform);
        return `  <tr><th>${ch}</th><td>${steps ? stepsHtml(steps, words) : '–'}</td></tr>`;
      })
      .join('\n');
    return `<h2>${title}</h2>\n<p>${intro}</p>\n<table class="accents">\n${rows}\n</table>`;
  });
  return {
    slug: 'accents',
    locale: 'fr',
    title: 'Taper les accents',
    description: 'Comment taper é, è, à, ù, ç, â, ê, î, ô, û, ë, ï et ü sur un clavier AZERTY, ou sur un clavier américain avec un Mac, Windows ou un Chromebook.',
    body: `<h1>Taper les accents</h1>
<p class="lead">
  Dans Inky Keys, les mots français gardent leurs accents. Chaque accent a sa page d’entraînement dans le sommaire de
  l’Apprenti, et cette page résume les touches pour ton clavier. Les accents difficiles\u202f? L’option
  <strong>Accents indulgents</strong>, dans les Réglages, laisse e compter pour é.
</p>
${sections.join('\n\n')}`,
  };
}

/** Every file the site adds, by its served path. */
function siteFiles(root: string): Map<string, string | Buffer> {
  const pages = loadAllPages(root);
  const css = readFileSync(join(root, 'site', 'site.css'), 'utf8');
  const files = new Map<string, string | Buffer>();
  for (const page of pages) files.set(page.slug === '404' ? '404.html' : `${pagePath(page).slice(1)}index.html`, renderPage(page, css, pages));
  files.set('sitemap.xml', sitemap(pages, new Date().toISOString().slice(0, 10)));
  for (const [name, path] of Object.entries(FONTS)) files.set(`site/fonts/${name}`, readFileSync(join(root, 'node_modules', path)));
  return files;
}

const TYPES: Record<string, string> = { html: 'text/html', xml: 'application/xml', woff2: 'font/woff2' };

export function sitePages(root: string): Plugin {
  return {
    name: 'inky-keys-site-pages',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '/').split('?')[0]!.replace(/^\//, '');
        const files = siteFiles(root);
        const file = files.get(path) ?? files.get(`${path.replace(/\/?$/, '/')}index.html`);
        if (path === '' || file === undefined) return next();
        if (!path.endsWith('/') && !path.includes('.')) {
          res.statusCode = 301;
          res.setHeader('Location', `/${path}/`);
          return res.end();
        }
        const ext = path.endsWith('/') ? 'html' : (path.split('.').pop() ?? '');
        res.setHeader('Content-Type', TYPES[ext] ?? 'application/octet-stream');
        res.end(file);
      });
    },
    generateBundle() {
      for (const [fileName, source] of siteFiles(root)) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}
