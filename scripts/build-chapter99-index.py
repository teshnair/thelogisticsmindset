#!/usr/bin/env python3
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone

if len(sys.argv) < 3:
    raise SystemExit("usage: build-chapter99-index.py <chapter99.txt> <output.json>")

src, out = sys.argv[1], sys.argv[2]
text = open(src, "r", encoding="utf-8", errors="replace").read()
lines = text.splitlines()

rev = None
rev_match = re.search(r'Harmonized Tariff Schedule of the United States Revision\s+(\d+)\s*\((2026)\)', text)
if rev_match:
    rev = int(rev_match.group(1))

note_membership = defaultdict(set)
subdivision_text = defaultdict(list)
current_note = None
current_letter = None
current_roman = None
current_subchapter = None
in_notes = False

code_re = re.compile(r'\b(\d{4}(?:\.\d{2}){1,3})\b')
heading_re = re.compile(r'^\s*(99\d{2}\.\d{2}\.\d{2})\b')
note_start_re = re.compile(r'^\s*(\d{1,3})\.\s*(?:\(([a-z])\))?(?:\s+|$)')
sub_re = re.compile(r'^\s*\(([a-z]|[ivxlcdm]+)\)\s+')
roman_tokens = {"i","ii","iii","iv","v","vi","vii","viii","ix","x","xi","xii","xiii","xiv","xv","xvi","xvii","xviii","xix","xx"}
subchapter_page_re = re.compile(r'\b99\s*-\s*([IVXLCDM]+)\s*-\s*\d+\b', re.I)
subchapter_title_re = re.compile(r'\bSUBCHAPTER\s+([IVXLCDM]+)\b', re.I)

def roman_scope_to_int(value):
    vals={'i':1,'v':5,'x':10,'l':50,'c':100,'d':500,'m':1000}
    total=prev=0
    for ch in reversed(str(value).lower()):
        v=vals.get(ch,0)
        if v<prev: total-=v
        else: total+=v; prev=v
    return total or None

def heading_subchapter(heading):
    m = re.match(r'^99(\d{2})\.', str(heading or ''))
    return str(int(m.group(1))) if m else None

def scope_key(base):
    return f"{current_subchapter}|{base}" if current_subchapter else None

def unscoped_key(key):
    return str(key).split('|', 1)[1] if '|' in str(key) else str(key)

def key_scope(key):
    return str(key).split('|', 1)[0] if '|' in str(key) else None

def add_codes(line, keys):
    for code in code_re.findall(line):
        d = re.sub(r'\D', '', code)
        if d.startswith('99') or len(d) not in (6,8,10):
            continue
        for key in keys:
            if key:
                note_membership[d].add(key)
                if len(d) == 10:
                    note_membership[d[:8]].add(key)

def keys_for_state():
    if current_note is None or not current_subchapter:
        return []
    keys = []
    if current_letter:
        keys.append(scope_key(f"{current_note}:{current_letter}"))
        if current_roman:
            keys.append(scope_key(f"{current_note}:{current_letter}:{current_roman}"))
    else:
        keys.append(scope_key(str(current_note)))
    return [key for key in keys if key]

for raw in lines:
    line = raw.rstrip()
    sub_match = subchapter_page_re.search(line) or subchapter_title_re.search(line)
    if sub_match:
        sub_num = roman_scope_to_int(sub_match.group(1))
        if sub_num:
            current_subchapter = str(sub_num)
    if 'U.S. Notes' in line:
        in_notes = True
        continue
    if re.search(r'Heading/\s*Stat\.', line):
        in_notes = False
        current_note = current_letter = current_roman = None
        continue
    m = note_start_re.match(line) if in_notes else None
    if m:
        current_note = int(m.group(1))
        current_letter = m.group(2)
        current_roman = None
    elif in_notes and current_note is not None:
        sm = sub_re.match(line)
        if sm:
            token = sm.group(1)
            if token in roman_tokens and current_letter is not None:
                current_roman = token
            elif len(token) == 1 and token.isalpha():
                current_letter = token
                current_roman = None
    if in_notes and current_note is not None:
        keys = keys_for_state()
        for key in keys:
            subdivision_text[key].append(line.strip())
        add_codes(line, keys)

# A heading can appear many times in Chapter 99: once as the operative tariff
# row and later in notes/cross-references. Preserve every occurrence for legal
# relation parsing, while separately keeping the most tariff-row-like block as
# the heading's display/rate context.
heading_blocks = {}
all_heading_occurrences = defaultdict(list)
current_heading = None
buffer = []

def heading_score(block):
    score = len(block)
    if re.match(r'^99\d{2}\.\d{2}\.\d{2}\s+1/', block): score += 20000
    if re.search(r'\bThe duty\b|\bNo change\b|\bFree\b|\+\s*\d+(?:\.\d+)?%', block, re.I): score += 12000
    if re.search(r'as provided for in subdivisions?|as provided for in U\.S\. note', block, re.I): score += 6000
    if re.search(r'\badditional duties?\b|\brate of duty\b', block, re.I): score += 2000
    return score

