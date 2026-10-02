"""Extract the 78 illustrations from the user's PDF; no external image service."""
import json
import argparse
import re
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
records = [json.loads(s) for s in (ROOT.parent / '其实你已经很塔罗了_rag.jsonl').read_text('utf-8').splitlines()]
parser = argparse.ArgumentParser()
parser.add_argument('--pdf', type=Path, default=ROOT.parent.parent / '《其实你已经很塔罗了》(1).pdf')
pdf = PdfReader(str(parser.parse_args().pdf))
out = ROOT / 'web/assets/cards'
out.mkdir(parents=True, exist_ok=True)
cards = []
seen = set()
for r in records:
    if not r['card'] or r['section'] in seen:
        continue
    seen.add(r['section'])
    page = min(r['source']['pdf_pages'])
    portraits = [im for im in pdf.pages[page-1].images if im.image.height / im.image.width > 1.4]
    if not portraits:
        raise ValueError(f"Missing illustration: {r['section']} on {page}")
    cid = f'card-{len(cards):02d}'
    max(portraits, key=lambda im: im.image.width * im.image.height).image.convert('RGB').save(out / f'{cid}.jpg', quality=95)
    meta = r['card']
    name = meta['name'] if meta['arcana'] == '大阿尔克纳' else meta['suit'] + meta['rank']
    cards.append(dict(id=cid, name=name, section=r['section'], metadata=meta, image=f'/assets/cards/{cid}.jpg', page=page))
assert len(cards) == 78, len(cards)
(ROOT / 'cards.json').write_text(json.dumps(cards, ensure_ascii=False, indent=2), 'utf-8')
print(f'Extracted {len(cards)} card illustrations')
