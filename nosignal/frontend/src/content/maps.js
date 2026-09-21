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
    CASTLE_PRINCIPAL_ROOM: 'castle-principal-room',
    CASTLE_KING_ROOM: 'castle-king-room',
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

// Distant castle — visual facade comes from castle_sprite.png (see MapRenderer).
// SOLID collision covering the castle facade tightly on the sprite (scale 0.90):
const castleTowerLeft = { id: 'castle-tower-left', x: 3241, y: 71, w: 172, h: 432, kind: 'castle-wall' };
const castleTowerRight = { id: 'castle-tower-right', x: 3884, y: 71, w: 172, h: 432, kind: 'castle-wall' };
const castleKeepTop = { id: 'castle-keep-top', x: 3413, y: 141, w: 472, h: 362, kind: 'castle-wall' };
const castleTurretLeft = { id: 'castle-turret-left', x: 3209, y: 505, w: 178, h: 285, kind: 'castle-wall' };
const castleTurretRight = { id: 'castle-turret-right', x: 3908, y: 505, w: 178, h: 285, kind: 'castle-wall' };
const castlePillarLeft = { id: 'castle-pillar-left', x: 3387, y: 505, w: 198, h: 345, kind: 'castle-wall' };
const castlePillarRight = { id: 'castle-pillar-right', x: 3713, y: 505, w: 198, h: 345, kind: 'castle-wall' };
const castleStairPostLeft = { id: 'castle-stair-post-left', x: 3515, y: 855, w: 58, h: 64, kind: 'castle-wall' };
const castleStairPostRight = { id: 'castle-stair-post-right', x: 3724, y: 855, w: 58, h: 64, kind: 'castle-wall' };
const castleDoorBlock = { id: 'castle-door-block', x: 3595, y: 830, w: 110, h: 20, kind: 'castle-wall' };
const castleCliffBottomLeftParts = [
    // Left-center cliff re-cut as a staircase hugging the castle base: the old
    // box (x3170..3520 / y915..1020) blocked ~55px of empty ground below the
    // mound in x3150..3540 / y997..1031. Each step stops flush with the sprite
    // silhouette (bottom rises 966 -> 996 -> 1018 -> ~1008..1016 as the mound
    // dips through the keep base), keeping the opaque facade solid.
    { id: 'castle-cliff-bot-left-a', x: 3170, y: 915, w: 18, h: 65, kind: 'castle-wall' },
    { id: 'castle-cliff-bot-left-b', x: 3188, y: 915, w: 16, h: 76, kind: 'castle-wall' },
    { id: 'castle-cliff-bot-left-c', x: 3204, y: 915, w: 79, h: 82, kind: 'castle-wall' },
    { id: 'castle-cliff-bot-left-d', x: 3283, y: 915, w: 11, h: 90, kind: 'castle-wall' },
    { id: 'castle-cliff-bot-left-e', x: 3294, y: 915, w: 23, h: 97, kind: 'castle-wall' },
    { id: 'castle-cliff-bot-left-f', x: 3317, y: 915, w: 39, h: 104, kind: 'castle-wall' },
    { id: 'castle-cliff-bot-left-g', x: 3356, y: 915, w: 32, h: 96, kind: 'castle-wall' },
    { id: 'castle-cliff-bot-left-h', x: 3388, y: 915, w: 52, h: 94, kind: 'castle-wall' },
    { id: 'castle-cliff-bot-left-i', x: 3440, y: 915, w: 81, h: 102, kind: 'castle-wall' },
];
const castleCliffBottomRightParts = [
    { id: 'castle-cliff-bottom-right', x: 3725, y: 915, w: 355, h: 105, kind: 'castle-wall' },
    // Solid tip of the cliff against the transparent ground drop (x4080..4105):
    // bottom trimmed from 1020 to the sprite base (~967..976) so the corner
    // ground (x4080..4265) is free on the main-map texture.
    { id: 'castle-cliff-bottom-right-tip', x: 4080, y: 915, w: 18, h: 51, kind: 'castle-wall' },
    { id: 'castle-cliff-bottom-right-tip2', x: 4098, y: 915, w: 7, h: 61, kind: 'castle-wall' },
];
const castleMoundShelfLeft = { id: 'castle-mound-shelf-left', x: 3160, y: 780, w: 360, h: 135, kind: 'castle-wall' };
const castleMoundShelfRight = { id: 'castle-mound-shelf-right', x: 3725, y: 780, w: 390, h: 135, kind: 'castle-wall' };
const castleFlankTopLeft = { id: 'castle-flank-top-left', x: 3110, y: 570, w: 100, h: 160, kind: 'castle-wall' };
const castleFlankMidLeft = { id: 'castle-flank-mid-left', x: 3050, y: 710, w: 120, h: 170, kind: 'castle-wall' };
// Bottom-left flank trimmed to the castle base: no collision jutting left of the
// sprite (x3010..3075) or below its base (y975..1015), so the corner rectangle
// x2990..3150 / y891..1037 is free on the main-map texture.
const castleFlankBotLeft = { id: 'castle-flank-bot-left', x: 3150, y: 830, w: 30, h: 145, kind: 'castle-wall' };
const castleFlankTopRight = { id: 'castle-flank-top-right', x: 4085, y: 570, w: 100, h: 160, kind: 'castle-wall' };
// Mid-right flank ends at x4210: east of that the sprite collapses into a thin
// diagonal tail, so the old box (to x4245) blocked transparent ground slope.
const castleFlankMidRight = { id: 'castle-flank-mid-right', x: 4125, y: 710, w: 85, h: 170, kind: 'castle-wall' };
// Bottom-right flank re-cut as a staircase hugging the castle base: the old box
// (x4115..4290 / y830..1015) blocked ~65px of empty ground to the right and
// below the mound. New boxes keep the opaque slope and drop the overhang.
const castleFlankBotRightParts = [
    { id: 'castle-flank-bot-right-1', x: 4115, y: 830, w: 30, h: 140, kind: 'castle-wall' },
    { id: 'castle-flank-bot-right-2', x: 4145, y: 830, w: 30, h: 112, kind: 'castle-wall' },
    { id: 'castle-flank-bot-right-3', x: 4175, y: 830, w: 30, h: 102, kind: 'castle-wall' },
    { id: 'castle-flank-bot-right-4', x: 4205, y: 830, w: 25, h: 75, kind: 'castle-wall' },
];


