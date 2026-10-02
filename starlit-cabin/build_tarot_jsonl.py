"""Turn the supplied tarot PDF into source-traceable RAG chunks.

Requires pypdf and pdfplumber. No external model or network service is used.
"""

from __future__ import annotations

import hashlib
import argparse
import json
import re
from collections import Counter
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / '《其实你已经很塔罗了》(1).pdf'
OUTPUT = ROOT / '其实你已经很塔罗了_rag.jsonl'
REPORT = ROOT / '其实你已经很塔罗了_清洗说明.md'
TITLE = "其实你已经很塔罗了"
AUTHOR = "Paul Fenton Smith"
MAX_CHARS = 1100
TARGET_CHARS = 780


def flatten_outline(items, depth=0):
    for item in items:
        if isinstance(item, list):
            yield from flatten_outline(item, depth + 1)
        else:
            yield item, depth


def compact(text: str) -> str:
    text = text.replace("\x00", "").replace("\u00a0", " ").strip()
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"(?<=[\u3400-\u9fff]) (?=[\u3400-\u9fff])", "", text)
    text = re.sub(r" (?=[，。！？；：、）》」』])", "", text)
    text = re.sub(r"(?<=[（《「『]) ", "", text)
    return text


def join_lines(lines: list[str]) -> str:
    result = ""
    for line in lines:
        line = compact(line)
        if not line:
            continue
        if not result:
            result = line
        elif re.search(r"[\u3400-\u9fff，。！？；：、）》」』]$", result) and re.match(r"[\u3400-\u9fff（《「『]", line):
            result += line
        else:
            result += " " + line
    return result


def split_long(paragraph: str) -> list[str]:
    if len(paragraph) <= MAX_CHARS:
        return [paragraph]
    sentences = re.split(r"(?<=[。！？；])", paragraph)
    out, current = [], ""
    for sentence in sentences:
        if len(current) + len(sentence) > MAX_CHARS and current:
            out.append(current)
            current = ""
        current += sentence
        while len(current) > MAX_CHARS:
            cut = current.rfind("，", 0, MAX_CHARS)
            if cut < MAX_CHARS // 2:
                cut = MAX_CHARS
            else:
                cut += 1
            out.append(current[:cut])
            current = current[cut:]
    if current:
        out.append(current)
    return out


def classify(title: str, chapter: str) -> tuple[str, dict]:
    card = {}
    suit = next((s for s in ("权杖", "圣杯", "宝剑", "五角星") if title.startswith(s)), None)
    if suit and re.fullmatch(rf"{suit}(?:王牌|[二三四五六七八九十]|侍卫|骑士|皇后|国王)", title):
        card = {"arcana": "小阿尔克纳", "suit": suit, "rank": title[len(suit):]}
        return "card", card
    if re.match(r"^(?:[0-9]|1[0-9]|2[01])[^0-9]", title) and "（The " in title or re.match(r"^\d+(?:愚人|魔术师|女教皇|女皇|皇帝|教皇|恋人|战车|力量|隐士|命运之轮|正义|悬吊者|死亡|节制|魔鬼|高塔|星星|月亮|太阳|审判|世界)", title):
        m = re.match(r"^(\d+)([^（]+)", title)
        if m:
            card = {"arcana": "大阿尔克纳", "number": int(m.group(1)), "name": m.group(2)}
        return "card", card
    if title.endswith("牌组"):
        return "suit_overview", {}
    if "故事" in title:
        return "narrative", {}
    if "牌形" in title or "算法" in title or "分析" in title or "占卜的程序" in title or title == "回答有关钱的问题":
        return "method", {}
    if title in ("序：", "简介", "塔罗牌如何帮助你", "什么是塔罗牌？", "塔罗牌-----从过去到现在"):
        return "introduction", {}
    return "concept", {}


def subsection_for(line: str, is_card: bool) -> str | None:
    if not is_card:
        return None
    if line in ("大体上的意义", "大体的意义"):
        return "大体上的意义"
    if line in ("两性关系上的意义", "两性关系的意义"):
        return "两性关系上的意义"
    if line.startswith("倒立") and len(line) < 30:
        return "倒立的意义"
    return None


