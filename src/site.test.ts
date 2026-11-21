import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SITE_URL, loadAllPages, loadPages, markdownToHtml, pagePath, renderPage, sitemap } from '../scripts/site-pages.ts';

const root = fileURLToPath(new URL('..', import.meta.url));

describe('website pages (scripts/site-pages.ts)', () => {
  const pages = loadPages(root);

  it('has the guide, parents, privacy and 404 pages, each with a title and a search-sized description', () => {
    expect(pages.map((p) => p.slug).sort()).toEqual(['404', 'how-to-play', 'parents-and-teachers', 'privacy']);
    for (const page of pages) {
      expect(page.title, page.slug).toBeTruthy();
      expect(page.description.length, page.slug).toBeGreaterThan(20);
      expect(page.description.length, page.slug).toBeLessThanOrEqual(170);
      expect(page.body, page.slug).toMatch(/<h1>/);
    }
  });

  it('renders canonical links, previews and no scripts', () => {
    for (const page of pages) {
      const html = renderPage(page, 'body{}');
      expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/${page.slug === '404' ? '' : `${page.slug}/`}"`);
      expect(html).toContain('og:image');
      expect(html).not.toMatch(/<script/);
      expect(html.includes('noindex')).toBe(page.slug === '404');
    }
  });

  it('lists every page but the 404 in the sitemap', () => {
    const xml = sitemap(pages, '2026-11-19');
    expect(xml).toContain(`<loc>${SITE_URL}/</loc>`);
    expect(xml).toContain(`<loc>${SITE_URL}/privacy/</loc>`);
    expect(xml).not.toContain('404');
  });

  it('turns PRIVACY.md-style Markdown into safe HTML', () => {
    expect(markdownToHtml('## Hi\n\nSome **bold** and `code` <b>, [a link](https://x.org).\n\n- one\n- two\n  more')).toBe(
      '<h2>Hi</h2>\n<p>Some <strong>bold</strong> and <code>code</code> &lt;b&gt;, <a href="https://x.org">a link</a>.</p>\n<ul><li>one</li><li>two more</li></ul>',
    );
  });

  it('has French pages under /fr/, with the accent help page, linked to the English ones', () => {
    const fr = loadPages(root, 'fr');
    expect(fr.map((p) => p.slug).sort()).toEqual(['accents', 'how-to-play', 'parents-and-teachers', 'privacy']);
    const all = loadAllPages(root);
    for (const page of fr) {
      expect(page.description.length, page.slug).toBeLessThanOrEqual(170);
      const html = renderPage(page, '', all);
      expect(html).toContain('<html lang="fr">');
      expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/fr/${page.slug}/"`);
      expect(html).not.toMatch(/<script/);
    }
    const guide = renderPage(fr.find((p) => p.slug === 'how-to-play')!, '', all);
    expect(guide).toContain(`hreflang="en" href="${SITE_URL}/how-to-play/"`);
    expect(guide).toContain(`hreflang="fr" href="${SITE_URL}/fr/how-to-play/"`);
    expect(guide).toContain('hreflang="x-default"');
    expect(pagePath({ slug: 'privacy', locale: 'fr' })).toBe('/fr/privacy/');
  });

  it('shows every French accent with keys on AZERTY and US keyboards', () => {
    const accents = loadPages(root, 'fr').find((p) => p.slug === 'accents')!;
    for (const ch of 'éèàùçâêîôûëïü') expect(accents.body).toContain(`<th>${ch}</th>`);
    expect(accents.body).not.toContain('<td>–</td>');
    expect(accents.body).toContain('<kbd>Option</kbd>');
    expect(accents.body).toContain('<kbd>AltGr</kbd>');
  });

  it('lists the French pages in the sitemap too', () => {
    const xml = sitemap(loadAllPages(root), '2026-11-21');
    expect(xml).toContain(`<loc>${SITE_URL}/fr/accents/</loc>`);
    expect(xml).toContain(`<loc>${SITE_URL}/fr/privacy/</loc>`);
  });
});
