/**
 * maps.js
 * World / map registry for No Signal.
 *
 * Each map defines its own dimensions, spawn points, solid obstacles
 * (axis-aligned boxes in world coordinates), map-transition exits and
 * decorative structures. Data lives here so rendering and collisions
 * stay separate from gameplay logic.
 */

export const MAP_IDS = {
    MARS_SURFACE: 'mars-surface',
    MARS_CAVE: 'mars-cave',
    MARS_CORE: 'mars-core',
    MARS_CATACOMBS: 'mars-catacombs',
    CASTLE_HALL: 'castle-hall',
    CASTLE_SIDE_ROOM: 'castle-side-room',
    CASTLE_LOWER_AREA: 'castle-lower-area',
    CASTLE_BOSS_ARENA: 'castle-boss-arena',
};

const TILE = 64;

/* ─────────────── Martian Surface ───────────────
 * Big open world. Spawn area on the west, cave rock
 * formation in the middle-north, castle far east.    */

// Cave entrance rock formation — the visual facade comes entirely from the
// monolithic cavern_entrance.png sprite (see MapRenderer; anchor world
// (1620,1410) originX 0.5 originY 1.0 scale 0.167 → drawn rect x1425..1815,
// y1105..1410). The AABBs below track the SOLID rock silhouette of the sprite
// as 5 zones (left→right), derived from its pixel analysis, WITHOUT invading
// the free central corridor x1567..1667 (same width as the cave-entrance
// trigger):
//   - cave-rock-outer-left : isolated pinnacle far-left (sprite x96..257, y898..1497)
//   - cave-pillar-left     : tall internal left wall flanking the mouth (touches corridor at 1566)
//   - cave-arch-top        : arch/dome frame ABOVE the opening (y1108..1200, ceiling over corridor)
//   - cave-wall-right      : wide right inner wall (starts at 1668, slips corridor)
//   - cave-props-right     : bottom-right corner over the solar panel + terminal props
const caveRockOuterLeft = { x: 1445, y: 1267, w: 23, h: 86, kind: 'cave-wall' };
const cavePillarLeft = { x: 1468, y: 1147, w: 98, h: 213, kind: 'cave-wall' };
const caveArchTop = { x: 1527, y: 1108, w: 198, h: 92, kind: 'cave-wall' };
const caveWallRight = { x: 1668, y: 1150, w: 37, h: 230, kind: 'cave-wall' };
const cavePropsRight = { x: 1705, y: 1150, w: 45, h: 210, kind: 'cave-wall' };
// Movement-limit collision for the cave entrance mouth (keeps the character on
// the floor, out of the ceiling and off the side electronics):
// - cave-entrance-lip : frontal wall under the arch. Bottom edge y1303 + player
//   half-height 22 => player.y (center) can't drop below 1325 for x 1570..1620.
// - cave-solar-panel  : the electronics / solar-panel slab on the right side.
//   Bottom edge y1303 frees the passage rect x1628..1648 / y1325..1342
//   (player center y >= 1325 => box top >= 1303, no panel overlap).
const caveEntranceLip = { x: 1570, y: 1108, w: 50, h: 195, kind: 'cave-wall' };
// cave-rock-right : vertical wall on the rock outcrop east of the props. Left
// edge exactly x1781; spans the sprite silhouette (y1279..1347) with margin to
// block crossing at the measured point (1781, 1337) while leaving the floor free.
const caveRockRight = { x: 1781, y: 1260, w: 30, h: 100, kind: 'cave-wall' };
const caveSolarPanel = { x: 1648, y: 1290, w: 37, h: 13, kind: 'cave-wall' };

// Distant castle — visual facade comes from castle-sprite.png (see MapRenderer).
// SOLID collision covering the facade:
// - Outer rock rubble tips: castle-rubble-left (x3385..3450) and castle-rubble-right (x3850..3920)
// - Left tower/wall block: castle-tower-left (x3450..3518) and castle-pillar-left (x3517..3584), y600..929
// - Right tower/wall block: castle-pillar-right (x3715..3783) and castle-tower-right (x3782..3850), y600..929
// - Central dome & upper facade: castle-keep-top (x3570..3730, y547..808), ending at door lintel
// - Central door opening (x3584..3715) remains open for access corridor down to spawn (y960)
// - Door leaves barrier: castle-door-block (x3584..3715, y816..830) stopping player at interaction zone.
const castleRubbleLeft = { id: 'castle-rubble-left', x: 3385, y: 845, w: 65, h: 84, kind: 'castle-wall' };
const castleTowerLeft = { id: 'castle-tower-left', x: 3450, y: 600, w: 68, h: 329, kind: 'castle-wall' };
const castlePillarLeft = { id: 'castle-pillar-left', x: 3517, y: 600, w: 67, h: 329, kind: 'castle-wall' };
const castleKeepTop = { id: 'castle-keep-top', x: 3570, y: 547, w: 160, h: 261, kind: 'castle-wall' };
const castlePillarRight = { id: 'castle-pillar-right', x: 3715, y: 600, w: 68, h: 329, kind: 'castle-wall' };
const castleTowerRight = { id: 'castle-tower-right', x: 3782, y: 600, w: 68, h: 329, kind: 'castle-wall' };
const castleRubbleRight = { id: 'castle-rubble-right', x: 3850, y: 835, w: 70, h: 94, kind: 'castle-wall' };

