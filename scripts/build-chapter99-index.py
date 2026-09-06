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

# Capture current U.S.-note subdivision membership. This is intentionally
# mechanical: an HTS code is indexed only where it actually appears in the
# current Chapter 99 legal-note text. We do not infer coverage from chapter.
note_membership = defaultdict(set)
subdivision_text = defaultdict(list)
current_note = None
current_letter = None
current_roman = None
in_notes = False

code_re = re.compile(r'\b(\d{4}(?:\.\d{2}){1,3})\b')
heading_re = re.compile(r'^\s*(99\d{2}\.\d{2}\.\d{2})\b')
note_start_re = re.compile(r'^\s*(\d{1,3})\.\s*(?:\(([a-z])\))?\s+')
sub_re = re.compile(r'^\s*\(([a-z]|[ivxlcdm]+)\)\s+')

roman_tokens = {"i","ii","iii","iv","v","vi","vii","viii","ix","x","xi","xii","xiii","xiv","xv","xvi","xvii","xviii","xix","xx"}

def add_codes(line, keys):
    for code in code_re.findall(line):
        d = re.sub(r'\D', '', code)
        if d.startswith('99') or len(d) not in (6,8,10):
            continue
        for key in keys:
            if key:
                note_membership[d].add(key)
                # An 8-digit legal subheading also governs its statistical suffixes.
                if len(d) == 10:
                    note_membership[d[:8]].add(key)

def keys_for_state():
    if current_note is None:
        return []
    keys = []
    if current_letter:
        keys.append(f"{current_note}:{current_letter}")
        if current_roman:
            keys.append(f"{current_note}:{current_letter}:{current_roman}")
    else:
        keys.append(str(current_note))
    return keys

for raw in lines:
    line = raw.rstrip()
    if 'U.S. Notes' in line:
        in_notes = True
        continue
    # Actual tariff heading tables are not legal-note membership lists.
    if heading_re.match(line):
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

# Tariff heading blocks (9903.xx.xx etc.) give the operative description and
# rate. Preserve the text; the runtime resolver uses it to validate origin and
# conditions rather than assuming a prefix always means a particular program.
heading_blocks = {}
current_heading = None
buffer = []
for raw in lines:
    m = heading_re.match(raw)
    if m:
        if current_heading:
            heading_blocks[current_heading] = ' '.join(buffer).strip()
        current_heading = m.group(1)
        buffer = [raw.strip()]
    elif current_heading:
        if re.search(r'Harmonized Tariff Schedule|Heading/ Stat\.|Subheading Suf-|Article Description', raw):
            continue
        if len(buffer) < 18:
            buffer.append(raw.strip())
        elif raw.strip() == '':
            heading_blocks[current_heading] = ' '.join(buffer).strip()
            current_heading = None
            buffer = []
if current_heading:
    heading_blocks[current_heading] = ' '.join(buffer).strip()

# Extract explicit relations between operative Chapter 99 headings and legal
# note subdivisions. A relation is high-confidence only when the legal text
# itself says that a heading/rate applies to the subdivision containing the HTS.
relations = defaultdict(set)
relation_context = defaultdict(list)

def add_relation(heading, key, context):
    if heading in heading_blocks and key:
        relations[heading].add(key)
        if len(relation_context[heading]) < 8:
            relation_context[heading].append(context[:1600])

for key, parts in subdivision_text.items():
    block = ' '.join(p for p in parts if p).strip()
    if not block:
        continue
    # Strongest form: "Heading 9903.xx.xx applies to ..." inside this subdivision.
    for hm in re.finditer(r'\bHeading\s+(9903\.\d{2}\.\d{2})\s+applies\s+to\b', block, re.I):
        add_relation(hm.group(1), key, block)
    # Plural form used by some notes: "rates ... set forth in headings X, Y ... apply..."
    for pm in re.finditer(r'(?:rates? of duty|rates?)\s+set\s+forth\s+in\s+headings?\s+(.{0,260}?)\s+apply\s+to\b', block, re.I):
        for h in re.findall(r'9903\.\d{2}\.\d{2}', pm.group(1)):
            add_relation(h, key, block)

# Heading descriptions often explicitly identify the applicable U.S.-note
# subdivisions (common in Section 232). Parse those references too.
def roman_to_int(s):
    vals={'i':1,'v':5,'x':10,'l':50,'c':100,'d':500,'m':1000}
    total=prev=0
    for ch in reversed(s.lower()):
        v=vals.get(ch,0)
        if v<prev: total-=v
        else: total+=v; prev=v
    return total

def int_to_roman(n):
    pairs=[(10,'x'),(9,'ix'),(8,'viii'),(7,'vii'),(6,'vi'),(5,'v'),(4,'iv'),(3,'iii'),(2,'ii'),(1,'i')]
    for v,r in pairs:
        if n==v:return r
    return None

def subdivision_keys(fragment, note):
    fragment = fragment.replace('–','-').replace('—','-')
    letters = re.findall(r'\(([a-z])\)', fragment)
    base = letters[0] if letters else None
    romans = re.findall(r'\(([ivxlcdm]+)\)', fragment, re.I)
    expanded=[]
    # Expand simple Roman ranges such as (vii)-(viii).
    for a,b in re.findall(r'\(([ivxlcdm]+)\)\s*-\s*\(([ivxlcdm]+)\)', fragment, re.I):
        ai,bi=roman_to_int(a),roman_to_int(b)
        if ai and bi and 0 < bi-ai <= 10:
            for n in range(ai,bi+1):
                r=int_to_roman(n)
                if r and r not in expanded: expanded.append(r)
    for r in romans:
        r=r.lower()
        if r not in expanded: expanded.append(r)
    keys=[]
    if base and expanded:
        keys.extend(f"{note}:{base}:{r}" for r in expanded)
    elif base:
        keys.append(f"{note}:{base}")
    return keys

for heading, block in heading_blocks.items():
    for rm in re.finditer(r'subdivisions?\s+(.{1,180}?)\s+of\s+U\.S\.\s+note\s+(\d+)', block, re.I):
        for key in subdivision_keys(rm.group(1), int(rm.group(2))):
            add_relation(heading, key, block)
    # Simpler "U.S. note 20(b)" form.
    for rm in re.finditer(r'U\.S\.\s+note\s+(\d+)\s*\(([a-z])\)(?:\(([ivxlcdm]+)\))?', block, re.I):
        note, letter, roman = int(rm.group(1)), rm.group(2).lower(), rm.group(3)
        key = f"{note}:{letter}" + (f":{roman.lower()}" if roman else '')
        add_relation(heading, key, block)

# Build code -> candidate operative headings. Candidates are not automatically
# treated as applicable; runtime origin/condition validation still has to pass.
code_candidates = defaultdict(set)
for code, keys in note_membership.items():
    for heading, target_keys in relations.items():
        if keys.intersection(target_keys):
            code_candidates[code].add(heading)

# Keep source context compact enough for deployment but sufficient for audits.
headings_out = {}
for h, block in heading_blocks.items():
    if h not in relations:
        continue
    headings_out[h] = {
        "noteTargets": sorted(relations[h]),
        "text": re.sub(r'\s+', ' ', block).strip()[:2200],
        "relationContext": [re.sub(r'\s+',' ',x).strip() for x in relation_context[h][:3]]
    }

payload = {
    "schemaVersion": 1,
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
    print(test, payload["codes"].get(test, []))
