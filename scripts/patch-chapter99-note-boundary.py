from pathlib import Path

p = Path('scripts/build-chapter99-index.py')
s = p.read_text()

old = "note_start_re = re.compile(r'^\\s*(\\d{1,3})\\.\\s*(?:\\(([a-z])\\))?\\s+')"
new = "note_start_re = re.compile(r'^\\s*(\\d{1,3})\\.\\s*(?:\\(([a-z])\\))?(?:\\s+|$)')"
if old not in s:
    raise SystemExit('note_start_re marker not found')
s = s.replace(old, new, 1)

marker = """code_candidates = defaultdict(set)\nfor code, keys in note_membership.items():\n    for heading, target_keys in relations.items():\n        if keys.intersection(target_keys):\n            code_candidates[code].add(heading)\n\nheadings_out = {}\n"""
replacement = """code_candidates = defaultdict(set)\nfor code, keys in note_membership.items():\n    for heading, target_keys in relations.items():\n        if keys.intersection(target_keys):\n            code_candidates[code].add(heading)\n\n# Structural safety checks. Bare note numbers such as \"38.\" occur frequently\n# in the official Chapter 99 PDF. If a note boundary is missed, an unrelated\n# HTS list can be assigned to the prior note and create catastrophic false\n# positives. Fail the build instead of publishing such an index.\nnote38b_codes = sorted(code for code, keys in note_membership.items() if '38:b' in keys)\ninvalid_note38b = [code for code in note38b_codes if not code.startswith('87')]\nif invalid_note38b:\n    raise RuntimeError(\n        'Chapter 99 note 38(b) contains non-vehicle HTS codes; note-boundary parsing is contaminated: '\n        + ', '.join(invalid_note38b[:20])\n    )\nfor gypsum_code in ('68091100', '6809110010'):\n    bad = sorted(set(code_candidates.get(gypsum_code, set())) & {'9903.74.01', '9903.76.01'})\n    if bad:\n        raise RuntimeError(\n            f'False Chapter 99 mapping for gypsum HTS {gypsum_code}: {bad}'\n        )\n\nheadings_out = {}\n"""
if marker not in s:
    raise SystemExit('code_candidates marker not found')
s = s.replace(marker, replacement, 1)

p.write_text(s)
print('Chapter 99 note-boundary parser patch applied.')