// Thin collision strip across the door opening — prevents the player from
// visually walking through the closed door leaves. Its bottom edge (the one
// facing the player approaching from below) is pushed a little further down,
// inside the top of the interaction trigger, so the player stops a bit before
// the door: blocked at centerY = 830 + halfH, i.e. ~22px below the old stop
// point, while the "[E] ENTRAR" prompt is still visible.
const castleDoorBlock = { id: 'castle-door-block', x: 3584, y: 816, w: 131, h: 14, kind: 'castle-wall' };

// Border rocks framing the world edges (visual + collision)
const surfaceBorderRocks = [
    { x: 0, y: 0, w: 4800, h: 60, kind: 'edge-rock' },
    { x: 0, y: 3140, w: 4800, h: 60, kind: 'edge-rock' },
    { x: 0, y: 0, w: 60, h: 3200, kind: 'edge-rock' },
    { x: 4740, y: 0, w: 60, h: 3200, kind: 'edge-rock' },
];

export const marsSurfaceMap = {
    id: MAP_IDS.MARS_SURFACE,
    type: 'surface',
    width: 4800,
    height: 3200,
    tileSize: TILE,
    dust: true,
    spawn: { x: 420, y: 700 },
    spawnPoints: {
        'mars-start': { x: 420, y: 700 },
        'cave-return': { x: 1615, y: 1500 },
        'castle-return': { x: 3660, y: 960 },
    },
    // Free-movement bands: the rectangle is excavated from every obstacle that
    // crosses it (expanded by the player's half-size so the whole body passes
    // while the center is inside), leaving a collision-free floor corridor.
    // Here: cave floor corridor x1425..1831 / y1354..1382.
    freeMoveZones: [{ x: 1425, y: 1354, w: 406, h: 28 }],
    obstacles: [
        ...surfaceBorderRocks,
        caveRockOuterLeft,
        cavePillarLeft,
        caveArchTop,
        caveWallRight,
        cavePropsRight,
        caveEntranceLip,
        caveSolarPanel,
        caveRockRight,
        castleRubbleLeft,
        castleTowerLeft,
        castlePillarLeft,
        castleKeepTop,
        castlePillarRight,
        castleTowerRight,
        castleRubbleRight,
        castleDoorBlock,
    ],
    exits: [
        {
            id: 'cave-entrance',
            label: 'ENTRAR NA CAVERNA',
            targetMap: MAP_IDS.MARS_CAVE,
            targetSpawn: 'cave-entry',
            // Rectangular trigger aligned with the dark cave-mouth opening of
            // cavern_entrance.png (world x1567..1667 from the corridor, y1200..1380).
            // Overlap only (rectsOverlap), no radial detection. Its bottom (1380)
            // stays ~120px above the cave-return spawn (y1500) so the prompt does
            // NOT appear right after coming back from the cave — same rule applied
            // to the castle-gate trigger.
            area: { x: 1567, y: 1200, w: 100, h: 180 },
        },
        {
            id: 'castle-gate',
            label: 'ENTRAR NO CASTELO',
            targetMap: MAP_IDS.CASTLE_HALL,
            targetSpawn: 'hall-entry',
            x: 3660,
            y: 760,
            radius: 72,
            // Rectangular trigger as a THIN HORIZONTAL STRIP at the door lintel
            // height (y808), centered on the door opening (x3580..3720). Overlap
            // only (rectsOverlap). The bottom (y848) stays well above the
            // castle-return spawn (960) so the prompt does NOT appear on spawn.
            // The castle-door-block collision sits at y816..830, inside the top
            // of this trigger, so the player is stopped a bit further from the
            // door leaves while still overlapping the zone (~18px of standing
            // room below the barrier) with the prompt visible.
            area: { x: 3580, y: 808, w: 140, h: 40 },
        },
    ],
    structures: [
        {
            type: 'rock-form',
            walls: [caveRockOuterLeft, cavePillarLeft, caveArchTop, caveWallRight, cavePropsRight],
        },
    ],
};

/* ─────────────── Mars Cave (dungeon) ─────────────── */

const border4 = (w, h, t, kind) => [
    { x: 0, y: 0, w, h: t, kind },
    { x: 0, y: h - t, w, h: t, kind },
    { x: 0, y: 0, w: t, h, kind },
    { x: w - t, y: 0, w: t, h, kind },
];

export const marsCaveMap = {
    id: MAP_IDS.MARS_CAVE,
    type: 'cave',
    width: 2400,
    height: 1600,
    tileSize: TILE,
    dust: false,
    spawn: { x: 200, y: 820 },
    spawnPoints: {
        'cave-entry': { x: 200, y: 820 },
    },
    obstacles: [
        ...border4(2400, 1600, 140, 'cave-wall'),
        // Columns / rock piles
        { x: 620, y: 460, w: 90, h: 90, kind: 'cave-rock' },
        { x: 640, y: 1040, w: 110, h: 110, kind: 'cave-rock' },
        { x: 1100, y: 620, w: 96, h: 96, kind: 'cave-rock' },
        { x: 1330, y: 1130, w: 88, h: 88, kind: 'cave-rock' },
        { x: 1560, y: 520, w: 84, h: 84, kind: 'cave-rock' },
        { x: 1700, y: 880, w: 100, h: 100, kind: 'cave-rock' },
        { x: 2020, y: 700, w: 90, h: 90, kind: 'cave-rock' },
        // Deep chamber choke points
        { x: 1730, y: 1280, w: 120, h: 120, kind: 'cave-rock' },
        { x: 1500, y: 1330, w: 92, h: 92, kind: 'cave-rock' },
    ],
    exits: [
        {
            id: 'cave-exit',
            label: 'SAIR DA CAVERNA',
            targetMap: MAP_IDS.MARS_SURFACE,
            targetSpawn: 'cave-return',
            x: 260,
            y: 820,
            radius: 62,
        },
    ],
    structures: [
        {
            type: 'crystal',
            x: 1930,
            y: 1160,
        },
    ],
};