// Border rocks framing the world edges (visual + collision)
const surfaceBorderRocks = [
    { x: 0, y: 0, w: 4800, h: 60, kind: 'edge-rock' },
    { x: 0, y: 3140, w: 4800, h: 60, kind: 'edge-rock' },
    { x: 0, y: 0, w: 60, h: 3200, kind: 'edge-rock' },
    { x: 4740, y: 0, w: 60, h: 3200, kind: 'edge-rock' },
];

// Shop NPC — static merchant facade (Map/shop_npc.png) near (1951, 218).
// The sprite is drawn on this obstacle's world rect and the AABB below is its
// solid collision box, so the player (and bullets) cannot walk through it.
const shopNpc = {
    id: 'shop-npc',
    kind: 'npc',
    x: 1951,
    y: 120,
    w: 320,
    h: 288,
    sprite: 'Map/shop_npc.png',
};

// Enemy spaceship — static prop (Map/spaceship_enemy.png) parked on the
// surface. The whole 1371×1148 sprite is drawn scaled to the 450×369 box
// (1.5x do tamanho original 300×246), centrado no mesmo ponto. A colisão
// contorna a silhueta do casco com 20 caixas (ainda menor que o rect de
// desenho, "recortado" de forma natural). Center ≈ (3261, 2050).
const enemySpaceship = {
    id: 'enemy-spaceship',
    kind: 'npc',
    x: 3036,
    y: 1865.5,
    w: 450,
    h: 369,
    collisionBoxes: [
        { dx: 280, dy: 20, w: 60, h: 20 },
        { dx: 240, dy: 40, w: 80, h: 20 },
        { dx: 100, dy: 61, w: 40, h: 20 },
        { dx: 200, dy: 61, w: 120, h: 20 },
        { dx: 60, dy: 81, w: 240, h: 20 },
        { dx: 40, dy: 101, w: 300, h: 20 },
        { dx: 20, dy: 122, w: 420, h: 20 },
        { dx: 100, dy: 142, w: 340, h: 20 },
        { dx: 60, dy: 162, w: 360, h: 20 },
        { dx: 60, dy: 182, w: 380, h: 20 },
        { dx: 60, dy: 203, w: 380, h: 20 },
        { dx: 40, dy: 223, w: 400, h: 20 },
        { dx: 40, dy: 243, w: 400, h: 20 },
        { dx: 20, dy: 284, w: 300, h: 20 },
        { dx: 340, dy: 284, w: 100, h: 20 },
        { dx: 0, dy: 304, w: 260, h: 20 },
        { dx: 360, dy: 304, w: 60, h: 20 },
        { dx: 0, dy: 324, w: 240, h: 20 },
        { dx: 360, dy: 324, w: 20, h: 20 },
        { dx: 0, dy: 344, w: 140, h: 20 },
    ],
    sprite: 'Map/spaceship_enemy.png',
};

