import csv, re, json, hashlib, sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
old = (root / 'assets/atlas-daily-games.js').read_text(encoding='utf-8')
legacy = set(re.search(r"const answers=\('([^']+)'", old)[1].replace('ё', 'е').split())
rows = csv.DictReader((root / 'source/word-game/openrussian-nouns.tsv').open(encoding='utf-8'), delimiter='\t')
words = {}
for row in rows:
    raw = row['bare']
    if not re.fullmatch('[а-яё]{4,8}', raw):
        continue
    word = raw.replace('ё', 'е')
    # Keep dictionary guesses broad, but don't draw marked vulgar/slur terms.
    sensitive = bool(re.search(r'\b(vulgar|obscene|slur|derogatory|fuck|shit|cunt|nigger|whore)\b', row['translations_en'], re.I))
    if word not in words:
        words[word] = {'word': word, 'answerable': word not in legacy and not sensitive,
                       'daily': len(word) == 5 and int(hashlib.sha256(word.encode()).hexdigest()[:8], 16) % 3 == 0}
for word in legacy:
    if re.fullmatch('[а-я]{4,8}', word):
        words.setdefault(word, {'word': word, 'answerable': False, 'daily': False})
result = sorted(words.values(), key=lambda x: x['word'])
(root / 'source/word-game/dictionary.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(json.dumps({'dictionary': len(result), 'answers': sum(w['answerable'] for w in result), 'daily': sum(w['daily'] and w['answerable'] for w in result)}, ensure_ascii=False))
if '--seed-sql' in sys.argv:
    # Run with a database owner connection after the schema migration.
    payload = json.dumps(result, ensure_ascii=False, separators=(',', ':'))
    sql = "insert into private.word_dictionary(word,answerable,daily) select word,answerable,daily from jsonb_to_recordset($dict$" + payload + "$dict$::jsonb) as x(word text,answerable boolean,daily boolean) on conflict(word) do nothing;\n"
    (root / 'source/word-game/seed.sql').write_text(sql, encoding='utf-8')
