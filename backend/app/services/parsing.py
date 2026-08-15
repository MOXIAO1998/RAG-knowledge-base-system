"""Document parsing and splitting: supports PDF/Word/Markdown/TXT/HTML.

Parsing produces a list of (page number, text), which is then split into Chunks by
"heading sectioning -> sentence-boundary chunking":
1. Identify heading lines (Markdown uses # levels; other types use numbering patterns
   such as Chapter X or a Chinese ordinal prefix), and maintain a heading stack to generate title_path;
2. Within a section, assemble sentences up to the target length by sentence boundaries,
   keeping complete sentences in the overlap region, to avoid broken sentences caused by
   fixed-length hard splitting (e.g. chunks starting with a period).
"""
from __future__ import annotations

import logging
import re

logger = logging.getLogger("rag.parsing")

EXT_TYPE = {
    "pdf": "PDF",
    "doc": "Word",
    "docx": "Word",
    "md": "Markdown",
    "markdown": "Markdown",
    "txt": "TXT",
    "text": "TXT",
    "html": "HTML",
    "htm": "HTML",
}


def detect_file_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"
    return EXT_TYPE.get(ext, "TXT")


def extract_pages(file_path: str, file_type: str) -> list[tuple[int, str]]:
    """Return [(page number, text), ...]. Raises an exception on parse failure, leaving the caller to mark it as failed."""
    if file_type == "PDF":
        from pypdf import PdfReader

        reader = PdfReader(file_path)
        pages = []
        for i, page in enumerate(reader.pages, start=1):
            pages.append((i, page.extract_text() or ""))
        return pages or [(1, "")]

    if file_type == "Word":
        import docx

        doc = docx.Document(file_path)
        text = "\n".join(p.text for p in doc.paragraphs)
        return [(1, text)]

    # Markdown / TXT / HTML are all read as plain text
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        raw = f.read()

    if file_type == "HTML":
        from bs4 import BeautifulSoup

        raw = BeautifulSoup(raw, "lxml").get_text("\n")
    elif file_type == "Markdown":
        # Keep the # heading structure for title_path extraction during splitting; only clean emphasis/code/quote markers
        raw = re.sub(r"[>*`]+", " ", raw)
    return [(1, raw)]


_MD_HEADING = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
# Non-Markdown numbered headings: Chapter/Section X, Chinese ordinal prefixes, etc. (require the whole line to be short and free of punctuation to reduce false positives)
_CHAPTER_HEADING = re.compile(r"^第[一二三四五六七八九十百0-9]{1,4}[章节篇部].{0,20}$")
_CN_NUM_HEADING = re.compile(r"^[一二三四五六七八九十]{1,3}[、.．].{1,20}$")
_BRACKET_HEADING = re.compile(r"^【[^【】]{1,22}】$")  # e.g. a heading wrapped in CJK lenticular brackets


def _detect_heading(line: str, file_type: str) -> tuple[int, str] | None:
    """Identify a heading line, returning (level, heading text); return None if not a heading."""
    s = line.strip()
    if not s:
        return None
    if file_type == "Markdown":
        m = _MD_HEADING.match(s)
        if m:
            return len(m.group(1)), m.group(2).strip()
        return None
    # Numbered headings should be short lines free of sentence punctuation
    if len(s) > 25 or any(ch in s for ch in "。，,；;：:？！"):
        return None
    if _CHAPTER_HEADING.match(s):
        return 1, s
    if _CN_NUM_HEADING.match(s):
        return 2, s
    if _BRACKET_HEADING.match(s):
        return 2, s.strip("【】")
    return None


def _split_sentences(text: str) -> list[str]:
    """Split into sentence fragments by sentence-ending punctuation/newlines (punctuation preserved)."""
    parts = re.split(r"(?<=[。！？；!?;\n])", text)
    return [p for p in parts if p.strip()]


def _pack_sentences(sentences: list[str], chunk_size: int, overlap: int) -> list[str]:
    """Assemble sentences into chunks no larger than chunk_size, keeping complete sentences in the overlap region."""
    pieces: list[str] = []
    buf: list[str] = []
    buf_len = 0
    has_new = False  # whether buf holds new, not-yet-emitted sentences (avoids re-emitting when only overlap content remains at the tail)
    for sent in sentences:
        # An overly long single sentence degrades to a hard split
        while len(sent) > chunk_size:
            if has_new and buf:
                pieces.append("".join(buf).strip())
            buf, buf_len, has_new = [], 0, False
            pieces.append(sent[:chunk_size].strip())
            sent = sent[chunk_size:]
        if not sent:
            continue
        if buf_len + len(sent) > chunk_size and has_new:
            pieces.append("".join(buf).strip())
            # Reclaim a few complete sentences from the tail as overlap context
            keep: list[str] = []
            keep_len = 0
            for prev in reversed(buf):
                if keep_len + len(prev) > overlap:
                    break
                keep.insert(0, prev)
                keep_len += len(prev)
            buf, buf_len, has_new = keep, keep_len, False
        buf.append(sent)
        buf_len += len(sent)
        has_new = True
    if has_new and buf:
        pieces.append("".join(buf).strip())
    return [p for p in pieces if p]


def split_pages(
    pages: list[tuple[int, str]],
    file_type: str = "TXT",
    chunk_size: int = 500,
    overlap: int = 80,
    min_chunk: int = 50,
) -> list[dict]:
    """Split page text into a list of Chunks: first section by headings, then chunk within each section by sentence boundaries."""
    chunks: list[dict] = []
    idx = 0
    titles: dict[int, str] = {}  # heading stack: level -> heading text

    def _title_path() -> str:
        return " > ".join(titles[lv] for lv in sorted(titles))

    for page_no, text in pages:
        text = (text or "").strip()
        if not text:
            continue
        # Split by heading lines into (title_path, body) sections; headings continue across pages
        sections: list[tuple[str, list[str]]] = []
        cur_lines: list[str] = []
        cur_path = _title_path()
        for line in text.splitlines():
            head = _detect_heading(line, file_type)
            if head:
                if cur_lines:
                    sections.append((cur_path, cur_lines))
                level, title = head
                for lv in [lv for lv in titles if lv >= level]:
                    titles.pop(lv)
                titles[level] = title
                cur_path = _title_path()
                cur_lines = [title]  # Keep the heading text at the start of the body to strengthen retrieval semantics
            else:
                cur_lines.append(line)
        if cur_lines:
            sections.append((cur_path, cur_lines))

        for path, lines in sections:
            body = "\n".join(lines).strip()
            if not body:
                continue
            for piece in _pack_sentences(_split_sentences(body), chunk_size, overlap):
                chunks.append(
                    {
                        "chunk_index": idx,
                        "title_path": path,
                        "content": piece,
                        "source_page": page_no,
                    }
                )
                idx += 1

    # Merge overly short fragments (e.g. isolated document heading lines) into adjacent chunks to avoid retrieval noise
    merged: list[dict] = []
    for ck in chunks:
        if merged and len(ck["content"]) < min_chunk and merged[-1]["title_path"] == ck["title_path"]:
            merged[-1]["content"] += "\n" + ck["content"]
            continue
        merged.append(ck)
    if len(merged) > 1 and len(merged[0]["content"]) < min_chunk:
        merged[1]["content"] = merged[0]["content"] + "\n" + merged[1]["content"]
        merged.pop(0)
    for i, ck in enumerate(merged):
        ck["chunk_index"] = i
    return merged