def store_heading(heading, parts):
    if not heading:
        return
    block = ' '.join(parts).strip()
    if not block:
        return
    all_heading_occurrences[heading].append(block)
    old = heading_blocks.get(heading, '')
    if heading_score(block) > heading_score(old):
        heading_blocks[heading] = block

for raw in lines:
    m = heading_re.match(raw)
    if m:
        store_heading(current_heading, buffer)
        current_heading = m.group(1)
        buffer = [raw.strip()]
    elif current_heading:
        if re.search(r'Harmonized Tariff Schedule|Heading/ Stat\.|Subheading Suf-|Article Description', raw):
            continue
        if len(buffer) < 26:
            buffer.append(raw.strip())
        elif raw.strip() == '':
            store_heading(current_heading, buffer)
            current_heading = None
            buffer = []
store_heading(current_heading, buffer)

relations = defaultdict(set)
relation_context = defaultdict(list)

def add_relation(heading, key, context):
    if heading not in heading_blocks or not key:
        return
    hscope = heading_subchapter(heading)
    if not hscope or key_scope(key) != hscope:
        return
    relations[heading].add(key)
    normalized = re.sub(r'\s+', ' ', context).strip()
    if normalized and normalized not in relation_context[heading] and len(relation_context[heading]) < 8:
        relation_context[heading].append(normalized[:3000])

# Legal-note statements can directly declare that a heading applies to a
# subdivision. These are stronger than adjacency or chapter-level inference.
for key, parts in subdivision_text.items():
    block = ' '.join(p for p in parts if p).strip()
    if not block:
        continue
    for hm in re.finditer(r'\bHeading\s+(9903\.\d{2}\.\d{2})\s+applies\s+to\b', block, re.I):
        add_relation(hm.group(1), key, block)
    for pm in re.finditer(r'(?:rates? of duty|rates?)\s+set\s+forth\s+in\s+headings?\s+(.{0,520}?)\s+apply\s+to\b', block, re.I):
        for h in re.findall(r'9903\.\d{2}\.\d{2}', pm.group(1)):
            add_relation(h, key, block)

def roman_to_int(s):
    vals={'i':1,'v':5,'x':10,'l':50,'c':100,'d':500,'m':1000}
    total=prev=0
    for ch in reversed(s.lower()):
        v=vals.get(ch,0)
        if v<prev: total-=v
        else: total+=v; prev=v
    return total

def int_to_roman(n):
    pairs=[(20,'xx'),(19,'xix'),(18,'xviii'),(17,'xvii'),(16,'xvi'),(15,'xv'),(14,'xiv'),(13,'xiii'),(12,'xii'),(11,'xi'),(10,'x'),(9,'ix'),(8,'viii'),(7,'vii'),(6,'vi'),(5,'v'),(4,'iv'),(3,'iii'),(2,'ii'),(1,'i')]
    for v,r in pairs:
        if n==v:return r
    return None

def subdivision_keys(fragment, note, scope):
    fragment = fragment.replace('–','-').replace('—','-')
    parent_match = re.search(r'\(([a-z])\)', fragment, re.I)
    base = parent_match.group(1).lower() if parent_match else None
    remainder = fragment[parent_match.end():] if parent_match else fragment
    romans = re.findall(r'\(([ivxlcdm]+)\)', remainder, re.I)
    expanded=[]
    for a,b in re.findall(r'\(([ivxlcdm]+)\)\s*-\s*\(([ivxlcdm]+)\)', remainder, re.I):
        ai,bi=roman_to_int(a),roman_to_int(b)
        if ai and bi and 0 < bi-ai <= 20:
            for n in range(ai,bi+1):
                r=int_to_roman(n)
                if r and r not in expanded: expanded.append(r)
    for r in romans:
        r=r.lower()
        if r not in expanded: expanded.append(r)
    keys=[]
    if base and expanded:
        keys.extend(f"{scope}|{note}:{base}:{r}" for r in expanded)
    elif base:
        keys.append(f"{scope}|{note}:{base}")
    for letter in re.findall(r'\(([a-z])\)', remainder, re.I):
        letter = letter.lower()
        if letter not in roman_tokens:
            key = f"{scope}|{note}:{letter}"
            if key not in keys:
                keys.append(key)
    return keys

def parse_heading_relations(heading, block):
    normalized = re.sub(r'\s+', ' ', block)
    scope = heading_subchapter(heading)
    if not scope:
        return
    for rm in re.finditer(r'subdivisions?\s+(.{1,700}?)\s+of\s+(?:U\.\s*S\.\s*)?note\s+(\d+)', normalized, re.I):
        for key in subdivision_keys(rm.group(1), int(rm.group(2)), scope):
            add_relation(heading, key, normalized)
    for rm in re.finditer(r'(?:U\.\s*S\.\s*)?note\s+(\d+)\s*\(([a-z])\)(?:\(([ivxlcdm]+)\))?', normalized, re.I):
        note, letter, roman = int(rm.group(1)), rm.group(2).lower(), rm.group(3)
        base = f"{note}:{letter}" + (f":{roman.lower()}" if roman else '')
        add_relation(heading, f"{scope}|{base}", normalized)

