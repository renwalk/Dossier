#!/usr/bin/env python3
"""Lay out the Portfolio's images for the book.

Every project (or sub-entry) opens on a page of title, text and its FIRST image, so
the opening page reads as an introduction to the project. The images after it are
dealt two to a page, one column by two rows, with the captions at the foot of each
page. A project's image pages therefore come in facing pairs (see the .spread-left
and .spread-right classes in css/book.css, which start each opener on the right
page so the pairs land as spreads).

Run it after you add, remove, reorder or re-size images in sections/05-portfolio.html:

    python3 tools/layout_plates.py

What it does, in order:
  1. Reads every image page (<section class="plate-page ...">) into a flat list of
     images, each with its caption and its size class (fig--text, fig--medium,
     fig--small, or none for full width).
  2. If an opener has no image of its own yet, moves the first image after it into
     the opener (an opener that already holds an image or a live piece is left alone).
  3. Deals the remaining images onto pages two at a time, in order, setting how tall
     each one may be so that the images and their captions always fit a page.
  4. Chooses each project's page count so the next opener falls on its own side of
     the spread with no blank page between (by turning the last pair into two single
     pages if need be).

To choose your own grouping, put the attribute data-keep on an image page
(<section class="plate-page ..." data-keep>). The images on that page stay together
(any number, e.g. three stacked) and the tool only re-fits their sizes. If a project
is made up of kept pages, step 4 can't change its page count; the tool says so when a
blank page will follow.

Images never change order. Text pages, dividers and live pieces are left alone.
Page geometry mirrors css/book.css (US Letter, 1in top and bottom, 0.65in/0.95in sides,
ten-column grid); change the constants below if those change.
"""
import math, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'sections', '05-portfolio.html')

# ---- geometry (inches) ----
PAGE_W, PAGE_H = 8.5, 11.0
BODY_W = PAGE_W - (0.65 + 0.95)         # full-width image (margin to margin)
BODY_H = PAGE_H - 2 - 0.2               # page body height with slack (css/book.css --body-h)
GUTTER = 3.5 * 16 / 96                  # --cover-gutter at this page width
GAP_COL = 24 / 96                       # --cover-grid-gap
STEP = ((BODY_W - 2 * GUTTER) - 9 * GAP_COL) / 10 + GAP_COL
COLS = {'text': 8, 'medium': 6, 'small': 4}   # css/book.css --cols-*
IMG_GAP = 0.12
LABEL_H = 0.32                          # "fig. N" + rule under a full-width image
PER_PAGE = 2
MAX_CAP = 4.2                           # never let one image of a page grow past this

# an item is (media, caption, size class, group); group is None, or the same number for
# every image on a page marked data-keep


def width_for(cls):
    for name, n in COLS.items():
        if f'fig--{name}' in cls:
            return n * STEP - GAP_COL
    return BODY_W


def is_below(cls):
    """True when the figure number sits under the image (full width, or at the left edge)."""
    return width_for(cls) == BODY_W or 'fig--left' in cls


def ratio(media):
    m = re.search(r'poster="([^"]+)"', media) or re.search(r'src="([^"]+)"', media)
    if m:
        f = os.path.join(ROOT, m.group(1))
        if os.path.exists(f):
            o = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', f],
                               capture_output=True, text=True).stdout
            w = re.search(r'pixelWidth: (\d+)', o); h = re.search(r'pixelHeight: (\d+)', o)
            if w and h:
                return int(w.group(1)) / int(h.group(1))
    return 4 / 3


def cap_h(cap):
    t = re.sub(r'<[^>]+>', '', cap)
    return (1 + math.ceil(len(t) / 90)) * 0.17 + 0.09


def fig_html(item):
    media, cap, cls = item[:3]
    return f'<figure class="fig{cls}" style="--r:{ratio(media):.3f}">{media}</figure>'


def is_opener(block):
    return (block.startswith('<section class="new-page') and
            re.search(r'<h2 class="project-title"|<h3 class="subproject"', block) is not None)


def promote(opener, item):
    """Put one image (and its caption) into an opener, under its text."""
    cap = item[1]
    add = ('\n  <div class="plate-figs">\n    ' + fig_html(item) + '\n  </div>\n'
           '  <div class="plate-captions">\n    <ol>\n      <li>' + cap + '</li>\n    </ol>\n  </div>\n')
    body, _, tail = opener.rpartition('</section>')
    opener = body.rstrip() + add + '</section>' + tail
    if 'opener-fig' not in opener.split('>', 1)[0]:
        opener = re.sub(r'^<section class="([^"]*)"', r'<section class="\1 opener-fig"', opener, count=1)
    return opener


def side(block):
    """Which page a section must start on: 'R' (right/recto), 'L' (left/verso) or None."""
    cls = re.match(r'<section class="([^"]*)"', block)
    cls = cls.group(1).split() if cls else []
    if 'spread-right' in cls or 'part-start' in cls:
        return 'R'
    if 'spread-left' in cls:
        return 'L'
    return None


def want_odd(opener_side, next_side):
    """Should the project have an odd number of image pages so that the next section,
    which must start on next_side, follows with no blank page in between?"""
    if opener_side is None or next_side is None:
        return None
    # pages run S, S', S, ... after the opener on side S; an odd count ends on S'
    return next_side == opener_side


