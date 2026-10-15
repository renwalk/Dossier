// Fetches each section fragment, concatenates them in book order, and
// hands the result to Paged.js to chunk into pages. Kept as a plain
// fetch-and-join step (no build tool) so editing a section file and
// reloading the browser is the whole workflow.
//
// Requires being served over http(s) — fetch() of local files is
// blocked from a file:// origin. Run from this folder:
//   python3 -m http.server 8080
// then open http://localhost:8080/book.html

import { numberFigures } from './number-figures.js';
import { stackNotes } from './stack-notes.js';

const SECTIONS = [
  'sections/00-cover.html',
  'sections/00a-colophon.html',
  'sections/01-frontmatter.html',
  'sections/02-cv.html',
  'sections/03-intro.html',
  'sections/04-research.html',
  'sections/05-portfolio.html',
  'sections/99-colophon.html',
];

const STYLESHEETS = [
  'css/tokens.css',
  'css/fonts.css',
  'css/base.css',
  'css/book.css',
];

// Where the online edition lives. Each Part page in the book carries a link to its own section of the
// site (the anchors are the Part titles' ids). Change SITE if the dossier is published elsewhere.
const SITE = 'https://dossier.renee-walker.com/';
const PART_LINKS = ['cv', 'intro', 'research', 'portfolio'];

// Adds a "read this section online" link to the four Part pages. Book only: this file is not used by the website.
function addPartLinks(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  PART_LINKS.forEach((id) => {
    const section = tpl.content.querySelector(`#${id}`)?.closest('section');
    if (!section) return;
    const a = document.createElement('a');
    a.className = 'part-weblink';
    a.href = `${SITE}#${id}`;
    a.target = '_blank';
    a.rel = 'noopener';
    const label = document.createElement('span');
    label.className = 'pw-label';
    label.textContent = 'This section online';
    const url = document.createElement('span');
    url.className = 'pw-url';
    url.textContent = `${SITE.replace(/^https?:\/\//, '').replace(/\/$/, '')}/#${id} \u2197`;
    a.append(label, url);
    section.appendChild(a);
  });
  return tpl.innerHTML;
}

async function assemble() {
  const parts = await Promise.all(
    SECTIONS.map(async (url) => {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
      return res.text();
    })
  );
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const content = addPartLinks(printUrlsForLivePlates(parts.join('\n').replaceAll('{{BUILD_DATE}}', today)));
  // Render into a dedicated container, not document.body — the
  // static nav bar above needs to stay put and keep working (as a
  // normal position:sticky header) outside whatever Paged.js does
  // with the content it's managing.
  const target = document.getElementById('paged-target');
  document.getElementById('loading')?.remove();
  const flow = await window.PagedPolyfill.preview(content, STYLESHEETS, target);
  console.log(`Rendered ${flow.total} pages.`);
  fillTocPageNumbers();
  await textureBlankPages();
  addFolios();
  stackNotes();
  wirePrintButton();
}

// Live plates print as poster + a line of text. If the figure has a
// data-print-url (a public address for the piece) that prints; otherwise
// the markup's default "Interactive in the online edition." stands. We
// don't print data-embed itself — it can be a path inside this site,
// which means nothing on paper.
function printUrlsForLivePlates(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  tpl.content.querySelectorAll('.plate--live').forEach((fig) => {
    const url = fig.dataset.printUrl;
    const line = fig.querySelector('.print-url');
    if (url && line) line.textContent = 'Interactive version: ' + url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  });
  numberFigures(tpl.content);
  // Animated GIFs print as a still: the poster named in data-print-src.
  tpl.content.querySelectorAll('img[data-print-src]').forEach((img) => {
    img.src = img.dataset.printSrc;
    img.removeAttribute('data-print-src');
  });
  // Videos can't play on paper: print the poster frame instead (the caption
  // swaps its "Play with sound." for "Video in the online edition.").
  tpl.content.querySelectorAll('video[poster]').forEach((v) => {
    const img = document.createElement('img');
    img.src = v.getAttribute('poster');
    img.alt = v.getAttribute('aria-label') || '';
    v.replaceWith(img);
  });
  return tpl.innerHTML;
}

// The nav bar lives outside #paged-target, in a normally-loaded
// stylesheet, so a plain @media print rule (see .site-nav in
// base.css) is enough to hide it while printing — no JS needed for
// that part, unlike the page content Paged.js manages.
function wirePrintButton() {
  document.getElementById('print-btn').addEventListener('click', () => window.print());
}

