from pathlib import Path

p = Path('scripts/build-chapter99-index.py')
s = p.read_text()

# 1. Track Chapter 99 subchapter while reading legal notes.
s = s.replace(
"""current_roman = None
in_notes = False

code_re = re.compile""",
"""current_roman = None
current_subchapter = None
in_notes = False

code_re = re.compile""",
1)

s = s.replace(
"""roman_tokens = {\"i\",\"ii\",\"iii\",\"iv\",\"v\",\"vi\",\"vii\",\"viii\",\"ix\",\"x\",\"xi\",\"xii\",\"xiii\",\"xiv\",\"xv\",\"xvi\",\"xvii\",\"xviii\",\"xix\",\"xx\"}

def add_codes""",
"""roman_tokens = {\"i\",\"ii\",\"iii\",\"iv\",\"v\",\"vi\",\"vii\",\"viii\",\"ix\",\"x\",\"xi\",\"xii\",\"xiii\",\"xiv\",\"xv\",\"xvi\",\"xvii\",\"xviii\",\"xix\",\"xx\"}
subchapter_page_re = re.compile(r'\\b99\\s*-\\s*([IVXLCDM]+)\\s*-\\s*\\d+\\b', re.I)
subchapter_title_re = re.compile(r'\\bSUBCHAPTER\\s+([IVXLCDM]+)\\b', re.I)

def roman_scope_to_int(value):
    vals={'i':1,'v':5,'x':10,'l':50,'c':100,'d':500,'m':1000}
    total=prev=0
    for ch in reversed(str(value).lower()):
        v=vals.get(ch,0)
        if v<prev: total-=v
        else: total+=v; prev=v
    return total or None

def heading_subchapter(heading):
    m = re.match(r'^99(\\d{2})\\.', str(heading or ''))
    return str(int(m.group(1))) if m else None

def scope_key(base):
    return f\"{current_subchapter}|{base}\" if current_subchapter else None

def unscoped_key(key):
    return str(key).split('|', 1)[1] if '|' in str(key) else str(key)

def key_scope(key):
    return str(key).split('|', 1)[0] if '|' in str(key) else None

def add_codes""",
1)

old_keys = """def keys_for_state():
    if current_note is None:
        return []
    keys = []
    if current_letter:
        keys.append(f\"{current_note}:{current_letter}\")
        if current_roman:
            keys.append(f\"{current_note}:{current_letter}:{current_roman}\")
    else:
        keys.append(str(current_note))
    return keys
"""
new_keys = """def keys_for_state():
    if current_note is None or not current_subchapter:
        return []
    keys = []
    if current_letter:
        keys.append(scope_key(f\"{current_note}:{current_letter}\"))
        if current_roman:
            keys.append(scope_key(f\"{current_note}:{current_letter}:{current_roman}\"))
    else:
        keys.append(scope_key(str(current_note)))
    return [key for key in keys if key]
"""
if old_keys not in s: raise SystemExit('keys_for_state marker missing')
s = s.replace(old_keys, new_keys, 1)

s = s.replace(
"""for raw in lines:
    line = raw.rstrip()
    if 'U.S. Notes' in line:""",
"""for raw in lines:
    line = raw.rstrip()
    sub_match = subchapter_page_re.search(line) or subchapter_title_re.search(line)
    if sub_match:
        sub_num = roman_scope_to_int(sub_match.group(1))
        if sub_num:
            current_subchapter = str(sub_num)
    if 'U.S. Notes' in line:""",
1)

# 2. Never connect a heading to a legal note from a different subchapter.
old_add_relation = """def add_relation(heading, key, context):
    if heading in heading_blocks and key:
        relations[heading].add(key)
        normalized = re.sub(r'\\s+', ' ', context).strip()
        if normalized and normalized not in relation_context[heading] and len(relation_context[heading]) < 8:
            relation_context[heading].append(normalized[:3000])
"""
new_add_relation = """def add_relation(heading, key, context):
    if heading not in heading_blocks or not key:
        return
    hscope = heading_subchapter(heading)
    if not hscope or key_scope(key) != hscope:
        return
    relations[heading].add(key)
    normalized = re.sub(r'\\s+', ' ', context).strip()
    if normalized and normalized not in relation_context[heading] and len(relation_context[heading]) < 8:
        relation_context[heading].append(normalized[:3000])
"""
if old_add_relation not in s: raise SystemExit('add_relation marker missing')
s = s.replace(old_add_relation, new_add_relation, 1)

# 3. Scope tariff-row subdivision references to the heading's own subchapter.
old_subdivision = """def subdivision_keys(fragment, note):
    fragment = fragment.replace('–','-').replace('—','-')
"""
new_subdivision = """def subdivision_keys(fragment, note, scope):
    fragment = fragment.replace('–','-').replace('—','-')
"""
if old_subdivision not in s: raise SystemExit('subdivision_keys marker missing')
s = s.replace(old_subdivision, new_subdivision, 1)