/* ─────────────── Undead Mars maps (Núcleo + Catacumbas) ─────────────── */

// Individual undead-tileset props. Each object stores its own `sprite` path
// relative to src/assets/sprites/ (rendered generically via MapRenderer's
// _loadSpriteOnce — one load per file, reused across all placements).
const UNDEAD_OBJECTS_DIR = 'UndeadMars/undead-tileset-mars-palette/undead_tileset_mars/PNG/Objects_separately/';
const undeadSprite = (file) => `${UNDEAD_OBJECTS_DIR}${file}`;
// Root PNG/ files (Ground_rocks floor, water animation frames, ...).
const undeadPng = (file) => `UndeadMars/undead-tileset-mars-palette/undead_tileset_mars/PNG/${file}`;

/* ─────────────── Catacumbas: máscara de terreno ───────────────
 * Ground truth do mapa: grade única 44×22 de células de 64px (2816×1408, 2:1).
 * Símbolos exclusivos: `.` = chão caminhável, `#` = rocha sólida. Um único
 * componente navegável liga boca oeste → corredor oeste → arena central →
 * gargalo leste → salão final. As paredes externas são massas contínuas de
 * `#` (norte e sul inteiros, leste selado); a única abertura na borda é o
 * ponto de entrada/saída a oeste. Não há nichos, bolsões, aberturas falsas
 * nem células de chão isoladas dentro da rocha. Renderização, colisões e
 * decoração derivam desta mesma máscara (fonte única, determinística). */

const chi = (x, y) => {
    const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
};

// 22 linhas × 44 colunas. Regiões (aprox.): boca oeste c0-1 r10-14; entrada
// c2-5 r9-14; corredor oeste c6-15 (r7-16); arena c15-30 (interior livre
// c17-28 r8-15); gargalo leste c30-33 (r9-15); salão final c34-42 (r6-17).
export const catacombsLayout = [
    '############################################', // 00 topo
    '############################################', // 01
    '############################################', // 02
    '############################################', // 03
    '############################################', // 04
    '##################.........#################', // 05 teto da arena
    '################.............#########..####', // 06
    '###############...............######......##', // 07
    '###########....................####........#', // 08
    '##.........................................#', // 09 corredor
    '...........................................#', // 10 entrada/corredor
    '...........................................#', // 11
    '...........................................#', // 12
    '...........................................#', // 13
    '...........................................#', // 14
    '######.....................................#', // 15
    '#############..................###.........#', // 16 fim da arena
    '#################...........########......##', // 17
    '############################################', // 18 base
    '############################################', // 19
    '############################################', // 20
    '############################################', // 21 base
];

// Walkable cells (everything that is not solid rock).
const CATACOMBS_WALKABLE = new Set(['.']);

// Merged solid AABBs (one per contiguous rock run per row, 64px tall) — feeds
// collisionSystem unchanged (kind 'undead-rock', no sprite: collision only).
export function catacombsRockRects(layout, tile) {
    const rects = [];
    const rows = layout.length;
    const cols = layout[0].length;
    for (let r = 0; r < rows; r++) {
        let c = 0;
        while (c < cols) {
            if (CATACOMBS_WALKABLE.has(layout[r][c])) {
                c++;
                continue;
            }
            let c2 = c;
            while (c2 < cols && !CATACOMBS_WALKABLE.has(layout[r][c2])) c2++;
            rects.push({ x: c * tile, y: r * tile, w: (c2 - c) * tile, h: tile, kind: 'undead-rock' });
            c = c2;
        }
    }
    return rects;
}

