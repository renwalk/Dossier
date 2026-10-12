#!/usr/bin/env python3
"""Re-stack the Portfolio's image pages.

Each image in sections/05-portfolio.html is a <figure class="fig"> that can carry
a size class (fig--text, fig--medium, fig--small, or nothing for full width) and
an optional alignment (fig--left, fig--right). Smaller images take less of a
page, so more of them can share one. After you change a size class, add an image,
or reorder them, run:

    python3 tools/layout_plates.py

It flattens every image page, then deals the images (in their existing order)
onto pages again: as many as fit on an A4 page body with their captions, never
reordering. The Part/Section/project text pages and the BirdBox page are left alone.

Page geometry mirrors css/book.css (A4, 1in top/bottom margins, 0.65in/0.95in
side margins, ten-column grid). If you change those, change the constants below.
"""
import math, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, 'sections', '05-portfolio.html')

# ---- geometry (inches) ----
PAGE_W, PAGE_H = 210 / 25.4, 297 / 25.4
SIDE = 0.65 + 0.95
BODY_W = PAGE_W - SIDE                  # full-width image (margin to margin)
BODY_H = PAGE_H - 2 - 0.2               # page body height with a little slack (css/book.css --body-h)
GUTTER = 3.5 * 16 / 96                  # --cover-gutter at this page width (clamp max 3.5rem)
GAP_COL = 24 / 96                       # --cover-grid-gap
GRID_W = BODY_W - 2 * GUTTER
STEP = (GRID_W - 9 * GAP_COL) / 10 + GAP_COL
COLS = {'text': 8, 'medium': 6, 'small': 4}   # css/book.css --cols-*
IMG_GAP = 0.12
LABEL_H = 0.32                          # figure number + rule under a full-width image

def width_for(cls):
    for name, n in COLS.items():
        if f'fig--{name}' in cls:
            return n * STEP - GAP_COL
    return BODY_W

def ratio(media):
    m = re.search(r'poster="([^"]+)"', media) or re.search(r'src="([^"]+)"', media)
    if m:
        f = os.path.join(ROOT, m.group(1))
        if os.path.exists(f):
            o = subprocess.run(['sips', '-g', 'pixelWidth', '-g', 'pixelHeight', f], capture_output=True, text=True).stdout
            w = re.search(r'pixelWidth: (\d+)', o); h = re.search(r'pixelHeight: (\d+)', o)
            if w and h:
                return int(w.group(1)) / int(h.group(1))
    return 4 / 3

def cap_h(cap):
    t = re.sub(r'<[^>]+>', '', cap)
    return (1 + math.ceil(len(t) / 100)) * 0.17 + 0.07

def height(item):
    media, cap, cls = item
    h = min(width_for(cls) / ratio(media), BODY_H - 1.6)
    # a full-width image carries its figure number underneath it
    return h + (LABEL_H if width_for(cls) == BODY_W or 'fig--left' in cls else 0)

def main():
    s = open(PATH).read()
    blocks = re.findall(r'<!--.*?-->\n|<section.*?</section>\n|\n+', s, flags=re.S)
    assert ''.join(blocks) == s
    items = []
    for b in blocks:
        if b.strip() == '':
            continue
        if b.startswith('<section class="plate-page') and 'plate-page--live' not in b:
            figs = re.findall(r'<figure class="fig([^"]*)"[^>]*>(.*?)</figure>', b, re.S)
            caps = re.findall(r'<li>(.*?)</li>', b, re.S)
            assert len(figs) == len(caps)
            for (cls, media), cap in zip(figs, caps):
                items.append(('img', (media.strip(), cap.strip(), cls)))
        else:
            items.append(('raw', b))

    out, pend = [], []

    def flush():
        pages, cur = [], []
        for it in pend:
            trial = cur + [it]
            need = (sum(height(x) for x in trial) + IMG_GAP * (len(trial) - 1)
                    + 0.35 + sum(cap_h(x[1]) for x in trial))
            if cur and need > BODY_H:
                pages.append(cur); cur = [it]
            else:
                cur = trial
        if cur:
            pages.append(cur)
        for pg in pages:
            cls = 'plate-page new-page' + (' plate-page--single' if len(pg) == 1 else '')
            figs = '\n'.join(
                f'      <figure class="fig{c}" style="--r:{ratio(m):.3f}">{m}</figure>' for m, _, c in pg)
            caps = '\n'.join(f'        <li>{c}</li>' for _, c, _ in pg)
            out.append(f'<section class="{cls}">\n    <div class="plate-figs">\n{figs}\n    </div>\n'
                       f'    <div class="plate-captions">\n      <ol>\n{caps}\n      </ol>\n    </div>\n</section>\n\n')
        pend.clear()

    for kind, val in items:
        if kind == 'img':
            pend.append(val); continue
        if pend:
            flush()
        out.append(val if val.endswith('\n\n') else val.rstrip('\n') + '\n\n')
    if pend:
        flush()
    res = re.sub(r'\n{3,}', '\n\n', ''.join(out))
    open(PATH, 'w').write(res)
    pages = res.count('<section class="plate-page')
    figs = res.count('<figure class="fig')
    print(f'{pages} image pages, {figs} images')

if __name__ == '__main__':
    main()