def page_html(pg, keep=False):
    n = len(pg)
    k = ' data-keep' if keep else ''
    if n == 1:
        cls, style = 'plate-page new-page plate-page--single', ''
    else:
        reserve = 0.35 + sum(cap_h(it[1]) for it in pg) + 0.2
        labels = sum(LABEL_H for it in pg if is_below(it[2]))
        per = (BODY_H - reserve - labels - IMG_GAP * (n - 1)) / n
        per = min(MAX_CAP, math.floor(per * 20) / 20)
        cls = 'plate-page new-page ' + ('plate-page--pair' if n == 2 else 'plate-page--multi')
        style = f' style="--hcap-book:{per:.2f}in"'
    figs = '\n'.join('      ' + fig_html(it) for it in pg)
    caps = '\n'.join(f'        <li>{it[1]}</li>' for it in pg)
    return (f'<section class="{cls}"{k}{style}>\n    <div class="plate-figs">\n{figs}\n    </div>\n'
            f'    <div class="plate-captions">\n      <ol>\n{caps}\n      </ol>\n    </div>\n</section>\n\n')


def _deal(items):
    """Two images per page, in order; a pair only if both fit at a sensible size."""
    pages, i = [], 0
    while i < len(items):
        pair = items[i:i + PER_PAGE]
        if len(pair) == PER_PAGE:
            reserve = 0.35 + sum(cap_h(it[1]) for it in pair) + 0.2
            labels = sum(LABEL_H for it in pair if is_below(it[2]))
            if (BODY_H - reserve - labels - IMG_GAP) / PER_PAGE < 2.2:
                pair = pair[:1]
        pages.append((pair, False))
        i += len(pair)
    return pages


def build_pages(items, odd=None):
    """Pages for one project's images: kept groups stay as they are, the rest is dealt two
    to a page. Returns (pages, parity_ok); pages are (items, kept)."""
    pages, run = [], []
    for it in items + [None]:
        if run and (it is None or it[3] != run[0][3]):
            if run[0][3] is None:
                pages.extend(_deal(run))
            else:
                pages.append((run, True))
            run = []
        if it is not None:
            run.append(it)
    ok = True
    if odd is not None and (len(pages) % 2 == 1) != odd:
        ok = False
        for k in range(len(pages) - 1, -1, -1):
            if len(pages[k][0]) == 2 and not pages[k][1]:
                a, b = pages[k][0]
                pages[k:k + 1] = [([a], False), ([b], False)]
                ok = True
                break
    return pages, ok


def main():
    s = open(PATH).read()
    blocks = re.findall(r'<!--.*?-->\n|<section.*?</section>\n|\n+', s, flags=re.S)
    assert ''.join(blocks) == s, 'could not tokenise the portfolio file'

    out, pending, held, warnings = [], [], [], []
    state = {'opener': None, 'side': None, 'id': ''}
    group_no = 0

    def flush(next_side=None, next_id=''):
        if not pending:
            return
        items = list(pending); pending.clear()
        if state['opener'] is not None:
            out[state['opener']] = promote(out[state['opener']], items.pop(0))
            state['opener'] = None
        pages, ok = build_pages(items, want_odd(state['side'], next_side))
        if not ok:
            warnings.append(f"'{state['id']}' has {len(pages)} image pages (kept groups), so a blank "
                            f"page will come before '{next_id}'.")
        for pg, keep in pages:
            out.append(page_html(pg, keep))

    for b in blocks:
        if b.strip() == '':
            continue
        if b.startswith('<section class="plate-page') and 'plate-page--live' not in b:
            keep = ' data-keep' in b.split('>', 1)[0]
            if keep:
                group_no += 1
            figs = re.findall(r'<figure class="fig([^"]*)"[^>]*>(.*?)</figure>', b, re.S)
            caps = re.findall(r'<li>(.*?)</li>', b, re.S)
            assert len(figs) == len(caps), 'figure/caption count differs on an image page'
            for (cls, media), cap in zip(figs, caps):
                pending.append((media.strip(), cap.strip(), cls, group_no if keep else None))
            continue
        if b.startswith('<!--'):
            # a comment between image pages and the next section: keep it with that
            # section, after the image pages
            held.append(b if b.endswith('\n\n') else b.rstrip('\n') + '\n\n')
            continue
        hid = re.search(r'<h[1-4][^>]*id="([^"]+)"', b)
        flush(side(b), hid.group(1) if hid else '')
        out.extend(held); held.clear()
        block = b if b.endswith('\n\n') else b.rstrip('\n') + '\n\n'
        out.append(block)
        if is_opener(b):
            state['side'] = side(b)
            state['id'] = hid.group(1) if hid else ''
            state['opener'] = None if 'plate-figs' in b else len(out) - 1
        else:
            state['opener'] = None
    flush()
    out.extend(held)

    res = re.sub(r'\n{3,}', '\n\n', ''.join(out))
    open(PATH, 'w').write(res)
    pages = res.count('<section class="plate-page')
    figs = res.count('<figure class="fig')
    print(f'{pages} image pages, {figs} images')
    for w in warnings:
        print('note:', w)


if __name__ == '__main__':
    main()
