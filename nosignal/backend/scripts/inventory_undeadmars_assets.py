from collections import Counter, defaultdict
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / 'nosignal/frontend/src/assets/sprites/UndeadMars'

pngs = sorted(ASSET_ROOT.rglob('*.png'))
print(f'ROOT={ASSET_ROOT}')
print(f'PNG_COUNT={len(pngs)}')

by_dir = Counter()
by_size = Counter()
by_alpha = Counter()
category = defaultdict(list)

for p in pngs:
    rel = p.relative_to(ASSET_ROOT)
    try:
        im = Image.open(p).convert('RGBA')
        alpha = im.getchannel('A')
        vals = list(alpha.getdata())
        nonzero = sum(v > 0 for v in vals)
        opaque = sum(v == 255 for v in vals)
        partial = sum(0 < v < 255 for v in vals)
        bbox = alpha.getbbox()
        size = f'{im.width}x{im.height}'
        if partial:
            alpha_kind = 'PARTIAL_ALPHA'
        elif nonzero == 0:
            alpha_kind = 'EMPTY'
        elif opaque == len(vals):
            alpha_kind = 'OPAQUE'
        else:
            alpha_kind = 'BINARY_ALPHA'
        by_dir[str(rel.parent)] += 1
        by_size[(size, alpha_kind)] += 1
        by_alpha[alpha_kind] += 1
        name = p.stem.lower()
        if 'lich' in name:
            cat = 'LICH'
        elif 'bone' in name or 'scull' in name or 'skeleton' in name:
            cat = 'BONES/SKULLS'
        elif 'plant' in name or 'thorn' in name:
            cat = 'PLANTS/THORNS'
        elif 'tree' in name:
            cat = 'TREES'
        elif 'rock' in name or 'ruin' in name or 'grave' in name or 'door' in name or 'crystal' in name:
            cat = 'ROCKS/STRUCTURES'
        elif 'ground' in name or 'land' in name or 'water' in name:
            cat = 'TERRAIN/WATER'
        else:
            cat = 'OTHER'
        category[cat].append((str(rel), size, alpha_kind, nonzero / len(vals), bbox))
        print(f'{rel}\t{size}\t{alpha_kind}\tcoverage={nonzero/len(vals):.3f}\tbbox={bbox}')
    except Exception as e:
        print(f'ERROR\t{rel}\t{e}')

print('\n=== COUNTS BY DIRECTORY ===')
for k, v in sorted(by_dir.items()): print(f'{v:4} {k}')
print('\n=== COUNTS BY SIZE/ALPHA ===')
for (size, ak), v in sorted(by_size.items()): print(f'{v:4} {size:>12} {ak}')
print('\n=== COUNTS BY ALPHA ===')
for k, v in sorted(by_alpha.items()): print(f'{v:4} {k}')
print('\n=== SEMANTIC CATEGORIES ===')
for k, items in sorted(category.items()):
    print(f'{k}: {len(items)}')
    for rel, size, ak, cov, bbox in items:
        print(f'  {rel} | {size} | {ak} | coverage={cov:.3f}')
