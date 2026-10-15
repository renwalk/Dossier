# Working on the Dossier

(`README.md` is the repository's short description; this file is the how-to.)

## What's here

- `index.html` is the flowing website. `book.html` is the same content paginated for print.
- `sections/` holds one file per piece of content, in order. The CV (`02-cv.html`) is generated.
- `css/`, `js/`, `fonts/`, `assets/`, `projects/` (copies of the live pieces), `tools/`.

## See it

```bash
cd /Users/rxw139/Documents/GitHub/Dossier && python3 tools/serve.py
```

Then open `http://localhost:8123/index.html` (site) or `http://localhost:8123/book.html` (book).
It has to run from a server; double-clicking the HTML files won't work.

## Print it

Open `book.html`, choose **Print / Save as PDF**, and save the PDF. To fold it into a booklet, open
the PDF in Preview or Acrobat and use its Booklet print layout. The page size is set once, in the
`@page` rule at the top of `css/book.css` (US Letter now; `A4` for ISO).

## The CV

`sections/02-cv.html` is built from the CV project. Rebuild the CV, then:

```bash
python3 tools/extract_cv.py
```

Don't edit `02-cv.html` by hand.

## The Portfolio (`sections/05-portfolio.html`)

**Page flow.** Each group (I. Research, II. Professional Work, III. Collaborative Projects) is a
title-only divider. Each project opens on a page with its title, text and its **first image**
(caption at the foot). The images after it come **two to a page**, one column by two rows, captions
at the foot of each page. Images are numbered "fig. 1, 2, 3 ..." continuously through a project.

**Facing pages.** In the book a project opens on a right-hand page (`spread-right` in its class
list) so its image pages land as left/right pairs. A project with sub-projects (Project Data Sense,
Intersections) opens on the left (`spread-left`) so the first sub-project faces it.

**Images.** One folder per entry in `assets/portfolio/`, web-sized (about 2000px JPEG). Keep camera
originals, screen recordings and anything else the site doesn't use **outside** this folder (the unused
files were moved to `~/Documents/Dossier-unused-files/`), so the published site stays small. Reference them as `assets/portfolio/<folder>/<file>`.

**After you add, remove or reorder images**, edit the figures in the HTML and run:

```bash
python3 tools/layout_plates.py
```

It moves the first image after an opener into the opener, deals the rest two to a page, sets how tall
each may be, and keeps the page count right so no blank pages appear (it may turn the last pair of a
project into two single-image pages to do that). It never changes the order of images.

**Sizes.** An image with no size class is full width. `fig--text`, `fig--medium` and `fig--small` are
narrower, start on the text column and carry their "fig. N" in the left column. Add `fig--left` or
`fig--right` to place a small image at an edge.

**Fill the text width (book only).** `fig--fill` on a single-image page makes a tall image as wide as
the text area, cropping a little off the top and bottom instead of shrinking it:
`<figure class="fig fig--fill">`. On the web it is an ordinary full-width image.

**Captions.** Each image page has one `<figure>` per `<li>` caption, in the same order, with every tag
closed. A mismatch stops the book from rendering.

**Live pieces** (Bird Box, Moonflower) sit in their project's opener as the first image: a poster
image plus a "Launch interactive" button on the web, the poster printed in the book. Their code is a
copy in `projects/`; refresh it from the original repo with `sh tools/sync-birdbox.sh` or
`sh tools/sync-moonflower.sh`. Put the poster's width ÷ height on the frame
(`style="--poster-r:1.275"`). `data-embed-css` on the figure holds CSS that fits a piece to the frame.
Moonflower's `sketch.js` contains a weather API key, which is public wherever the site is; restrict
or regenerate it before publishing.

**Animated GIFs** print as a still: give the `<img>` a `data-print-src` pointing at a poster frame.

**Videos** use a `<video controls poster=...>`; the book swaps in the poster. Make the `.mp4` with
`avconvert -s in.mov -p PresetPassthrough -o out.mp4`.

**Contents and dividers.** The numbers in headings and the Contents list are typed by hand; the
Contents years are the `data-year` on each page-number span. Renumbering means editing both.

## Side images in the Introduction and Research

A side image is an `<aside class="margin-note left">` (picture and `<figcaption>`) placed as the **first
child of the `.content` block it belongs to**, and it hangs in the column to the left of that text. It is
taken out of the flow, so a tall picture never stretches the text or leaves a gap, and it stays with its
paragraph when the book breaks pages. `js/stack-notes.js` runs after the page is laid out and nudges a
note down if it would overlap the one above (and, in the book, up if it would run off the foot of the
page). Add `below-head` to the first note of a section so it starts below the heading numeral.

## Contents page (book only)

`sections/01-frontmatter.html`. Each entry sits on the divider grid (ten columns by twelve rows):
`--c1` and `--c2` are its start and end column lines (1-11), `--r` its starting row, and `--bw` /
`--bh` the length and thickness of the short bar above it. Move an entry by changing those numbers. Page
numbers are filled in automatically. Type sizes are the `.toc-entry` rules at the end of `css/book.css`.

## Blank-page images (book only)

Pages the book leaves blank, from the CV onward, are filled with a cropped, grayscale image. Edit
`book-textures.json` to choose them. Each blank page has a label naming its neighbour
(`after:cv`, `before:research`, ...); open `book.html` and read the browser console to see every
label and the image it got. Under `"pages"`, give a label an `image` (or `"none"` to leave it
blank), and optionally `zoom` (percent; larger is a tighter crop), `x` and `y` (0-100, which part of
the image shows). Labels not listed pick from `"default"`. The look (grayscale, line screen) is the
`.page-texture` rule in `css/book.css`.

## Evidence Appendix

Documents live in `assets/portfolio/evidence/` (clean file names, no spaces or colons) with a first-page
image of each in `evidence/thumbs/` (1100px JPEG; make one with `sips -s format jpeg -Z 1100 file.pdf --out thumbs/name.jpg`).
Each entry in `sections/05-portfolio.html` is an `.evidence-item` holding the thumbnail (linked to the
document on the web) and a label. Add `evidence-item--wide` for a landscape image. A dashed
`[placeholder]` box marks one still to be gathered.

## Troubleshooting

- "Failed to fetch": reload once. The server is `tools/serve.py`, which never caches.
- Book won't render: a tag in a section file is unclosed. The error names the file.
- Fonts: Inter, Tiempos Fine and Tiempos Text come from the CV project's `fonts/`.