def blocks_from_lines(lines: list[dict], is_card: bool) -> list[tuple[str, list[str], list[int]]]:
    blocks = []
    subsection = "牌面与核心含义" if is_card else "正文"
    paragraphs = []
    pages = []
    current_lines = []
    current_pages = []
    previous_top = None
    previous_page = None

    def flush_paragraph():
        nonlocal current_lines, current_pages
        if current_lines:
            paragraphs.append(join_lines(current_lines))
            pages.append(sorted(set(current_pages)))
            current_lines, current_pages = [], []

    def flush_block():
        nonlocal paragraphs, pages
        flush_paragraph()
        if paragraphs:
            blocks.append((subsection, paragraphs, pages))
            paragraphs, pages = [], []

    for item in lines:
        value = compact(item["text"])
        sub = subsection_for(value, is_card)
        if sub:
            flush_block()
            subsection = sub
            previous_top, previous_page = None, None
            continue
        if not value:
            continue
        page = item["page"]
        top = item["top"]
        indent = item["x0"] >= 73
        gap = top - previous_top if page == previous_page and previous_top is not None else 0
        if current_lines and (indent or gap > 27):
            flush_paragraph()
        current_lines.append(value)
        current_pages.append(page)
        previous_top, previous_page = top, page
    flush_block()
    return blocks


def pack(paragraphs: list[str], paragraph_pages: list[list[int]]) -> list[tuple[str, list[int]]]:
    units = []
    for paragraph, pages in zip(paragraphs, paragraph_pages):
        for part in split_long(paragraph):
            units.append((part, pages))
    chunks = []
    current, current_pages = [], set()
    for part, pages in units:
        length = sum(map(len, current)) + len(current)
        if current and length + len(part) > TARGET_CHARS:
            chunks.append(("\n\n".join(current), sorted(current_pages)))
            current, current_pages = [], set()
        current.append(part)
        current_pages.update(pages)
    if current:
        chunks.append(("\n\n".join(current), sorted(current_pages)))
    return chunks