// Paged.js's CSS-only target-counter() can only resolve *backward*
// references (an index pointing at earlier content), because it's
// implemented as an ordinary CSS counter, which only accumulates in
// document order. A TOC listed before the chapters it points to is a
// forward reference, so target-counter() silently fails for it
// (confirmed against pagedjs/pagedjs — every match ends up sharing
// one synthetic counter that has no reset applied yet at the TOC's
// position in the tree). Filling the numbers in from the already-
// rendered page DOM sidesteps that entirely.
function fillTocPageNumbers() {
  document.querySelectorAll('.toc-page[data-target]').forEach((span) => {
    const id = span.getAttribute('data-target').replace(/^#/, '');
    const target = document.querySelector(`.pagedjs_pages #${CSS.escape(id)}`);
    const page = target?.closest('.pagedjs_page');
    if (page) span.textContent = page.dataset.pageNumber;
  });
}

// Pages Paged.js adds only to keep Parts and openers on right-hand pages come
// out blank. From the CV onward, fill each with a tightly cropped, abstracted
// image so they read as texture. Which image goes where is set in
// book-textures.json (a blank page is named by its neighbour, e.g. "after:cv");
// pages not listed there pick from its "default" pool, seeded by page number so
// a rebuild gives the same result.
function seeded(n) {
  let t = (n * 2654435761) >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

async function loadTextureConfig() {
  try {
    const res = await fetch('book-textures.json', { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch (e) { /* fall through */ }
  console.warn('book-textures.json missing or unreadable; blank pages left plain.');
  return { default: [], pages: {} };
}

// Name a blank page by what it sits next to: before:<id of the first element with an
// id on the next page>, else after:<id of the last one on the previous page>.
function blankPageLabel(pages, i) {
  const next = pages[i + 1]?.querySelector('[id]')?.id;
  if (next) return `before:${next}`;
  const prev = [...(pages[i - 1]?.querySelectorAll('[id]') || [])].pop()?.id;
  return prev ? `after:${prev}` : `page:${pages[i].dataset.pageNumber}`;
}

// A blank page that sits right before a portfolio project's opener ("before:<project id>") pulls its
// image from that project: any large image on the project's own pages, picked by the page's seed.
// Pages before other things (group dividers, the CV) use the default pool instead.
function projectImages(pages, i, label) {
  const m = label.match(/^before:(.+)$/);
  if (!m) return [];
  const opener = pages[i + 1]?.querySelector('#' + CSS.escape(m[1]));
  if (!opener || !/\b(subproject|project-title)\b/.test(opener.className)) return [];
  const out = [];
  for (let k = i + 1; k < pages.length; k++) {
    const pg = pages[k];
    // stop at the next heading with an id (the next project) or a divider page
    if (k > i + 1 && (pg.querySelector('h1[id], h2[id], h3[id]') || pg.querySelector('.divider'))) break;
    pg.querySelectorAll('.pagedjs_page_content img').forEach((img) => {
      if (!img.closest('.page-texture') && img.naturalWidth >= 1000) out.push(img.getAttribute('src'));
    });
  }
  return [...new Set(out)];
}

// Running header + page number, added to each text page after layout: the Part name at the top and the
// page number at the foot, both starting on the left edge of the body text (css/book.css, .folio-head /
// .folio-foot). The cover, divider pages (Part, group and Contents pages) and the blank texture pages get
// neither. The Part name carries forward from the last Part page, like the string the margin box used
// to show.
function addFolios() {
  let part = '';
  const pages = [...document.querySelectorAll('.pagedjs_pages .pagedjs_page')];
  pages.forEach((page, i) => {
    const partEl = [...page.querySelectorAll('.divider-part, .part-title')].pop();
    if (partEl) part = partEl.textContent.trim();
    const skip =
      i === 0 ||                                           // the cover
      page.classList.contains('pagedjs_blank_page') ||     // texture pages
      page.querySelector('.cover-page, section.divider, .colophon-page');  // Part / group / Contents / colophon pages
    if (skip) return;
    const sheet = page.querySelector('.pagedjs_sheet') || page;
    if (part) {
      const head = document.createElement('div');
      head.className = 'folio-head';
      head.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'folio-part';
      name.textContent = part;
      head.appendChild(name);
      sheet.appendChild(head);
    }
    const foot = document.createElement('div');
    foot.className = 'folio-foot';
    foot.setAttribute('aria-hidden', 'true');
    const num = document.createElement('span');
    num.className = 'folio-num';
    num.textContent = page.dataset.pageNumber;
    foot.appendChild(num);
    sheet.appendChild(foot);
  });
}

async function textureBlankPages() {
  const cfg = await loadTextureConfig();
  const pool = cfg.default || [];
  const chosen = cfg.pages || {};
  const pages = [...document.querySelectorAll('.pagedjs_pages .pagedjs_page')];
  const cvPage = document.querySelector('.pagedjs_pages #cv')?.closest('.pagedjs_page');
  const from = cvPage ? Number(cvPage.dataset.pageNumber) : Infinity;
  pages.forEach((page, i) => {
    if (!page.classList.contains('pagedjs_blank_page')) return;
    const n = Number(page.dataset.pageNumber);
    const label = blankPageLabel(pages, i);
    // before the CV only pages named in book-textures.json get an image
    if (n < from && !chosen[label]) return;
    const rand = seeded(n);
    const set = chosen[label] || {};
    const own = set.image ? [] : projectImages(pages, i, label);
    const source = own.length ? own : pool;
    const img = set.image || (source.length ? source[Math.floor(rand() * source.length)] : null);
    // draw the random numbers unconditionally so unset options stay stable
    const zoom = set.zoom ?? Math.round(300 + rand() * 300);
    // random crops stay in the middle of the image (30-70): the artwork sits there, and the far edges
    // of many images are plain background
    const x = set.x ?? Math.round(30 + rand() * 40);
    const y = set.y ?? Math.round(30 + rand() * 40);
    console.log(`Blank page ${n} (${label}): ${img || 'plain'}${own.length ? ' [from the project]' : ''}`);
    if (!img || img === 'none') return;
    const tex = document.createElement('div');
    tex.className = 'page-texture';
    tex.setAttribute('aria-hidden', 'true');
    tex.style.backgroundImage = `url("${img}")`;
    tex.style.backgroundSize = `${zoom}%`;
    tex.style.backgroundPosition = `${x}% ${y}%`;
    (page.querySelector('.pagedjs_sheet') || page).prepend(tex);
  });
}

assemble().catch((err) => {
  document.getElementById('paged-target').innerHTML =
    `<pre style="color:#a33; padding:2rem; font-family:monospace; white-space:pre-wrap;">${err.message}</pre>`;
  console.error(err);
});
