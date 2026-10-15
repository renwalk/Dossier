// Flowing web view: fetch each section fragment and drop it straight
// into the page — no pagination. The TOC/frontmatter fragment is
// book-only (it's a page-numbered contents page, which doesn't mean
// anything in a page that just scrolls) so it's left out here.
//
// Requires being served over http(s) — see README.md.

import { numberFigures } from './number-figures.js';
import { watchNotes } from './stack-notes.js';

const SECTIONS = [
  'sections/00-cover.html',
  'sections/02-cv.html',
  'sections/03-intro.html',
  'sections/04-research.html',
  'sections/05-portfolio.html',
  'sections/99-colophon.html',
];

async function assemble() {
  const container = document.getElementById('site-content');
  const parts = await Promise.all(
    SECTIONS.map(async (url) => {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
      return res.text();
    })
  );
  container.innerHTML = parts.join('\n');
  numberFigures(container);
  watchNotes(container);
  revealNavPastCover();
  wireLiveEmbeds(container);
  goToHash();
}

// The sections arrive after the page has loaded, so the browser has already looked for #cv, #research
// and the rest and found nothing. Scroll to the one in the address once the text is in place, and
// again when images and fonts have settled (they move things down), unless the reader has already
// started scrolling.
function goToHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return;
  let moved = false;
  const stop = () => { moved = true; };
  ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((t) => addEventListener(t, stop, { once: true, passive: true }));
  const go = () => { if (!moved) document.getElementById(id)?.scrollIntoView({ behavior: 'instant' }); };
  go();
  if (document.readyState !== 'complete') addEventListener('load', go, { once: true });
  document.fonts?.ready.then(go);
  setTimeout(go, 1500);
}

// Live plates (.plate--live) ship as a poster + button; the iframe only
// exists once someone asks for it. That keeps heavy pieces (BirdBox is
// ~16 MB of audio) from loading until wanted, and gives the browser the
// user gesture it requires before it will play sound. data-embed on the
// figure is the single source for the URL.
function wireLiveEmbeds(container) {
  container.querySelectorAll('.plate--live').forEach((fig) => {
    const open = fig.querySelector('.live-open');
    if (open && fig.dataset.embed) open.href = fig.dataset.embed;
  });
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.live-launch');
    if (!btn) return;
    const fig = btn.closest('.plate--live');
    const title = fig.querySelector('.plate-title')?.textContent.trim() || 'Interactive piece';
    const iframe = document.createElement('iframe');
    iframe.src = fig.dataset.embed;
    iframe.title = title;
    iframe.allow = 'autoplay; geolocation';
    const frame = fig.querySelector('.live-frame');
    frame.replaceChildren(iframe);
    iframe.addEventListener('load', () => fitToContent(iframe, frame, fig.dataset.embedCss));
  });
}

// Size the iframe to its content's full height — no cut-off, no scrollbar
// inside the page. Needs same-origin access to the embedded document (true
// for pieces copied into this site, like projects/bird-box); a cross-origin
// embed throws here and simply keeps the default 16:10 box.
//
// The embedded piece must keep exactly the layout it had in the fixed-height
// frame, so:
// - Height-only resizes are hidden from p5's windowResized. Changing the
//   iframe's height makes the browser fire `resize` inside it, and BirdBox's
//   windowResized sets its canvas to the wrapper's width, which includes
//   padding its grid column then grows to hold: ~30px wider on every call.
//   One stray call is enough to push the circle layout over a column
//   threshold (4 to 5 columns) and leave a large blank area below. The
//   fixed-height frame never fired one. Real width changes (window or pane
//   resized) still reach the piece. (p5 calls windowResized by name, so
//   wrapping it works; a guard on the resize event itself doesn't, because
//   p5's own listener runs before ours.)
// - No inner scrollbar, so there is nothing to appear or disappear as the
//   height changes.
// - Height is measured from the <html> element's own box, not
//   documentElement.scrollHeight: scrollHeight is never smaller than the
//   iframe's current height, so it could only grow the frame and would leave
//   blank space once the piece got shorter.
function fitToContent(iframe, frame, extraCss = '') {
  let doc;
  try { doc = iframe.contentDocument; } catch { return; }
  if (!doc || !doc.documentElement) return;
  const win = iframe.contentWindow;
  frame.classList.add('is-fitted');

  const noScrollbar = doc.createElement('style');
  // extraCss comes from the figure's data-embed-css: per-piece fixes so a piece
  // built for a full browser window fits the narrower frame (see README).
  noScrollbar.textContent = 'html{overflow:hidden}' + extraCss;
  doc.head.appendChild(noScrollbar);

  // BirdBox works out its canvas height from the width at one moment, but
  // the layout it then draws uses its wrapper's width, which has grown ~30px
  // by the time it draws (see above). Near a column threshold that is a
  // different column count, so the canvas is taller than the circles and a
  // block of the piece is blank. Re-derive the height from the layout as it
  // is actually drawn. Only does anything for pieces that expose p5's
  // canvasHeight()/resizeCanvas().
  const syncCanvasHeight = () => {
    if (typeof win.canvasHeight === 'function' && typeof win.resizeCanvas === 'function' && win.width) {
      const h = win.canvasHeight();
      if (h !== win.height) win.resizeCanvas(win.width, h);
    }
  };

  let lastWidth = win.innerWidth;
  const windowResized = win.windowResized;
  if (typeof windowResized === 'function') {
    win.windowResized = function (...args) {
      if (win.innerWidth === lastWidth) return;
      lastWidth = win.innerWidth;
      const result = windowResized.apply(this, args);
      syncCanvasHeight();
      return result;
    };
  }

  let canvasSynced = false;
  const fit = () => {
    if (!canvasSynced && doc.querySelector('canvas')) { canvasSynced = true; syncCanvasHeight(); }
    const h = Math.ceil(doc.documentElement.getBoundingClientRect().height) + 'px';
    if (iframe.style.height !== h) iframe.style.height = h;
  };
  fit();
  // Content appears late (canvas, fonts) and re-lays out when the width changes.
  new win.ResizeObserver(fit).observe(doc.documentElement);
  // Observers only fire while the browser is rendering the tab; a short timer
  // covers the load-in period when it isn't (background tab, hidden pane).
  const poll = setInterval(fit, 250);
  setTimeout(() => clearInterval(poll), 10000);
}

// The nav (fixed + hidden by default, see css/web.css) fades in once
// the cover has scrolled out of view, rather than sitting over the
// hero from the start. IntersectionObserver instead of a scroll
// listener so this costs nothing while the visitor is just reading.
function revealNavPastCover() {
  const cover = document.querySelector('.cover-page');
  const nav = document.querySelector('.site-nav');
  if (!cover || !nav) return;
  new IntersectionObserver(
    ([entry]) => nav.classList.toggle('nav-visible', !entry.isIntersecting),
    { rootMargin: '-1px 0px 0px 0px' } // triggers right as the cover's bottom edge passes the viewport top
  ).observe(cover);
}

assemble().catch((err) => {
  document.getElementById('site-content').innerHTML =
    `<pre style="color:#a33; padding:2rem; font-family:monospace; white-space:pre-wrap;">${err.message}</pre>`;
  console.error(err);
});