// Seeded decor for the catacombs — region-based composition groups read off the
// same mask: wall clusters (2..5 props walking the boundary), grave/bone bands
// along the long horizontal walls, curated ruins at the transitions and skull
// piles around the finale. Props spawn ONLY on rock cells at the wall mass.
// Every prop is tagged with a layer ('back' drawn right after the terrain,
// 'front' after the structures) and is kept off the reserved arena clearing +
// spawn plaza.
const CAT_CO_ROCKS = [
    'Rock_shadow1_1.png', 'Rock_shadow1_2.png', 'Rock_shadow1_3.png', 'Rock_shadow1_4.png', 'Rock_shadow1_5.png',
    'Rock_shadow2_1.png', 'Rock_shadow2_2.png', 'Rock_shadow2_3.png', 'Rock_shadow2_4.png', 'Rock_shadow2_5.png',
    'Rock_shadow3_1.png', 'Rock_shadow3_2.png', 'Rock_shadow3_3.png', 'Rock_shadow3_4.png', 'Rock_shadow3_5.png',
];
const CAT_CO_BONES = [
    // Every Bones_shadow* crop present in the tileset (families 1..3, all
    // variants) so the wall bands stay varied instead of repeating 4.
    'Bones_shadow1_1.png', 'Bones_shadow1_2.png', 'Bones_shadow1_3.png', 'Bones_shadow1_4.png',
    'Bones_shadow1_5.png', 'Bones_shadow1_6.png', 'Bones_shadow1_7.png', 'Bones_shadow1_8.png',
    'Bones_shadow1_9.png', 'Bones_shadow1_10.png', 'Bones_shadow1_11.png', 'Bones_shadow1_12.png',
    'Bones_shadow1_13.png', 'Bones_shadow1_14.png', 'Bones_shadow1_15.png', 'Bones_shadow1_16.png',
    'Bones_shadow1_17.png', 'Bones_shadow1_18.png',
    'Bones_shadow2_1.png', 'Bones_shadow2_2.png', 'Bones_shadow2_3.png', 'Bones_shadow2_4.png',
    'Bones_shadow2_5.png', 'Bones_shadow2_6.png', 'Bones_shadow2_7.png', 'Bones_shadow2_8.png',
    'Bones_shadow2_9.png', 'Bones_shadow2_10.png', 'Bones_shadow2_11.png', 'Bones_shadow2_12.png',
    'Bones_shadow2_13.png', 'Bones_shadow2_15.png', 'Bones_shadow2_16.png', 'Bones_shadow2_17.png',
    'Bones_shadow2_18.png',
    'Bones_shadow3_1.png', 'Bones_shadow3_2.png', 'Bones_shadow3_3.png', 'Bones_shadow3_4.png',
    'Bones_shadow3_5.png', 'Bones_shadow3_6.png', 'Bones_shadow3_7.png', 'Bones_shadow3_8.png',
    'Bones_shadow3_9.png', 'Bones_shadow3_10.png', 'Bones_shadow3_11.png', 'Bones_shadow3_12.png',
    'Bones_shadow3_13.png', 'Bones_shadow3_14.png', 'Bones_shadow3_15.png', 'Bones_shadow3_16.png',
    'Bones_shadow3_17.png', 'Bones_shadow3_18.png',
];
const CAT_CO_GRAVES = [
    'Grave_shadow1_1.png', 'Grave_shadow1_2.png', 'Grave_shadow1_3.png', 'Grave_shadow1_4.png',
    'Grave_shadow2_1.png', 'Grave_shadow2_2.png',
];
const CAT_CO_SKULLS = ['Pile_sculls_shadow1.png', 'Pile_sculls_shadow2.png', 'Pile_sculls_shadow3.png'];
const CAT_CO_CRYSTALS = [
    'Crystal_shadow1_1.png', 'Crystal_shadow1_2.png', 'Crystal_shadow1_3.png', 'Crystal_shadow1_4.png',
    'Crystal_shadow2_1.png', 'Crystal_shadow2_2.png', 'Crystal_shadow2_3.png', 'Crystal_shadow2_4.png',
    'Crystal_shadow3_1.png', 'Crystal_shadow3_2.png', 'Crystal_shadow3_3.png', 'Crystal_shadow3_4.png',
];
const CAT_CO_RUINS = [
    'Ruin_shadow1_2.png', 'Ruin_shadow1_4.png', 'Ruin_shadow1_5.png', 'Ruin_shadow2_1.png', 'Ruin_shadow3_2.png',
];
const CAT_CO_PLANTS = [
    'Plant_shadow1_1.png', 'Plant_shadow1_2.png', 'Plant_shadow1_3.png', 'Plant_shadow1_4.png', 'Plant_shadow1_5.png',
    'Plant__shadow2_1.png', 'Plant__shadow2_2.png', 'Plant__shadow2_3.png', 'Plant__shadow2_4.png', 'Plant__shadow2_5.png',
    'Plant_shadow3_1.png', 'Plant_shadow3_2.png', 'Plant_shadow3_3.png', 'Plant_shadow3_4.png', 'Plant_shadow3_5.png',
];
const CAT_CO_THORNS = [
    'Thorn_plant_shadow1_1.png', 'Thorn_plant_shadow1_2.png', 'Thorn_plant_shadow1_3.png',
    'Thorn_plant_shadow3_1.png', 'Thorn_plant_shadow3_2.png',
];

// Combat arena zone: rough box around the whole clearing (incl. mouth bulges).
export const catacombsArenaRect = { x: 15 * TILE, y: 6 * TILE, w: 16 * TILE, h: 12 * TILE };
// Inner arena clearing + spawn plaza: kept 100% free of decor and obstacles.
const CATACOMBS_FREE_RECT = { x: 17 * TILE, y: 8 * TILE, w: 12 * TILE, h: 8 * TILE };
const CATACOMBS_SPAWN_RECT = { x: 0, y: 10 * TILE, w: 9 * TILE, h: 5 * TILE };