def main():
    reader = PdfReader(SOURCE)
    sha256 = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    bookmarks = []
    for dest, depth in flatten_outline(reader.outline):
        page = reader.get_destination_page_number(dest) + 1
        y = 842 - float(dest.get("/Top", 842))
        bookmarks.append({"title": compact(dest.title), "depth": depth, "page": page, "y": y})
    bookmarks.sort(key=lambda b: (b["page"], b["y"]))

    with pdfplumber.open(SOURCE) as pdf:
        page_lines = {}
        for page_number in range(4, len(pdf.pages) + 1):
            page = pdf.pages[page_number - 1]
            page_lines[page_number] = [
                {"text": line["text"], "x0": line["x0"], "top": line["top"], "page": page_number}
                for line in page.extract_text_lines()
                if 95 <= line["top"] < 800
            ]

    records = []
    section_stats = []
    chapter = "前言"
    for i, bookmark in enumerate(bookmarks):
        next_bookmark = bookmarks[i + 1] if i + 1 < len(bookmarks) else None
        if bookmark["depth"] == 0:
            chapter = bookmark["title"]
        section_lines = []
        last_page = next_bookmark["page"] if next_bookmark else len(reader.pages)
        for page_number in range(bookmark["page"], last_page + 1):
            start = bookmark["y"] - 1 if page_number == bookmark["page"] else 95
            end = next_bookmark["y"] - 1 if next_bookmark and page_number == next_bookmark["page"] else 800
            if start >= end:
                continue
            section_lines.extend(
                line for line in page_lines[page_number]
                if start <= line["top"] < end
            )
        # The bookmark title is a structural label, not part of the retrieved passage.
        if section_lines and compact(section_lines[0]["text"]).replace(" ", "") == bookmark["title"].replace(" ", ""):
            section_lines.pop(0)
        # This bookmarked heading is followed only by stray navigation labels
        # carried over from the PDF layout, not by a chapter body.
        if bookmark["title"] == "增进你的技巧":
            section_lines = []
        kind, card = classify(bookmark["title"], chapter)
        blocks = blocks_from_lines(section_lines, kind == "card")
        section_count = 0
        for subsection, paragraphs, paragraph_pages in blocks:
            for text, pages in pack(paragraphs, paragraph_pages):
                if not text or (len(text) < 12 and kind != "card"):
                    continue
                record = {
                    "id": f"tarot-{i + 1:03d}-{section_count + 1:02d}",
                    "source": {"title": TITLE, "author": AUTHOR, "file": SOURCE.name, "sha256": sha256, "pdf_pages": pages},
                    "chapter": chapter,
                    "section": bookmark["title"],
                    "subsection": subsection,
                    "content_type": kind,
                    "card": card or None,
                    "text": text,
                    "retrieval_text": f"{chapter} / {bookmark['title']} / {subsection}\n{text}",
                }
                records.append(record)
                section_count += 1
        section_stats.append((bookmark["title"], section_count))

    with OUTPUT.open("w", encoding="utf-8", newline="\n") as f:
        for record in records:
            f.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")

    types = Counter(r["content_type"] for r in records)
    pages = sorted({p for r in records for p in r["source"]["pdf_pages"]})
    empty = [name for name, count in section_stats if count == 0]
    lengths = [len(r["text"]) for r in records]
    report = f"""# 《{TITLE}》RAG 数据清洗说明

源文件：`{SOURCE}`  
SHA-256：`{sha256}`  
输出文件：`{OUTPUT.name}`

## 范围与结果

- 原 PDF 共 {len(reader.pages)} 页；正文从 PDF 第 4 页的“序”开始。第 1 页的图书简介、作者简介和第 2–4 页的目录部分未纳入检索；网站页眉、页码已排除。
- 输出 {len(records)} 个 UTF-8 JSONL 知识块，覆盖 PDF 第 {pages[0]}–{pages[-1]} 页。
- 书签章节 {len(bookmarks)} 个；其中无有效正文的章节：{', '.join(empty) if empty else '无'}。
- 类型分布：{', '.join(f'{k} {v}' for k, v in sorted(types.items()))}。
- 单块正文长度：最短 {min(lengths)} 字，最长 {max(lengths)} 字，中位数 {sorted(lengths)[len(lengths)//2]} 字。

## 字段

| 字段 | 用途 |
| --- | --- |
| `id` | 稳定的段落编号，按书签和块序号生成 |
| `source` | 书名、作者、源文件名、文件哈希和 PDF 页码；页码以 PDF 页序为准 |
| `chapter` / `section` / `subsection` | 层级检索过滤与召回上下文 |
| `content_type` | `card`、`suit_overview`、`method`、`concept`、`narrative` 或 `introduction` |
| `card` | 卡牌结构字段；非卡牌为 `null` |
| `text` | 去除页眉页脚并合并印刷断行后的原书内容 |
| `retrieval_text` | 拼接章节路径和正文，可直接用于向量化；展示引用时使用 `text` |

## 清洗原则与限制

1. 使用 PDF 内置书签定位章节；卡牌中的“大体上的意义”“两性关系上的意义”“倒立的……”另分子节。长段按句子拆分，避免跨章节混杂。
2. 只处理空格、页眉页脚和版面断行；保留原书用词、译名、例子及可能的原文错别字。`text` 是来源陈述，不代表事实核验或科学结论。
3. “简介”书签与其首个子节同点，无独立正文。原 PDF 第 32–33 页有一组排版残留的章节标题；“增进你的技巧”只含这些标题，已跳过该空块。
4. PDF 中的牌图未转写为图像描述。图像细节只保留正文已有的描述。涉及排版、图片或含糊句子时应返回源 PDF 复核。
5. 问答层应引用 `source.pdf_pages`，并将占卜结论表述为“书中认为”。勿把书中的医疗、法律、财务暗示当作专业建议。

## 使用示例

```python
import json

with open(r"{OUTPUT}", encoding="utf-8") as f:
    chunks = [json.loads(line) for line in f]

for chunk in chunks:
    if chunk["section"] == "权杖王牌" and chunk["subsection"] == "倒立的意义":
        print(chunk["source"]["pdf_pages"], chunk["text"])
```
"""
    REPORT.write_text(report, encoding="utf-8")
    print(json.dumps({"records": len(records), "pages": [pages[0], pages[-1]], "empty_sections": empty, "types": types, "length_min": min(lengths), "length_max": max(lengths)}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdf', type=Path, default=SOURCE)
    SOURCE = parser.parse_args().pdf
    main()