// Mission spaceship — prop amigável (Map/spaceship_mission.png) pairando em
// cima do spawn inicial da superfície. Desenhada SEM crop (o sprite ocupa quase
// todo o canvas 1754×896; recortar cortava o bico), num pouco abaixo do fator
// de escala da nave inimiga: 1754×896 × 0.36 ≈ 631×323. Colisão também
// contornada na silhueta: 14 caixas recortando as margens do quadrado.
const missionSpaceship = {
    id: 'mission-spaceship',
    kind: 'npc',
    x: 154,
    y: 337,
    w: 631,
    h: 323,
    collisionBoxes: [
        { dx: 423, dy: 40, w: 181, h: 20 },
        { dx: 363, dy: 61, w: 242, h: 20 },
        { dx: 322, dy: 81, w: 282, h: 20 },
        { dx: 242, dy: 101, w: 363, h: 20 },
        { dx: 181, dy: 121, w: 443, h: 20 },
        { dx: 141, dy: 141, w: 484, h: 20 },
        { dx: 101, dy: 162, w: 524, h: 20 },
        { dx: 101, dy: 182, w: 484, h: 20 },
        { dx: 60, dy: 202, w: 484, h: 20 },
        { dx: 40, dy: 222, w: 484, h: 20 },
        { dx: 20, dy: 242, w: 443, h: 20 },
        { dx: 20, dy: 262, w: 383, h: 20 },
        { dx: 60, dy: 283, w: 282, h: 20 },
        { dx: 121, dy: 303, w: 141, h: 20 },
    ],
    sprite: 'Map/spaceship_mission.png',
};