s = s.replace(
"""    if base and expanded:
        keys.extend(f\"{note}:{base}:{r}\" for r in expanded)
    elif base:
        keys.append(f\"{note}:{base}\")
""",
"""    if base and expanded:
        keys.extend(f\"{scope}|{note}:{base}:{r}\" for r in expanded)
    elif base:
        keys.append(f\"{scope}|{note}:{base}\")
""",
1)
s = s.replace(
"""            key = f\"{note}:{letter}\"
            if key not in keys:
                keys.append(key)
""",
"""            key = f\"{scope}|{note}:{letter}\"
            if key not in keys:
                keys.append(key)
""",
1)

old_parse = """def parse_heading_relations(heading, block):
    normalized = re.sub(r'\\s+', ' ', block)
    for rm in re.finditer(r'subdivisions?\\s+(.{1,700}?)\\s+of\\s+(?:U\\.\\s*S\\.\\s*)?note\\s+(\\d+)', normalized, re.I):
        for key in subdivision_keys(rm.group(1), int(rm.group(2))):
            add_relation(heading, key, normalized)
    for rm in re.finditer(r'(?:U\\.\\s*S\\.\\s*)?note\\s+(\\d+)\\s*\\(([a-z])\\)(?:\\(([ivxlcdm]+)\\))?', normalized, re.I):
        note, letter, roman = int(rm.group(1)), rm.group(2).lower(), rm.group(3)
        key = f\"{note}:{letter}\" + (f\":{roman.lower()}\" if roman else '')
        add_relation(heading, key, normalized)
"""
new_parse = """def parse_heading_relations(heading, block):
    normalized = re.sub(r'\\s+', ' ', block)
    scope = heading_subchapter(heading)
    if not scope:
        return
    for rm in re.finditer(r'subdivisions?\\s+(.{1,700}?)\\s+of\\s+(?:U\\.\\s*S\\.\\s*)?note\\s+(\\d+)', normalized, re.I):
        for key in subdivision_keys(rm.group(1), int(rm.group(2)), scope):
            add_relation(heading, key, normalized)
    for rm in re.finditer(r'(?:U\\.\\s*S\\.\\s*)?note\\s+(\\d+)\\s*\\(([a-z])\\)(?:\\(([ivxlcdm]+)\\))?', normalized, re.I):
        note, letter, roman = int(rm.group(1)), rm.group(2).lower(), rm.group(3)
        base = f\"{note}:{letter}\" + (f\":{roman.lower()}\" if roman else '')
        add_relation(heading, f\"{scope}|{base}\", normalized)
"""
if old_parse not in s: raise SystemExit('parse_heading_relations marker missing')
s = s.replace(old_parse, new_parse, 1)

# 4. Scope the structural checks to Subchapter III.
s = s.replace(
"""note38b_codes = sorted(code for code, keys in note_membership.items() if '38:b' in keys)""",
"""note38b_codes = sorted(code for code, keys in note_membership.items() if '3|38:b' in keys)""",
1)

# 5. Expose the old runtime noteTarget shape, but only after internal scoped matching.
old_targets = """    targets = sorted(relations[h])
    legal_context = {}
    for key in targets:
        if key in subdivision_text:
            legal = ' '.join(p for p in subdivision_text[key] if p).strip()
            if legal:
                legal_context[key] = re.sub(r'\\s+', ' ', legal).strip()[:5000]
    headings_out[h] = {
        \"noteTargets\": targets,
"""
new_targets = """    scoped_targets = sorted(relations[h])
    targets = sorted(set(unscoped_key(key) for key in scoped_targets))
    legal_context = {}
    for key in scoped_targets:
        if key in subdivision_text:
            legal = ' '.join(p for p in subdivision_text[key] if p).strip()
            if legal:
                legal_context[unscoped_key(key)] = re.sub(r'\\s+', ' ', legal).strip()[:5000]
    headings_out[h] = {
        \"noteTargets\": targets,
"""
if old_targets not in s: raise SystemExit('headings_out marker missing')
s = s.replace(old_targets, new_targets, 1)

# 6. Print readable, unscoped diagnostics.
s = s.replace(
"""print(\"9903.88.01 targets\", sorted(relations.get(\"9903.88.01\", [])))
print(\"9903.82.09 targets\", sorted(relations.get(\"9903.82.09\", [])))
print(\"9903.82.15 targets\", sorted(relations.get(\"9903.82.15\", [])))
print(\"9903.82.16 targets\", sorted(relations.get(\"9903.82.16\", [])))
""",
"""print(\"9903.88.01 targets\", sorted(unscoped_key(k) for k in relations.get(\"9903.88.01\", [])))
print(\"9903.82.09 targets\", sorted(unscoped_key(k) for k in relations.get(\"9903.82.09\", [])))
print(\"9903.82.15 targets\", sorted(unscoped_key(k) for k in relations.get(\"9903.82.15\", [])))
print(\"9903.82.16 targets\", sorted(unscoped_key(k) for k in relations.get(\"9903.82.16\", [])))
""",
1)

p.write_text(s)
print('Chapter 99 subchapter scoping patch applied.')