export function catacombsDecor(layout, tile) {
    const dec = [];
    const rows = layout.length;
    const cols = layout[0].length;
    const walk = CATACOMBS_WALKABLE;
    const rockAt = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols && !walk.has(layout[r][c]);
    const floorAt = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols && walk.has(layout[r][c]);
    const touchesFloor = (r, c) =>
        floorAt(r, c - 1) || floorAt(r, c + 1) || floorAt(r - 1, c) || floorAt(r + 1, c);

    const overlaps = (x, y, s, rect) => x < rect.x + rect.w && x + s > rect.x && y < rect.y + rect.h && y + s > rect.y;
    const clear = (x, y, s) =>
        !overlaps(x, y, s, CATACOMBS_FREE_RECT) &&
        !overlaps(x, y, s, CATACOMBS_SPAWN_RECT) &&
        x >= 0 && y >= 0 && x + s <= cols * tile && y + s <= rows * tile;

    const pxUsed = new Set();
    const cellUsed = new Set();
    const add = (x, y, sprite, layer = 'back', size = tile) => {
        x = Math.round(x);
        y = Math.round(y);
        const key = `${x},${y}`;
        if (pxUsed.has(key) || !clear(x, y, size)) return;
        pxUsed.add(key);
        dec.push({ x, y, sprite: undeadSprite(sprite), kind: 'undead-decor', layer });
    };
    const poolPick = (pool, h) => pool[Math.floor(h * pool.length)];

    // ── 1) Wall clusters: 2..5 props walking along the rock/floor boundary.
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cellKey = `${r},${c}`;
            if (walk.has(layout[r][c]) || cellUsed.has(cellKey)) continue;
            if (!touchesFloor(r, c)) continue;
            if (chi(c * 7 + 11, r * 13 + 5) > 0.18) continue;
            let cr = r;
            let cc = c;
            const gLen = 2 + Math.floor(chi(c * 3, r * 9) * 4); // 2..5
            for (let i = 0; i < gLen; i++) {
                const k = `${cr},${cc}`;
                if (cellUsed.has(k) || !rockAt(cr, cc) || !touchesFloor(cr, cc)) break;
                cellUsed.add(k);
                const x = cc * tile + chi(cr, cc * 7) * tile * 0.6;
                const y = cr * tile + chi(cc * 3, cr * 11) * tile * 0.6;
                const kind = chi(cc * 13 + 3, cr * 7 + 5);
                const pool = kind < 0.75 ? CAT_CO_ROCKS : kind < 0.9 ? CAT_CO_BONES : CAT_CO_PLANTS;
                add(x, y, poolPick(pool, chi(cc, cr)), 'back', i === 0 ? tile : tile - 16);
                if (chi(cc + 5, cr + 5) < 0.55) cc += 1;
                else cr += 1;
            }
        }
    }

    // ── 2) Grave/bone bands along the long horizontal walls (with staggered
    //    offsets, no evenly spaced lines).
    const bandSeeds = [];
    for (let c = 0; c < cols; c++) {
        let top = -1;
        for (let r = 0; r < rows && top < 0; r++) if (walk.has(layout[r][c])) top = r;
        if (top > 0) bandSeeds.push([top - 1, c]);
        let bottom = -1;
        for (let r = rows - 1; r >= 0 && bottom < 0; r--) if (walk.has(layout[r][c])) bottom = r;
        if (bottom >= 0 && bottom + 1 < rows) bandSeeds.push([bottom + 1, c]);
    }
    for (const [r, c] of bandSeeds) {
        const k = `${r},${c}`;
        if (cellUsed.has(k)) continue;
            if (chi(c * 5 + 1, r * 9 + 3) > 0.34) continue;
        cellUsed.add(k);
        const x = c * tile + chi(c, r) * tile * 0.5;
        const y = r * tile + chi(r, c) * tile * 0.3;
        const pool = chi(r + 3, c + 1) < 0.5 ? CAT_CO_GRAVES : CAT_CO_BONES;
        add(x, y, poolPick(pool, chi(c * 3, r * 5)), 'front', tile + 24);
    }

    // ── 3) Curated ruin transitions + skull piles around the finale door.
    const ruinSpots = [
        [15, 6, 'Ruin_shadow1_4.png'], // lintel of the arena west mouth
        [30, 5, 'Ruin_shadow2_3.png'], // above the throat
        [9, 6, 'Ruin_shadow1_2.png'], // corridor lintel
        [33, 4, 'Ruin_shadow3_2.png'], // hall top approach
        [16, 4, 'Ruin_shadow2_1.png'], // west mouth shoulder
        [41, 5, 'Ruin_shadow1_5.png'], // finale ceiling
    ];
    for (const [c, r, s] of ruinSpots) {
        if (!rockAt(r, c)) continue;
        add(c * tile + tile * 0.1, r * tile, s, 'front', tile * 1.5);
    }
    const skullSpots = [
        [39, 2], [42, 3], [33, 3],
    ];
    for (const [c, r] of skullSpots) {
        if (!rockAt(r, c)) continue;
        add(c * tile + tile * 0.3, r * tile + tile * 0.2, poolPick(CAT_CO_SKULLS, chi(c, r)), 'front', tile);
    }

    // ── 4) Crystal accents on rock near the finale door and the arena bulges.
    const crystalSpots = [
        [40, 5], [42, 5], [42, 18], [18, 4], [29, 18], [30, 6],
    ];
    for (const [c, r] of crystalSpots) {
        if (!rockAt(r, c)) continue;
        add(c * tile + tile * 0.3, r * tile, poolPick(CAT_CO_CRYSTALS, chi(c, r)), 'front', tile * 0.8);
    }

    // ── 5) Lich spirits (decor only, no AI), deep inside rock off the route.
    const lichSpots = [[9, 3], [34, 3]];
    for (let i = 0; i < lichSpots.length; i++) {
        const [c, r] = lichSpots[i];
        if (!rockAt(r, c)) continue;
        add(c * tile + tile * 0.3, r * tile + tile * 0.2, `Lich_shadow${i + 1}.png`, 'front', tile);
    }

    return dec;
}

/* ─────────────── Núcleo de Marte ─────────────── */

