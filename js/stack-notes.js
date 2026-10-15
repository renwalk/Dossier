// Side notes (.margin-note) hang in the left column beside their paragraph. They must never
// push the text down (a note taller than its paragraph would stretch the row and leave a gap in
// the body text) and never sit on top of one another. CSS takes the notes out of the row's
// height (see .margin-note in base.css); this pass then nudges any note that would overlap the
// one above it down just far enough to clear it. It only moves notes visually (translateY), so
// the text and the page breaks never change.
//
// Each note is first lined up so the top of its picture sits level with the top of the capital letters
// on the first line of its paragraph (not the top of the line box, which sits a little higher).
//
// In the book each page is its own space: a note is also kept inside the page's text area, so a
// note near the foot of a page is moved up rather than running off the page.

const GAP = 19; // px between stacked notes

export function stackNotes(root = document) {
  const notes = [...root.querySelectorAll('.margin-note')];
  notes.forEach((n) => { n.style.transform = ''; });
  if (window.innerWidth <= 900 && !document.querySelector('.pagedjs_pages')) return; // phone layout: notes are in the flow
  notes.forEach(alignToFirstLine);

  // group by page (book) or one group for the whole scrolling page (web)
  const groups = new Map();
  notes.forEach((n) => {
    const key = n.closest('.pagedjs_page') || document;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(n);
  });

  groups.forEach((list, key) => {
    // a note's box has no height (so it can't stretch its row): its extent is its picture and caption
    const top = (n) => n.getBoundingClientRect().top;
    const bottom = (n) => Math.max(top(n), ...[...n.children].map((c) => c.getBoundingClientRect().bottom));
    list.sort((a, b) => top(a) - top(b));

    // forward pass: push down to clear the note above
    for (let i = 1; i < list.length; i++) {
      const need = bottom(list[i - 1]) + GAP - top(list[i]);
      if (need > 0) shift(list[i], need);
    }

    // book only: keep the last notes inside the page's text area
    if (key !== document) {
      const area = key.querySelector('.pagedjs_page_content')?.getBoundingClientRect();
      if (!area) return;
      for (let i = list.length - 1; i >= 0; i--) {
        const limit = i === list.length - 1 ? area.bottom : top(list[i + 1]) - GAP;
        const over = bottom(list[i]) - limit;
        if (over > 0) shift(list[i], -Math.min(over, Math.max(0, top(list[i]) - area.top)));
      }
    }
  });
}

// Move a note so its picture's top edge meets the cap height of its paragraph's first line.
let ruler;
function alignToFirstLine(note) {
  let p = note.nextElementSibling;
  while (p && p.tagName !== 'P') p = p.nextElementSibling;
  const img = note.querySelector('img');
  if (!p || !img) return;
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let text;
  while ((text = walker.nextNode())) if (text.nodeValue.trim()) break;
  if (!text) return;
  const start = text.nodeValue.search(/\S/);
  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(text, start + 1);
  const line = range.getClientRects()[0];
  if (!line) return;
  ruler = ruler || document.createElement('canvas').getContext('2d');
  ruler.font = getComputedStyle(text.parentElement).font;
  const m = ruler.measureText('H');
  // the text rectangle is the font's full ascent-to-descent box; the capitals start below its top
  const capTop = line.top + (m.fontBoundingBoxAscent - m.actualBoundingBoxAscent);
  shift(note, capTop - img.getBoundingClientRect().top);
}

function shift(note, dy) {
  const cur = parseFloat((note.style.transform.match(/translateY\((-?[\d.]+)px\)/) || [0, 0])[1]);
  note.style.transform = `translateY(${cur + dy}px)`;
}

// Re-run when images finish loading (their heights change) and when the window is resized.
export function watchNotes(root = document) {
  const run = () => stackNotes(root);
  root.querySelectorAll('.margin-note img').forEach((img) => {
    if (!img.complete) img.addEventListener('load', run, { once: true });
  });
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(run, 150); });
  window.addEventListener('load', run);
  if (document.fonts?.ready) document.fonts.ready.then(run);
  run();
}