export const marsSurfaceMap = {
    id: MAP_IDS.MARS_SURFACE,
    type: 'surface',
    width: 4800,
    height: 3200,
    tileSize: TILE,
    dust: true,
    spawn: { x: 470, y: 700 },
    spawnPoints: {
        'mars-start': { x: 470, y: 700 },
        'cave-return': { x: 1615, y: 1500 },
        'castle-return': { x: 3650, y: 895 },
    },
    // Free-movement bands: the rectangle is excavated from every obstacle that
    // crosses it (expanded by the player's half-size so the whole body passes
    // while the center is inside), leaving a collision-free floor corridor.
    // Here: cave floor corridor x1425..1831 / y1354..1382.
    freeMoveZones: [{ x: 1425, y: 1354, w: 406, h: 28 }],
    obstacles: [
        ...surfaceBorderRocks,
        shopNpc,
        enemySpaceship,
        missionSpaceship,
        caveRockOuterLeft,
        cavePillarLeft,
        caveArchTop,
        caveWallRight,
        cavePropsRight,
        caveEntranceLip,
        caveSolarPanel,
        caveRockRight,
        castleTowerLeft,
        castleTowerRight,
        castleKeepTop,
        castleTurretLeft,
        castleTurretRight,
        castlePillarLeft,
        castlePillarRight,
        castleStairPostLeft,
        castleStairPostRight,
        castleDoorBlock,
        ...castleCliffBottomLeftParts,
        ...castleCliffBottomRightParts,
        castleMoundShelfLeft,
        castleMoundShelfRight,
        castleFlankTopLeft,
        castleFlankMidLeft,
        castleFlankBotLeft,
        castleFlankTopRight,
        castleFlankMidRight,
        ...castleFlankBotRightParts,
    ],
    exits: [
        {
            id: 'cave-entrance',
            label: 'ENTRAR NA CAVERNA',
            targetMap: MAP_IDS.MARS_CAVE,
            targetSpawn: 'cave-entry',
            // Rectangular trigger aligned with the dark cave-mouth opening of
            // cavern_entrance.png (world x1567..1667 from the corridor, y1200..1380).
            area: { x: 1567, y: 1200, w: 100, h: 180 },
        },
        {
            id: 'castle-gate',
            label: 'ENTRAR NO CASTELO',
            targetMap: MAP_IDS.CASTLE_PRINCIPAL_ROOM,
            targetSpawn: 'castle-principal-entry',
            x: 3650,
            y: 865,
            radius: 75,
            area: { x: 3570, y: 840, w: 160, h: 75 },
            promptX: 3650,
            promptY: 790,
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

/* ─────────────── Sprite-cavern maps (Núcleo + Catacumbas) ───────────────
 * Both maps are a single pre-composed PNG (pure black background + the whole
 * cave artwork) drawn 1:1 at world (0,0) by MapRenderer's `sprite-cavern`
 * path. Collisions do NOT come from the pixels: each map carries its own
 * walkability mask (cell = CAVERN_CELL) derived from the artwork and reviewed
 * cell by cell. '.' = walkable floor, '#' = solid (black background + rock
 * walls/shadows). AABBs are generated from the mask — one per contiguous
 * blocked run per row — so the existing collisionSystem keeps working
 * unchanged, and bullets stop on the same geometry.                          */

const CAVERN_CELL = 32;

// Núcleo de Marte — artwork 1536×1024 → 48×32 cells (exact). A single connected
// navigable region; the west mouth (rows 13..16, col 6) is the only entrance.
// Dark rock/shadows inside the chamber stay solid.
const NUCLEO_MASK = [
    '################################################',
    '################################################',
    '################################################',
    '################################################',
    '################################################',
    '################################################',
    '##########################.....#################',
    '########################.......##.....##########',
    '#######################...............##########',
    '#######################.................########',
    '###################...................#.########',
    '###################...................##########',
    '##########...##.........................########',
    '######..#..............................#########',
    '######.................................###.#####',
    '######.................................###.#####',
    '######.....................................#####',
    '#########..................................#####',
    '############..............................######',
    '###############..........................#######',
    '################.........................#######',
    '################........................########',
    '#####################..............#############',
    '#####################..............#############',
    '#######################...........##############',
    '########################........################',
    '#########################.......################',
    '#########################.#.....################',
    '################################################',
    '################################################',
    '################################################',
    '################################################',
];

// Catacumbas Marcianas — artwork 1254×1254 → 39×39 cells (last cell extended
// to 1254). One connected navigable region opening on the west mouth
// (rows 17..19). Only the real floor is walkable.
const CATACOMBS_MASK = [
    '#######################################',
    '#######################################',
    '#######################################',
    '#######################################',
    '#######################################',
    '#######################################',
    '#####################...###############',
    '###################......##############',
    '##################..........###########',
    '################..............#########',
    '###############................########',
    '##############....................#..##',
    '############........................###',
    '###########..........................##',
    '#########............................##',
    '########.............................##',
    '####.##...............................#',
    '#.....................................#',
    '#....................................##',
    '#....................................##',
    '###.................................###',
    '#####..............................####',
    '#######............................####',
    '#########.........................#####',
    '##########.........................####',
    '###########.........................###',
    '############.......................####',
    '#############.#....................####',
    '################..................#####',
    '################..............#########',
    '##################..........#.#########',
    '###################........############',
    '###################.......#############',
    '####################.##.###############',
    '#######################################',
    '#######################################',
    '#######################################',
    '#######################################',
    '#######################################',
];

// Merge every contiguous run of solid cells (per row) into one AABB. The final
// partial column/row is extended to the real map edge, since the mask only
// covers floor(width / cell) cells.
function cavernObstacles(mask, cell, mapWidth, mapHeight) {
    const rects = [];
    const rows = mask.length;
    const cols = mask[0].length;
    for (let r = 0; r < rows; r++) {
        let c = 0;
        while (c < cols) {
            if (mask[r][c] === '.') {
                c++;
                continue;
            }
            let c2 = c;
            while (c2 < cols && mask[r][c2] !== '.') c2++;
            const x = c * cell;
            const x2 = c2 >= cols ? mapWidth : c2 * cell;
            const y = r * cell;
            const y2 = r === rows - 1 ? mapHeight : (r + 1) * cell;
            rects.push({ x, y, w: x2 - x, h: y2 - y, kind: 'undead-rock' });
c = c2;
        }
    }
    return rects;
}

export const marsCoreMap = {
    id: MAP_IDS.MARS_CORE,
    type: 'sprite-cavern',
    width: 1536,
    height: 1024,
    tileSize: TILE,
    dust: false,
    spawn: { x: 368, y: 496 },
    spawnPoints: {
        'core-entry': { x: 368, y: 496 },
    },
    // Walkability mask + generated AABBs (collision-only; never rendered).
    terrainMask: NUCLEO_MASK,
    maskCell: CAVERN_CELL,
    obstacles: cavernObstacles(NUCLEO_MASK, CAVERN_CELL, 1536, 1024),
    exits: [
        {
            id: 'core-return',
            label: 'SAIR DO NÚCLEO',
            targetMap: MAP_IDS.MARS_SURFACE,
            targetSpawn: 'cave-return',
            x: 240,
            y: 496,
            radius: 48,
            promptY: 481,
        },
    ],
    structures: [],
    decorations: [],
};

const CATACOMBS_OBJECTS_DIR =
    './Cavern/Catacombs Objects/';

// ── Braços mortos na lateral noroeste (parede diagonal do topo-esquerda
//     até a entrada oeste). 6–9 braços, alternando variantes. ──
const CATACOMBS_NORTHWEST_ARMS = [
    // zona superior próxima ao Lich
    {
        x: 592,
        y: 240,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_2.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
    },
    // zona intermediária superior
    {
        x: 496,
        y: 304,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_3.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
    },
    // zona intermediária inferior
    {
        x: 464,
        y: 336,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_2.png`,
        layer: 'front',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 432,
        y: 368,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_1.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
    },
    // zona inferior
    {
        x: 368,
        y: 400,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_3.png`,
        layer: 'front',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 336,
        y: 432,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_2.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
    },
    // ── Braços na parede inferior esquerda da caverna ──
    {
        x: 180,
        y: 682,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_1.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 244,
        y: 714,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_3.png`,
        layer: 'front',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 404,
        y: 842,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_2.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
    },
    ];

// ── Segunda área de decoração: braços e espinhos colados na parede
//     inferior esquerda (entre os braços já posicionados), mais os dois
//     afloramentos de rocha isolados no piso (col 14 e col 28 da máscara). ──
const CATACOMBS_LOWER_AND_SIDE_OBJECTS = [
    // gap entre (244,714) e (404,842) — parede diagonal
    {
        x: 272,
        y: 752,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_2.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 308,
        y: 786,
        sprite: `${CATACOMBS_OBJECTS_DIR}Thorn_plant_1.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 340,
        y: 816,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_1.png`,
        layer: 'front',
        anchor: 'bottom-center',
        scale: 1,
    },
    // afloramento de rocha isolado (col 14, x 448–480)
    {
        x: 462,
        y: 878,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_3.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
    },
    // parede inferior esquerda, logo abaixo de (500,874)
    {
        x: 495,
        y: 902,
        sprite: `${CATACOMBS_OBJECTS_DIR}Thorn_plant_1.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 508,
        y: 938,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_2.png`,
        layer: 'front',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 556,
        y: 978,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_1.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
    },
    

];

const catacombsObjects = [
    // Lich — área superior central, encostado à parede norte.
    {
        x: 710,
        y: 250,
        sprite: `${CATACOMBS_OBJECTS_DIR}lich.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1.5,
    },

    // ── Grupo esquerdo (x: 535–625, y: 170–270) ──
    {
        x: 555,
        y: 205,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_1.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 595,
        y: 235,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_2.png`,
        layer: 'front',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 535,
        y: 255,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_3.png`,
        layer: 'front',
        anchor: 'bottom-center',
        scale: 1,
    },

    {
        x: 592,
        y: 224,
        sprite: `${CATACOMBS_OBJECTS_DIR}Thorn_plant_1.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
    },

    // ── Grupo direito (x: 800–890, y: 170–270) ──
    {
        x: 825,
        y: 205,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_2.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 857,
        y: 240,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_3.png`,
        layer: 'front',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 805,
        y: 252,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_1.png`,
        layer: 'front',
        anchor: 'bottom-center',
        scale: 1,
    },

];

export const marsCatacombsMap = {
    id: MAP_IDS.MARS_CATACOMBS,
    type: 'sprite-cavern',
    width: 1254,
    height: 1254,
    tileSize: TILE,
    dust: false,
    spawn: { x: 360, y: 592 },
    spawnPoints: {
        'catacombs-entry': { x: 360, y: 592 },
    },
    terrainMask: CATACOMBS_MASK,
    maskCell: CAVERN_CELL,
    obstacles: cavernObstacles(CATACOMBS_MASK, CAVERN_CELL, 1254, 1254),
    exits: [
        {
            id: 'catacombs-return',
            label: 'SAIR DAS CATACUMBAS',
            targetMap: MAP_IDS.MARS_SURFACE,
            targetSpawn: 'cave-return',
            x: 91,
            y: 573,
            radius: 48,
            promptY: 588,
        },
    ],
    structures: [],
    decorations: [
        ...catacombsObjects,
        ...CATACOMBS_NORTHWEST_ARMS,
        ...CATACOMBS_LOWER_AND_SIDE_OBJECTS,
    ],
};

/* ─────────────── Mapas do castelo (sprite, colisão precisa) ───────────────
 * Cada mapa é um único PNG pré-composto (tipo sprite-castle), desenhado 1:1 na
 * origem do mundo pelo MapRenderer. As colisões são retângulos AABB escritos à
 * mão em coordenadas LOCAIS (espaço do mundo desta sala 1790x879), sem mascaras:
 *   - a borda preta ao redor do sprite é totalmente bloqueada (o jogador fica
 *     dentro da arte),
 *   - a faixa da parede do topo é sólida, exceto o vão da porta alinhado ao
 *     desenho da porta,
 *   - interações de porta usam áreas retangulares com prompt explícito,
 *   - os spawns são locais (dentro da sala); respawns nunca reutilizam coords
 *     da superfície.
 * Caixas de base de pilares/móveis podem ser adicionadas em 'obstacles'
 * (kind 'castle-pillar') medidas a partir da arte; valide com o overlay de
 * colisão (SHOW_CASTLE_COLLISION_DEBUG no GameEngine).
 * ─────────────────────────────────────────────────────────────────────── */

export const castlePrincipalRoomMap = {
    id: MAP_IDS.CASTLE_PRINCIPAL_ROOM,
    type: 'sprite-castle',
    width: 1790,
    height: 879,
    tileSize: TILE,
    dust: false,
coordinateSpace: 'local',
    spawn: { x: 735, y: 599 },
    spawnPoints: {
        'castle-principal-entry': { x: 735, y: 599 },
        'castle-principal-south-entry': { x: 732, y: 650 },
        'castle-return': { x: 735, y: 599 },
    },
    obstacles: [
        // Parede esquerda contínua: bloqueia a partir de X <= 109 para qualquer Y.
        { x: 0, y: 0, w: 109, h: 879, kind: 'castle-wall' },
        // Parede direita contínua: bloqueia a partir de X >= 1690 para qualquer Y.
        { x: 1690, y: 0, w: 100, h: 879, kind: 'castle-wall' },
        // Parede superior contínua cobrindo toda a extensão superior (sem corte da porta).
        { x: 0, y: 0, w: 1790, h: 210, kind: 'castle-wall' },
        // Parede inferior contínua: bloqueia a partir de Y >= 704 para qualquer X.
        { x: 0, y: 704, w: 1790, h: 175, kind: 'castle-wall' },
        // Divisória vertical de alvenaria (parede de tijolos vermelhos no topo direito)
        { x: 1245, y: 150, w: 60, h: 245, kind: 'castle-wall' },
        // Área contínua das 4 cadeiras encostadas na divisória (sem recortes/vãos intermediários)
        { x: 1305, y: 240, w: 180, h: 125, kind: 'castle-pillar' },
        // Mesa de madeira inferior direita com pergaminhos
        { x: 1405, y: 665, w: 180, h: 40, kind: 'castle-pillar' },
        // Estante de pergaminhos na parede direita (X: 1657)
        { x: 1630, y: 385, w: 60, h: 140, kind: 'castle-pillar' },
        // Pilares duplos de banner (canto inferior direito)
        { x: 1195, y: 575, w: 115, h: 129, kind: 'castle-pillar' },
        // Pilar decorativo de banner superior esquerdo
        { x: 130, y: 210, w: 60, h: 90, kind: 'castle-pillar' },
        // Pilar decorativo de banner superior direito
        { x: 1150, y: 210, w: 60, h: 90, kind: 'castle-pillar' },
    ],
    exits: [
        {
            id: 'principal-to-king',
            label: 'ENTRAR NA SALA DO REI',
            targetMap: MAP_IDS.CASTLE_KING_ROOM,
            targetSpawn: 'castle-king-entry',
            area: { x: 1450, y: 195, w: 160, h: 125 },
            promptX: 1557,
            promptY: 168,
        },
        {
            id: 'castle-principal-exit',
            label: 'SAIR DO CASTELO',
            targetMap: MAP_IDS.MARS_SURFACE,
            targetSpawn: 'castle-return',
            area: { x: 562, y: 640, w: 340, h: 120 },
            promptX: 732,
            promptY: 750,
        },
    ],
    structures: [],
    decorations: [],
};

export const castleKingRoomMap = {
    id: MAP_IDS.CASTLE_KING_ROOM,
    type: 'sprite-castle',
    width: 1790,
    height: 879,
    tileSize: TILE,
    dust: false,
    coordinateSpace: 'local',
    spawn: { x: 1530, y: 260 },
    spawnPoints: {
        'castle-king-entry': { x: 1530, y: 260 },
    },
    obstacles: [
        // Borda preta do sprite (moldura ao redor da sala desenhada).
        { x: 0, y: 0, w: 32, h: 879, kind: 'castle-wall' },
        { x: 1754, y: 0, w: 36, h: 879, kind: 'castle-wall' },
        // Parede superior contínua cobrindo toda a extensão superior (inclusive sobre a porta).
        { x: 0, y: 0, w: 1790, h: 210, kind: 'castle-wall' },
        // Parede inferior contínua impedindo a passagem abaixo de y=697 (independente do X).
        { x: 0, y: 697, w: 1790, h: 182, kind: 'castle-wall' },
        // Caixas de colisão de elementos decorativos do trono/baú/grades.
        { x: 650, y: 220, w: 130, h: 180, kind: 'castle-pillar' },
        { x: 595, y: 185, w: 45, h: 35, kind: 'castle-pillar' },
        { x: 115, y: 250, w: 90, h: 447, kind: 'castle-wall' },
    ],
    exits: [
        {
            id: 'king-to-principal',
            label: 'VOLTAR À SALA PRINCIPAL',
            targetMap: MAP_IDS.CASTLE_PRINCIPAL_ROOM,
            targetSpawn: 'castle-principal-entry',
            area: { x: 1450, y: 195, w: 160, h: 125 },
            promptX: 1530,
            promptY: 186,
        },
    ],
    structures: [],
    decorations: [],
};

export const MAPS = {
    [MAP_IDS.MARS_SURFACE]: marsSurfaceMap,
    [MAP_IDS.MARS_CAVE]: marsCaveMap,
    [MAP_IDS.MARS_CORE]: marsCoreMap,
    [MAP_IDS.MARS_CATACOMBS]: marsCatacombsMap,
    [MAP_IDS.CASTLE_PRINCIPAL_ROOM]: castlePrincipalRoomMap,
    [MAP_IDS.CASTLE_KING_ROOM]: castleKingRoomMap,
};
