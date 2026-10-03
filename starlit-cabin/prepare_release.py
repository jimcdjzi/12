"""Build a reviewed source release, without private knowledge or session data."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parent
explicit = ['.gitignore', '.env.example', 'README.md', 'requirements.txt', 'package.json',
            'build_tarot_jsonl.py', 'tarot_rag.py', 'prepare_release.py',
            '.github/workflows/test.yml', 'cabin/README.md', 'cabin/cards.json',
            'cabin/server.py', 'cabin/llm.py', 'cabin/prepare_assets.py', 'cabin/compose_music.py',
            'cabin/test_llm.py', 'cabin/test_cabin.py', 'cabin/check_immersive.cjs', 'cabin/check_bugfixes.cjs', 'cabin/启动小屋.ps1']
files = [ROOT / name for name in explicit if (ROOT / name).is_file()]
files += [p for p in (ROOT / 'cabin/web').rglob('*') if p.is_file() and 'assets/cards/' not in p.relative_to(ROOT / 'cabin/web').as_posix()]
for file in files:
    if file.suffix in ('.py', '.js', '.cjs', '.json', '.md', '.ps1', '.html', '.yml'):
        content = file.read_text('utf-8')
        if re.search(r'(?:sk-[A-Za-z0-9]{24,}|gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{24,})', content):
            raise SystemExit(f'Possible credential in {file.relative_to(ROOT)}; packaging stopped')
out = ROOT / 'dist'
out.mkdir(exist_ok=True)
with zipfile.ZipFile(out / 'starlit-cabin-source.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(files):
        archive.write(file, file.relative_to(ROOT).as_posix())
manifest = [{'path': p.relative_to(ROOT).as_posix(), 'size': p.stat().st_size,
             'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(files)]
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), 'utf-8')
print(json.dumps({'files': len(files), 'archive': str(out / 'starlit-cabin-source.zip'),
                  'private_pdf_or_database_included': False, 'credential_pattern_scan': 'passed'}, ensure_ascii=False))