# Parse note/subdivision references from EVERY occurrence of a heading, not
# only the selected display block.
for heading, occurrences in all_heading_occurrences.items():
    for block in occurrences:
        parse_heading_relations(heading, block)

# Independent tariff-row sweep. pdftotext occasionally introduces page/table
# boundaries that make the stateful line-block pass lose an otherwise valid
# operative row. Scan the raw converted text again, from each printed Chapter
# 99 heading to the next one, and parse its legal note references separately.
# This is intentionally redundant: a legal index should fail closed, not lose
# a 25% provision because one PDF line break happened to be inconvenient.
row_re = re.compile(
    r'(?ms)^\s*(99\d{2}\.\d{2}\.\d{2})\s+1/\s*(.*?)(?=^\s*99\d{2}\.\d{2}\.\d{2}\s+1/|\Z)'
)
for rm in row_re.finditer(text):
    heading = rm.group(1)
    if heading not in heading_blocks:
        continue
    block = f"{heading} 1/ {rm.group(2)}"
    parse_heading_relations(heading, block[:12000])

code_candidates = defaultdict(set)
for code, keys in note_membership.items():
    for heading, target_keys in relations.items():
        if keys.intersection(target_keys):
            code_candidates[code].add(heading)

# Structural safety checks. Bare note numbers such as "38." occur frequently
# in the official Chapter 99 PDF. If a note boundary is missed, an unrelated
# HTS list can be assigned to the prior note and create catastrophic false
# positives. Fail the build instead of publishing such an index.
note38b_codes = sorted(code for code, keys in note_membership.items() if '3|38:b' in keys)
invalid_note38b = [code for code in note38b_codes if not code.startswith('87')]
if invalid_note38b:
    raise RuntimeError(
        'Chapter 99 note 38(b) contains non-vehicle HTS codes; note-boundary parsing is contaminated: '
        + ', '.join(invalid_note38b[:20])
    )
for gypsum_code in ('68091100', '6809110010'):
    bad = sorted(set(code_candidates.get(gypsum_code, set())) & {'9903.74.01', '9903.76.01'})
    if bad:
        raise RuntimeError(
            f'False Chapter 99 mapping for gypsum HTS {gypsum_code}: {bad}'
        )

headings_out = {}
for h, block in heading_blocks.items():
    if h not in relations:
        continue
    scoped_targets = sorted(relations[h])
    targets = sorted(set(unscoped_key(key) for key in scoped_targets))
    legal_context = {}
    for key in scoped_targets:
        if key in subdivision_text:
            legal = ' '.join(p for p in subdivision_text[key] if p).strip()
            if legal:
                legal_context[unscoped_key(key)] = re.sub(r'\s+', ' ', legal).strip()[:5000]
    headings_out[h] = {
        "noteTargets": targets,
        "text": re.sub(r'\s+', ' ', block).strip()[:5000],
        "relationContext": relation_context[h][:3],
        "legalContext": legal_context
    }

payload = {
    "schemaVersion": 2,
    "source": "USITC current Chapter 99 PDF",
    "sourceUrl": "https://hts.usitc.gov/reststop/file?release=currentRelease&filename=Chapter%2099",
    "htsYear": 2026,
    "htsRevision": rev,
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "safetyPolicy": {
        "candidateIsNotApplicability": True,
        "description": "A code-to-heading relation is only a candidate until origin and any rule-specific conditions are resolved. Unresolved candidates must be shown as review-required, not not-applicable."
    },
    "headings": headings_out,
    "codes": {code: sorted(vals) for code, vals in sorted(code_candidates.items()) if vals},
    "stats": {
        "noteSubdivisions": len(subdivision_text),
        "noteMembershipCodes": len(note_membership),
        "operativeHeadings": len(headings_out),
        "codesWithCandidates": sum(1 for v in code_candidates.values() if v)
    }
}

with open(out, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2, sort_keys=True)
    f.write("\n")

print(json.dumps(payload["stats"], indent=2))
print(f"HTS revision: {rev}")
for test in ("87032301","73211110"):
    print(test, payload["codes"].get(test, []), "membership", sorted(note_membership.get(test, [])))
print("9903.88.01 targets", sorted(unscoped_key(k) for k in relations.get("9903.88.01", [])))
print("9903.82.09 targets", sorted(unscoped_key(k) for k in relations.get("9903.82.09", [])))
print("9903.82.15 targets", sorted(unscoped_key(k) for k in relations.get("9903.82.15", [])))
print("9903.82.16 targets", sorted(unscoped_key(k) for k in relations.get("9903.82.16", [])))
