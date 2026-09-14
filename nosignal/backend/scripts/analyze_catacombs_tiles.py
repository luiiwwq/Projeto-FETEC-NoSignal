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

print(f'image={IMG} size={im.size} mode={im.mode}')
for name, coords in pools.items():
    print(f'\n[{name}]')
    for x, y in coords:
        crop = im.crop((x,y,x+16,y+16))
        alpha = crop.getchannel('A')
        vals = list(alpha.getdata())
        opaque = sum(v == 255 for v in vals)
        transparent = sum(v == 0 for v in vals)
        partial = 256 - opaque - transparent
        bbox = alpha.getbbox()
        print(f'{x:3},{y:3} opaque={opaque:3}/256 partial={partial:3} transparent={transparent:3} bbox={bbox}')

# Detect whether the crop is actually a standalone opaque tile or a sparse overlay.
print('\n[SUMMARY]')
for name, coords in pools.items():
    coverages=[]
    for x,y in coords:
        vals=list(im.crop((x,y,x+16,y+16)).getchannel('A').getdata())
        coverages.append(sum(v>0 for v in vals)/256)
    print(f'{name}: min_alpha_coverage={min(coverages):.3f} max={max(coverages):.3f} avg={sum(coverages)/len(coverages):.3f}')
