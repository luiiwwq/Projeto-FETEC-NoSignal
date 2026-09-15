from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
IMG = ROOT / 'frontend/src/assets/sprites/UndeadMars/undead-tileset-mars-palette/undead_tileset_mars/PNG/Ground_rocks.png'
im = Image.open(IMG).convert('RGBA')

pools = {
    'FLOOR_LIGHT': [(80,0),(128,0),(192,0),(256,0),(96,0),(160,0),(224,0),(288,0),(384,0),(128,80),(192,80),(384,80)],
    'FLOOR_SHADE': [(336,16),(352,16),(368,16),(400,16),(416,16),(16,48),(224,48),(288,48)],
    'FLOOR_DARK': [(80,16),(128,16),(208,16),(256,16)],
    'ROCK': [(0,240),(48,240),(64,240),(96,240),(144,240),(176,240),(224,240),(272,240),(32,256),(112,256),(208,256),(0,400),(96,400),(288,400),(384,400),(48,432)],
    'ROCK_EDGE': [(80,80),(112,80),(144,80),(240,80),(352,80),(416,80)],
    'DETAIL': [(80,32),(128,32),(176,32),(192,32),(208,32),(256,32)],
}


def orientation(coords):
    """Classifica um crop 16x16: 'FILL' (opaco completo) ou 'OVERLAY' com a
    banda que ocupa (contiguous row/col runs of opaque pixels)."""
    alpha = coords
    # per-row / per-col opaque fraction
    rowfrac = [sum(alpha.getpixel((cx, cy)) > 0 for cx in range(16)) / 16 for cy in range(16)]
    colfrac = [sum(alpha.getpixel((cx, cy)) > 0 for cy in range(16)) / 16 for cx in range(16)]
    opaque_rows = [cy for cy, f in enumerate(rowfrac) if f > 0.0]
    opaque_cols = [cx for cx, f in enumerate(colfrac) if f > 0.0]
    if not opaque_rows:
        return 'EMPTY'
    full_rows = sum(f >= 0.99 for f in rowfrac)
    full_cols = sum(f >= 0.99 for f in colfrac)

    def bands(idx, span=16):
        runs = []
        start = None
        for i in idx:
            if start is None:
                start = i
            elif i > start + 1:
                runs.append((start, i - 1))
                start = i
        if start is not None:
            last = idx[-1] if idx else start
            runs.append((start, last))
        return runs

    if full_rows >= 15 and full_cols >= 15:
        return 'FILL'
    r_bands = bands(opaque_rows)
    c_bands = bands(opaque_cols)
    top = rowfrac[0] > 0 or rowfrac[1] > 0
    bottom = rowfrac[14] > 0 or rowfrac[15] > 0
    left = colfrac[0] > 0 or colfrac[1] > 0
    right = colfrac[14] > 0 or colfrac[15] > 0
    sides = ''.join(t for t, on in (('T', top), ('B', bottom), ('L', left), ('R', right)) if on)
    return f"OVERLAY bands=[{','.join(str(r) for r in r_bands)}]x[{','.join(str(c) for c in c_bands)}] sides={sides}"


def lum_stats(crop):
    """Media de luminancia (0-255) e desvio padrao dos pixels opacos."""
    px = crop.load()
    vals = []
    for y in range(16):
        for x in range(16):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            vals.append(0.299 * r + 0.587 * g + 0.114 * b)
    if not vals:
        return None
    mean = sum(vals) / len(vals)
    var = sum((v - mean) ** 2 for v in vals) / len(vals)
    return mean, var ** 0.5


print(f'image={IMG} size={im.size} mode={im.mode}')
for name, coords in pools.items():
    print(f'\n[{name}]')
    fill_list = []
    overlay_list = []
    for x, y in coords:
        crop = im.crop((x, y, x + 16, y + 16))
        alpha = crop.getchannel('A')
        vals = list(alpha.getdata())
        opaque = sum(v == 255 for v in vals)
        transparent = sum(v == 0 for v in vals)
        partial = 256 - opaque - transparent
        bbox = alpha.getbbox()
        kind = orientation(alpha)
        (fill_list if kind == 'FILL' else overlay_list).append((x, y))
        ln = lum_stats(crop)
        lstr = f'L={ln[0]:5.1f} sd={ln[1]:4.1f}' if ln else 'L=---'
        print(f'{x:3},{y:3} {kind:40s} opaque={opaque:3}/256 partial={partial:3} transparent={transparent:3} {lstr} bbox={bbox}')
    print(f'   -> FILL (base opaca): {[list(t) for t in fill_list]}')
    print(f'   -> OVERLAY (sobre base): {[list(t) for t in overlay_list]}')

# Resumo: quais usam como preenchimento principal são totalmente opacos?
print('\n[SUMMARY - FILL vs OVERLAY]')
for name, coords in pools.items():
    fills = []
    overlays = []
    for x, y in coords:
        alpha = im.crop((x, y, x + 16, y + 16)).getchannel('A')
        if orientation(alpha) == 'FILL':
            fills.append((x, y))
        else:
            overlays.append((x, y))
    print(f'{name:12s} FILL={len(fills)} OVERLAY={len(overlays)}  fills={fills[:8]}{"..." if len(fills) > 8 else ""}')

# Luminancia das FAMILIAS opacas (para montar sub-familias compativeis e
# evitar quadrados escuros/claros isolados na composicao micro).
print('\n[BRIGHTNESS das bases opacas (FILL)]')
for name, coords in pools.items():
    stats = []
    for x, y in coords:
        crop = im.crop((x, y, x + 16, y + 16))
        if orientation(crop.getchannel('A')) != 'FILL':
            continue
        ln = lum_stats(crop)
        stats.append((x, y, ln[0], ln[1]))
    if not stats:
        continue
    stats.sort(key=lambda t: t[2])
    lums = [t[2] for t in stats]
    spread = lums[-1] - lums[0]
    print(f'{name:12s} n={len(stats)} L: {min(lums):5.1f}..{max(lums):5.1f} (spread={spread:4.1f})')
    print('  ' + ' '.join(f'{x:3},{y:3}:{l:5.1f}' for x, y, l, _ in stats))
