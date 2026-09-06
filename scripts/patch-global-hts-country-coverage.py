from pathlib import Path

# ----- Chapter 99 builder: validate every generated mapping -----
p = Path('scripts/build-chapter99-index.py')
s = p.read_text()
old = '''# Structural safety checks. Bare note numbers such as "38." occur frequently
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
'''
new = '''# Index-wide structural safety checks. These validate EVERY HTS-to-Chapter-99
# mapping produced by the parser. A relation is publishable only when the HTS
# membership and operative heading share the same scoped legal-note key and
# that key belongs to the heading's Chapter 99 subchapter.
for code, keys in note_membership.items():
    unscoped = sorted(key for key in keys if not key_scope(key))
    if unscoped:
        raise RuntimeError(f'Unscoped Chapter 99 note membership for HTS {code}: {unscoped[:10]}')

for heading, keys in relations.items():
    expected_scope = heading_subchapter(heading)
    if not expected_scope:
        raise RuntimeError(f'Unable to determine Chapter 99 subchapter for heading {heading}')
    wrong_scope = sorted(key for key in keys if key_scope(key) != expected_scope)
    if wrong_scope:
        raise RuntimeError(
            f'Cross-subchapter Chapter 99 relation for {heading}: expected scope {expected_scope}, got {wrong_scope[:10]}'
        )

validated_candidate_links = 0
for code, headings in code_candidates.items():
    membership = note_membership.get(code, set())
    for heading in headings:
        target_keys = relations.get(heading, set())
        shared = membership.intersection(target_keys)
        if not shared:
            raise RuntimeError(f'Unjustified Chapter 99 candidate mapping: HTS {code} -> {heading}')
        expected_scope = heading_subchapter(heading)
        invalid_shared = sorted(key for key in shared if key_scope(key) != expected_scope)
        if invalid_shared:
            raise RuntimeError(
                f'Cross-subchapter candidate mapping: HTS {code} -> {heading} through {invalid_shared[:10]}'
            )
        validated_candidate_links += 1

# Keep a few domain-specific sanity checks in addition to the universal checks.
# They are regression tripwires, not the matching algorithm.
note38b_codes = sorted(code for code, keys in note_membership.items() if '3|38:b' in keys)
invalid_note38b = [code for code in note38b_codes if not code.startswith('87')]
if invalid_note38b:
    raise RuntimeError(
        'Chapter 99 note 38(b) contains non-vehicle HTS codes; note-boundary parsing is contaminated: '
        + ', '.join(invalid_note38b[:20])
    )
'''
if old not in s:
    raise SystemExit('builder safety block marker not found')
s = s.replace(old, new, 1)
s = s.replace('''        "codesWithCandidates": sum(1 for v in code_candidates.values() if v)\n''', '''        "codesWithCandidates": sum(1 for v in code_candidates.values() if v),\n        "validatedCandidateLinks": validated_candidate_links\n''', 1)
p.write_text(s)

# ----- Runtime: recognize every ISO country, not a hand-picked subset -----
p = Path('netlify/functions/trade-rules.mts')
s = p.read_text()
old = '''const COUNTRY_ALIASES:Record<string,string[]>={CN:["china","people's republic of china","peoples republic of china","prc"],RU:["russia","russian federation"],GB:["united kingdom","great britain","uk"],US:["united states","united states of america","usa","u.s."],CA:["canada"],MX:["mexico"],BR:["brazil"],IN:["india"],JP:["japan"],KR:["south korea","republic of korea","korea"],TW:["taiwan"],VN:["vietnam","viet nam"],AR:["argentina"],AU:["australia"],TR:["turkey","türkiye","turkiye"],NL:["netherlands","the netherlands"]};
const EU_COUNTRIES=new Set(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"]);
function aliasesForCountry(country:string){const a=new Set<string>((COUNTRY_ALIASES[country]||[]).map(s=>s.toLowerCase()));try{const dn=new Intl.DisplayNames(["en"],{type:"region"});const n=dn.of(country);if(n)a.add(n.toLowerCase());}catch{}return[...a];}
'''
new = '''const ISO_COUNTRY_CODES=`AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(/\\s+/);
const ISO_COUNTRIES=new Set(ISO_COUNTRY_CODES);
const COUNTRY_ALIASES:Record<string,string[]>={CN:["china","people's republic of china","peoples republic of china","prc"],RU:["russia","russian federation"],GB:["united kingdom","great britain","uk"],US:["united states","united states of america","usa","u.s."],KR:["south korea","republic of korea","korea"],KP:["north korea","democratic people's republic of korea","dprk"],TW:["taiwan"],VN:["vietnam","viet nam"],TR:["turkey","türkiye","turkiye"],CZ:["czech republic","czechia"],CI:["cote d'ivoire","côte d’ivoire","ivory coast"],CV:["cape verde","cabo verde"],SZ:["eswatini","swaziland"],MK:["north macedonia","macedonia"],MM:["myanmar","burma"],BO:["bolivia","bolivia plurinational state of"],VE:["venezuela","venezuela bolivarian republic of"],TZ:["tanzania","united republic of tanzania"],MD:["moldova","republic of moldova"],BN:["brunei","brunei darussalam"],LA:["laos","lao people's democratic republic"],IR:["iran","islamic republic of iran"],SY:["syria","syrian arab republic"],PS:["palestine","state of palestine"],VA:["vatican city","holy see"]};
const EU_COUNTRIES=new Set(["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"]);
function aliasesForCountry(country:string){const a=new Set<string>((COUNTRY_ALIASES[country]||[]).map(s=>s.toLowerCase()));try{const dn=new Intl.DisplayNames(["en"],{type:"region"});const n=dn.of(country);if(n)a.add(n.toLowerCase());}catch{}return[...a];}
'''
if old not in s:
    raise SystemExit('country alias block marker not found')
s = s.replace(old, new, 1)

old = '''const normalizedRow=` ${normalizeName(row)} `,explicitCodes=new Set<string>();for(const [code,names] of Object.entries(COUNTRY_ALIASES)){for(const name of names){const n=normalizeName(name);if(!n)continue;if(normalizedRow.includes(` product of ${n} `)||normalizedRow.includes(` products of ${n} `)||normalizedRow.includes(` from ${n} `)){explicitCodes.add(code);break;}}}'''
new = '''const normalizedRow=` ${normalizeName(row)} `,explicitCodes=new Set<string>();for(const code of ISO_COUNTRY_CODES){for(const name of aliasesForCountry(code)){const n=normalizeName(name);if(!n)continue;if(normalizedRow.includes(` product of ${n} `)||normalizedRow.includes(` products of ${n} `)||normalizedRow.includes(` from ${n} `)){explicitCodes.add(code);break;}}}'''
if old not in s:
    raise SystemExit('explicit country matching marker not found')
s = s.replace(old, new, 1)

old = '''if(!/^[A-Z]{2}$/.test(country))return Response.json({error:"Enter a 2-letter country code."},{status:400});'''
new = '''if(!/^[A-Z]{2}$/.test(country)||!ISO_COUNTRIES.has(country))return Response.json({error:"Enter a valid 2-letter ISO country code."},{status:400});'''
if old not in s:
    raise SystemExit('country validation marker not found')
s = s.replace(old, new, 1)
p.write_text(s)

print('Applied index-wide HTS validation and full ISO country coverage.')
