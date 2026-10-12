#!/usr/bin/env python3
"""Parse the already-built output/cv_academic.html into a simple tree,
pull out the .cv-body structure (sec > subsec > ln/cite/cur entries),
and re-emit it as HTML using the Dossier's own component classes.

Reads the FINAL rendered CV (not the spreadsheet or the Jinja template)
so all of build.py's citation logic, section ordering, and grouping is
reused as-is rather than reimplemented.
"""
import html.parser
import re
import json

SRC = "/Users/rxw139/Documents/GitHub/CV/output/cv_academic.html"
OUT = "/Users/rxw139/Documents/GitHub/Dossier/sections/02-cv.html"

VOID_TAGS = {"br", "img", "hr", "meta", "link", "input"}


class Node:
    __slots__ = ("tag", "attrs", "children")

    def __init__(self, tag, attrs):
        self.tag = tag
        self.attrs = dict(attrs)
        self.children = []  # list of Node or str

    def cls(self):
        return self.attrs.get("class", "")

    def has_class(self, name):
        return name in self.cls().split()

    def find_all(self, cls_name, _out=None):
        if _out is None:
            _out = []
        for c in self.children:
            if isinstance(c, Node):
                if c.has_class(cls_name):
                    _out.append(c)
                c.find_all(cls_name, _out)
        return _out

    def find(self, cls_name):
        r = self.find_all(cls_name)
        return r[0] if r else None

    def text(self):
        out = []
        for c in self.children:
            if isinstance(c, Node):
                out.append(c.text())
            else:
                out.append(c)
        return "".join(out).strip()

    def inner_html(self):
        return "".join(
            c.to_html() if isinstance(c, Node) else c for c in self.children
        ).strip()

    def to_html(self):
        attrs = "".join(f' {k}="{v}"' for k, v in self.attrs.items())
        if self.tag in VOID_TAGS:
            return f"<{self.tag}{attrs}>"
        return f"<{self.tag}{attrs}>{self.inner_html()}</{self.tag}>"


class TreeBuilder(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root", {})
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].children.append(Node(tag, attrs))

    def handle_endtag(self, tag):
        # pop until we find a matching open tag (handles any stray mismatches)
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def parse(path):
    with open(path, encoding="utf-8") as f:
        src = f.read()
    tb = TreeBuilder()
    tb.feed(src)
    return tb.root


def clean_inline(html_str):
    """Collapse whitespace inside an entry body while keeping inline tags."""
    html_str = re.sub(r"\s+", " ", html_str).strip()
    # Keep only the inline tags we expect; nothing else should appear here.
    return html_str


def render_entry(entry):
    """Render one .ln / .cite / .cur node as a .cv-entry HTML string."""
    if entry.has_class("cur"):
        date = entry.find("cur-date")
        etitle = entry.find("cur-title")
        org = entry.find("cur-org")
        desc = entry.find("cur-desc")
        when = date.text() if date else ""
        what_parts = []
        if etitle:
            what_parts.append(f"<em>{etitle.text()}</em>")
        if org:
            what_parts.append(org.text())
        what = ", ".join(p for p in what_parts if p)
        desc_html = f'<p class="cv-desc">{desc.inner_html()}</p>' if desc else ""
        return (
            f'<div class="cv-entry"><span class="cv-when">{when}</span>'
            f'<p class="cv-what">{what}</p>{desc_html}</div>'
        )

    date_cls = "ln-date" if entry.has_class("ln") else "cite-date"
    body_cls = "ln-body" if entry.has_class("ln") else "cite-body"
    date = entry.find(date_cls)
    body_node = entry.find(body_cls)
    when = date.text() if date else ""
    what = clean_inline(body_node.inner_html()) if body_node else ""
    return (
        f'<div class="cv-entry"><span class="cv-when">{when}</span>'
        f'<p class="cv-what">{what}</p></div>'
    )


