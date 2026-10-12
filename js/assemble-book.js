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

const SECTIONS = [
  'sections/00-cover.html',
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

async function assemble() {
  const parts = await Promise.all(
    SECTIONS.map(async (url) => {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
      return res.text();
    })
  );
  const content = printUrlsForLivePlates(parts.join('\n'));
  // Render into a dedicated container, not document.body — the
  // static nav bar above needs to stay put and keep working (as a
  // normal position:sticky header) outside whatever Paged.js does
  // with the content it's managing.
  const target = document.getElementById('paged-target');
  document.getElementById('loading')?.remove();
  const flow = await window.PagedPolyfill.preview(content, STYLESHEETS, target);
  console.log(`Rendered ${flow.total} pages.`);
  fillTocPageNumbers();
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

assemble().catch((err) => {
  document.getElementById('paged-target').innerHTML =
    `<pre style="color:#a33; padding:2rem; font-family:monospace; white-space:pre-wrap;">${err.message}</pre>`;
  console.error(err);
});