export const marsCoreMap = {
    id: MAP_IDS.MARS_CORE,
    type: 'cave',
    width: 2000,
    height: 1400,
    tileSize: TILE,
    dust: false,
    spawn: { x: 200, y: 700 },
    spawnPoints: {
        'core-entry': { x: 200, y: 700 },
    },
    obstacles: [
        ...border4(2000, 1400, 140, 'cave-wall'),
        // Low-density: a handful of solid rocks flanking the route to the item
        // (north/south bands), keeping the central passage always walkable.
        { x: 470, y: 380, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow1_1.png') },
        { x: 720, y: 1000, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow2_2.png') },
        { x: 960, y: 360, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow1_2.png') },
        { x: 1200, y: 1010, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow3_1.png') },
        { x: 1440, y: 400, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow2_1.png') },
        { x: 1660, y: 1020, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow1_3.png') },
        // All remaining Rock_shadow variants (all 15 in the tileset): north +
        // south bands, never inside the central walkable lane (y ~550..820).
        { x: 520, y: 470, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow1_4.png') },
        { x: 840, y: 470, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow1_5.png') },
        { x: 1120, y: 470, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow2_3.png') },
        { x: 1520, y: 470, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow2_4.png') },
        { x: 360, y: 980, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow2_5.png') },
        { x: 560, y: 1060, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow3_2.png') },
        { x: 900, y: 1080, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow3_3.png') },
        { x: 1500, y: 990, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow3_4.png') },
        { x: 1800, y: 1040, w: 64, h: 64, kind: 'undead-rock', sprite: undeadSprite('Rock_shadow3_5.png') },
    ],
    exits: [
        {
            id: 'core-return',
            label: 'SAIR DO NUCLEO',
            targetMap: MAP_IDS.MARS_SURFACE,
            targetSpawn: 'cave-return',
            x: 290,
            y: 700,
            radius: 62,
        },
    ],
    decorations: [
        // Energy/"núcleo" flavour only — no skulls/graves here, by request.
        { x: 1200, y: 470, sprite: undeadSprite('Crystal_shadow2_1.png'), kind: 'undead-decor' },
        { x: 1050, y: 990, sprite: undeadSprite('Crystal_shadow1_1.png'), kind: 'undead-decor' },
        { x: 1640, y: 620, sprite: undeadSprite('Crystal_shadow1_1.png'), kind: 'undead-decor' },
        { x: 1700, y: 760, sprite: undeadSprite('Crystal_shadow1_2.png'), kind: 'undead-decor' },
        // End-of-route visual item marker (sprite only, no collision/interaction).
        { x: 1760, y: 644, sprite: undeadSprite('Crystal_shadow3_1.png'), kind: 'undead-decor' },
        // All Plant_shadow* herbs (15/15 in the tileset), framing the margins
        // and the space between the rock bands (decor, no collision).
        { x: 220, y: 180, sprite: undeadSprite('Plant_shadow1_1.png'), kind: 'undead-decor' },
        { x: 520, y: 200, sprite: undeadSprite('Plant_shadow1_2.png'), kind: 'undead-decor' },
        { x: 880, y: 180, sprite: undeadSprite('Plant_shadow1_3.png'), kind: 'undead-decor' },
        { x: 1240, y: 200, sprite: undeadSprite('Plant_shadow1_4.png'), kind: 'undead-decor' },
        { x: 1620, y: 200, sprite: undeadSprite('Plant_shadow1_5.png'), kind: 'undead-decor' },
        { x: 220, y: 1100, sprite: undeadSprite('Plant__shadow2_1.png'), kind: 'undead-decor' },
        { x: 520, y: 1160, sprite: undeadSprite('Plant__shadow2_2.png'), kind: 'undead-decor' },
        { x: 880, y: 1120, sprite: undeadSprite('Plant__shadow2_3.png'), kind: 'undead-decor' },
        { x: 1240, y: 1160, sprite: undeadSprite('Plant__shadow2_4.png'), kind: 'undead-decor' },
        { x: 1660, y: 1160, sprite: undeadSprite('Plant__shadow2_5.png'), kind: 'undead-decor' },
        { x: 1020, y: 460, sprite: undeadSprite('Plant_shadow3_1.png'), kind: 'undead-decor' },
        { x: 1380, y: 480, sprite: undeadSprite('Plant_shadow3_2.png'), kind: 'undead-decor' },
        { x: 560, y: 980, sprite: undeadSprite('Plant_shadow3_3.png'), kind: 'undead-decor' },
        { x: 1720, y: 240, sprite: undeadSprite('Plant_shadow3_4.png'), kind: 'undead-decor' },
        { x: 1720, y: 1080, sprite: undeadSprite('Plant_shadow3_5.png'), kind: 'undead-decor' },
        // Animated water pool right below the end-of-route item (both frames
        // share the same position/size, alternating ~every 0.45s; decor only,
        // no collision). Drawn last so it reads on top of the floor.
        {
            x: 1720,
            y: 700,
            frames: [undeadPng('water_detilazation.png'), undeadPng('water_detilazation_v2.png')],
            kind: 'undead-decor-anim',
            interval: 0.45,
            scale: 0.37,
        },
    ],
    structures: [],
};

/* ─────────────── Catacumbas Marcianas ─────────────── */

export const marsCatacombsMap = {
    id: MAP_IDS.MARS_CATACOMBS,
    type: 'cave',
    width: 44 * TILE, // 2816
    height: 22 * TILE, // 1408 — exact 2:1, tile-aligned
    tileSize: TILE,
    dust: false,
    spawn: { x: 110, y: 752 },
    spawnPoints: {
        'catacombs-entry': { x: 110, y: 752 },
    },
    // Walkability mask shared by renderer/collisions (cells are 64px).
    terrainMask: catacombsLayout,
    // Reserved open combat arena in the MIDDLE of the route, crossed on the
    // way in AND on the way back (corridor → arena → corridor). Kept 100% free
    // (no obstacle, no decoration inside) by both generation rules below.
    arenaCombatArea: { ...catacombsArenaRect },
    obstacles: [
        // Solid rock masses originate from the terrain mask (one AABB per
        // contiguous rock run per row) — collision only (no sprite). Three big
        // dead trees are planted fully inside the top/bottom rock mass so they
        // add silhouette without touching any walkable path.
        ...catacombsRockRects(catacombsLayout, TILE),
        { x: 96, y: 192, w: 96, h: 96, kind: 'undead-rock', sprite: undeadSprite('Dead_tree_shadow1_1.png') },
        { x: 2400, y: 160, w: 96, h: 96, kind: 'undead-rock', sprite: undeadSprite('Dead_tree_shadow1_2.png') },
        { x: 1408, y: 1216, w: 96, h: 96, kind: 'undead-rock', sprite: undeadSprite('Dead_tree_shadow3_1.png') },
    ],
    exits: [
        {
            id: 'catacombs-return',
            label: 'SAIR DAS CATACUMBAS',
            targetMap: MAP_IDS.MARS_SURFACE,
            targetSpawn: 'cave-return',
            x: 288,
            y: 800,
            radius: 62,
        },
    ],
    structures: [],
    // Seeded wall-hugging decor (bones/graves/skulls/rock chips/crystals) +
    // curated "destination" props for the dry finale room (all on rock cells).
    decorations: [
        ...catacombsDecor(catacombsLayout, TILE),
        // Destination element — scull door embedded in the finale's north wall
        // (rock at c40 row 6). Floor stays normal and dry beneath it.
        { x: 2592, y: 384, sprite: undeadSprite('Scull_door_shadow1.png'), kind: 'undead-decor', layer: 'front' },
        { x: 2432, y: 1152, sprite: undeadSprite('Pile_sculls_shadow2.png'), kind: 'undead-decor', layer: 'front' },
        { x: 2688, y: 1152, sprite: undeadSprite('Pile_sculls_shadow3.png'), kind: 'undead-decor', layer: 'front' },
        { x: 2624, y: 320, sprite: undeadSprite('Ruin_shadow2_3.png'), kind: 'undead-decor', layer: 'front' },
        { x: 2208, y: 384, sprite: undeadSprite('Ruin_shadow1_5.png'), kind: 'undead-decor', layer: 'front' },
        { x: 2370, y: 1150, sprite: undeadSprite('Bones_shadow1_1.png'), kind: 'undead-decor', layer: 'front' },
        { x: 2620, y: 1150, sprite: undeadSprite('Bones_shadow2_1.png'), kind: 'undead-decor', layer: 'front' },
        { x: 2304, y: 320, sprite: undeadSprite('Crystal_shadow2_1.png'), kind: 'undead-decor', layer: 'front' },
        { x: 2496, y: 320, sprite: undeadSprite('Crystal_shadow1_3.png'), kind: 'undead-decor', layer: 'front' },
        { x: 2304, y: 1184, sprite: undeadSprite('Dead_tree_shadow3_2.png'), kind: 'undead-decor', layer: 'front' },
        { x: 2528, y: 1248, sprite: undeadSprite('Dead_tree_shadow3_3.png'), kind: 'undead-decor', layer: 'front' },
    ],
};

/* ─────────────── Castle interior maps ─────────────── */

export const castleHallMap = {
    id: MAP_IDS.CASTLE_HALL,
    type: 'castle',
    width: 1600,
    height: 1200,
    tileSize: TILE,
    dust: false,
    spawn: { x: 300, y: 600 },
    spawnPoints: {
        'hall-entry': { x: 300, y: 600 },
        'hall-side-door': { x: 1518, y: 520 },
        'hall-lower-door': { x: 760, y: 250 },
    },
    obstacles: [
        // Border with 3 openings: west return door, east side room door, north stairs door
        { x: 0, y: 0, w: 1600, h: 140, kind: 'castle-wall' },
        { x: 0, y: 1060, w: 1600, h: 140, kind: 'castle-wall' },
        { x: 0, y: 0, w: 140, h: 480, kind: 'castle-wall' },
        { x: 0, y: 640, w: 140, h: 560, kind: 'castle-wall' },
        { x: 1460, y: 0, w: 140, h: 440, kind: 'castle-wall' },
        { x: 1460, y: 560, w: 140, h: 640, kind: 'castle-wall' },
        { x: 140, y: 0, w: 540, h: 140, kind: 'castle-wall' },
        { x: 860, y: 0, w: 600, h: 140, kind: 'castle-wall' },
        // Pillars
        { x: 420, y: 430, w: 72, h: 72, kind: 'column' },
        { x: 720, y: 720, w: 72, h: 72, kind: 'column' },
        { x: 1060, y: 430, w: 72, h: 72, kind: 'column' },
        // Altar / debris
        { x: 720, y: 620, w: 72, h: 40, kind: 'crate' },
    ],
    exits: [
        {
            id: 'hall-return',
            label: 'VOLTAR A SUPERFICIE',
            targetMap: MAP_IDS.MARS_SURFACE,
            targetSpawn: 'castle-return',
            x: 110,
            y: 600,
            radius: 62,
        },
        {
            id: 'hall-side',
            label: 'SALA LATERAL',
            targetMap: MAP_IDS.CASTLE_SIDE_ROOM,
            targetSpawn: 'side-entry',
            x: 1518,
            y: 500,
            radius: 58,
        },
        {
            id: 'hall-lower',
            label: 'AREA INFERIOR',
            targetMap: MAP_IDS.CASTLE_LOWER_AREA,
            targetSpawn: 'lower-entry',
            x: 760,
            y: 90,
            radius: 58,
        },
    ],
    structures: [],
};

export const castleSideRoomMap = {
    id: MAP_IDS.CASTLE_SIDE_ROOM,
    type: 'castle',
    width: 1280,
    height: 800,
    tileSize: TILE,
    dust: false,
    spawn: { x: 240, y: 500 },
    spawnPoints: {
        'side-entry': { x: 240, y: 500 },
    },
    obstacles: [
        { x: 0, y: 0, w: 1280, h: 130, kind: 'castle-wall' },
        { x: 0, y: 670, w: 1280, h: 130, kind: 'castle-wall' },
        { x: 0, y: 0, w: 130, h: 420, kind: 'castle-wall' },
        { x: 0, y: 540, w: 130, h: 260, kind: 'castle-wall' },
        { x: 1150, y: 0, w: 130, h: 800, kind: 'castle-wall' },
        // Crates / debris
        { x: 360, y: 330, w: 74, h: 74, kind: 'crate' },
        { x: 520, y: 480, w: 90, h: 90, kind: 'crate' },
        { x: 660, y: 300, w: 64, h: 64, kind: 'crate' },
    ],
    exits: [
        {
            id: 'side-return',
            label: 'VOLTAR AO SALAO',
            targetMap: MAP_IDS.CASTLE_HALL,
            targetSpawn: 'hall-side-door',
            x: 100,
            y: 500,
            radius: 56,
        },
    ],
    structures: [],
};

export const castleLowerAreaMap = {
    id: MAP_IDS.CASTLE_LOWER_AREA,
    type: 'castle',
    width: 1400,
    height: 1000,
    tileSize: TILE,
    dust: false,
    spawn: { x: 760, y: 300 },
    spawnPoints: {
        'lower-entry': { x: 760, y: 300 },
        'lower-arena-return': { x: 700, y: 250 },
    },
    obstacles: [
        { x: 0, y: 0, w: 1400, h: 140, kind: 'castle-wall' },
        { x: 0, y: 860, w: 1400, h: 140, kind: 'castle-wall' },
        { x: 0, y: 0, w: 140, h: 1000, kind: 'castle-wall' },
        { x: 1260, y: 0, w: 140, h: 1000, kind: 'castle-wall' },
        // South door gap (return to hall) -> split south wall
        // North door gap (to arena) -> split north wall
        { x: 0, y: 0, w: 660, h: 140, kind: 'castle-wall' },
        { x: 780, y: 0, w: 620, h: 140, kind: 'castle-wall' },
        { x: 0, y: 860, w: 700, h: 140, kind: 'castle-wall' },
        { x: 820, y: 860, w: 580, h: 140, kind: 'castle-wall' },
        // Columns
        { x: 400, y: 500, w: 84, h: 84, kind: 'column' },
        { x: 950, y: 500, w: 84, h: 84, kind: 'column' },
        { x: 640, y: 640, w: 90, h: 90, kind: 'crate' },
        { x: 320, y: 220, w: 70, h: 70, kind: 'crate' },
    ],
    exits: [
        {
            id: 'lower-hall',
            label: 'VOLTAR AO SALAO',
            targetMap: MAP_IDS.CASTLE_HALL,
            targetSpawn: 'hall-lower-door',
            x: 760,
            y: 908,
            radius: 56,
        },
        {
            id: 'lower-arena',
            label: 'ARENA DO BOSS',
            targetMap: MAP_IDS.CASTLE_BOSS_ARENA,
            targetSpawn: 'arena-player',
            x: 720,
            y: 90,
            radius: 58,
        },
    ],
    structures: [],
};

export const castleBossArenaMap = {
    id: MAP_IDS.CASTLE_BOSS_ARENA,
    type: 'castle',
    width: 1800,
    height: 1200,
    tileSize: TILE,
    dust: false,
    spawn: { x: 300, y: 600 },
    spawnPoints: {
        'arena-player': { x: 300, y: 600 },
        'arena-boss': { x: 1500, y: 600 },
    },
    obstacles: [
        { x: 0, y: 0, w: 1800, h: 150, kind: 'castle-wall' },
        { x: 0, y: 1050, w: 1800, h: 150, kind: 'castle-wall' },
        { x: 0, y: 0, w: 150, h: 1200, kind: 'castle-wall' },
        { x: 1650, y: 0, w: 150, h: 1200, kind: 'castle-wall' },
        // South wall split to keep a controlled exit door
        { x: 150, y: 1050, w: 680, h: 150, kind: 'castle-wall' },
        { x: 1040, y: 1050, w: 610, h: 150, kind: 'castle-wall' },
        // Two side pillars, floor mostly open for combat
        { x: 420, y: 300, w: 72, h: 72, kind: 'column' },
        { x: 1310, y: 800, w: 72, h: 72, kind: 'column' },
    ],
    exits: [
        {
            id: 'arena-exit',
            label: 'VOLTAR A AREA INFERIOR',
            targetMap: MAP_IDS.CASTLE_LOWER_AREA,
            targetSpawn: 'lower-arena-return',
            x: 900,
            y: 1090,
            radius: 80,
        },
    ],
    structures: [],
};

export const MAPS = {
    [MAP_IDS.MARS_SURFACE]: marsSurfaceMap,
    [MAP_IDS.MARS_CAVE]: marsCaveMap,
    [MAP_IDS.MARS_CORE]: marsCoreMap,
    [MAP_IDS.MARS_CATACOMBS]: marsCatacombsMap,
    [MAP_IDS.CASTLE_HALL]: castleHallMap,
    [MAP_IDS.CASTLE_SIDE_ROOM]: castleSideRoomMap,
    [MAP_IDS.CASTLE_LOWER_AREA]: castleLowerAreaMap,
    [MAP_IDS.CASTLE_BOSS_ARENA]: castleBossArenaMap,
};