def main():
    root = parse(SRC)
    body = root.find("cv-body")
    secs = [c for c in body.children if isinstance(c, Node) and c.has_class("sec")]

    out = []
    out.append(
        "<!--\n"
        "  AUTO-GENERATED from ../CV/output/cv_academic.html (your real academic CV) —\n"
        "  do not hand-edit this file. To update it after changing your CV (the\n"
        "  spreadsheet, cv_layout.json, etc.), rebuild the CV first, then regenerate\n"
        "  this file:\n\n"
        "    cd ../CV && python3 build.py --pdf\n"
        "    cd ../Dossier && python3 tools/extract_cv.py\n\n"
        "  The script reads the already-built cv_academic.html, so it reuses your\n"
        "  CV's own section grouping, ordering, and citation formatting rather than\n"
        "  reimplementing any of it — this file just reskins that same content with\n"
        "  the Dossier's own component classes (.cv-category / .cv-subcategory /\n"
        "  .cv-entry) instead of the CV's PDF-specific CSS.\n"
        "-->"
    )
    out.append('<section class="part-start divider" style="--eb-l:4.5rem;--ebh-l:6px;--eb-r:100%;--ebh-r:1px;--tb-col:3;--tb-len:2;--tb-h:6px;--eyl-row:2;--eyr-row:3;--t-row:5">')
    out.append('  <p class="cover-eyebrow cover-col-body divider-part">Part One</p>')
    out.append('  <h1 class="divider-title" id="cv"><span class="divider-line c1 leader">CURRICULUM</span><span class="divider-line c4">VITAE</span></h1>')
    out.append('</section>')

    for sec in secs:
        sec_title = sec.find("sec-title")
        title_text = sec_title.text() if sec_title else "(untitled)"
        # No .new-page here — with 156 entries across 9 groups, forcing
        # each group onto its own fresh page would leave large gaps
        # after short ones (Education is 3 lines). Letting it flow, with
        # break-after:avoid-page on headings (book.css) so a heading is
        # never stranded alone at a page bottom, reads much more like an
        # actual CV.
        out.append('<section>')
        out.append('  <div class="content">')
        out.append(f'    <p class="cv-category">{title_text}</p>')

        subsecs = [c for c in sec.children if isinstance(c, Node) and c.has_class("subsec")]
        for subsec in subsecs:
            heading_html = None
            head = subsec.find("subsec-head")
            if head is not None:
                note = head.find("subsec-note")
                subtitle = head.find("subsec-title")
                note_text = note.text() if note else ""
                subtitle_text = subtitle.text() if subtitle else ""
                note_html = f' <span class="cv-note">{note_text}</span>' if note_text else ""
                heading_html = f'<p class="cv-subcategory">{subtitle_text}{note_html}</p>'

            entries = [
                c for c in subsec.children
                if isinstance(c, Node) and (c.has_class("ln") or c.has_class("cite") or c.has_class("cur"))
            ]
            entry_html = [render_entry(e) for e in entries]

            # A heading with `break-after:avoid` (book.css) still gets
            # separated from its first entry when Paged.js decides that
            # entry itself must move to fit — CSS fragmentation "avoid"
            # hints are frequently only partially honored. Wrapping the
            # heading with its first entry in one break-inside:avoid
            # block is a much more reliably-supported way to keep them
            # on the same page.
            if heading_html and entry_html:
                out.append('    <div class="cv-group">')
                out.append(f"      {heading_html}")
                out.append(f"      {entry_html[0]}")
                out.append("    </div>")
                entry_html = entry_html[1:]
            elif heading_html:
                out.append(f"    {heading_html}")

            out.extend(f"    {e}" for e in entry_html)

        out.append("  </div>")
        out.append("</section>")
        out.append("")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")

    print(f"Wrote {OUT}")
    print(f"Sections: {len(secs)}")
    total_entries = sum(
        1 for sec in secs
        for subsec in sec.children if isinstance(subsec, Node) and subsec.has_class("subsec")
        for e in subsec.children if isinstance(e, Node) and (e.has_class("ln") or e.has_class("cite") or e.has_class("cur"))
    )
    print(f"Entries: {total_entries}")


if __name__ == "__main__":
    main()
