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
const castleCliffBottomLeft = { id: 'castle-cliff-bottom-left', x: 3170, y: 915, w: 350, h: 105, kind: 'castle-wall' };
const castleCliffBottomRight = { id: 'castle-cliff-bottom-right', x: 3725, y: 915, w: 380, h: 105, kind: 'castle-wall' };
const castleMoundShelfLeft = { id: 'castle-mound-shelf-left', x: 3160, y: 780, w: 360, h: 135, kind: 'castle-wall' };
const castleMoundShelfRight = { id: 'castle-mound-shelf-right', x: 3725, y: 780, w: 390, h: 135, kind: 'castle-wall' };
const castleFlankTopLeft = { id: 'castle-flank-top-left', x: 3110, y: 570, w: 100, h: 160, kind: 'castle-wall' };
const castleFlankMidLeft = { id: 'castle-flank-mid-left', x: 3050, y: 710, w: 120, h: 170, kind: 'castle-wall' };
const castleFlankBotLeft = { id: 'castle-flank-bot-left', x: 3010, y: 830, w: 170, h: 185, kind: 'castle-wall' };
const castleFlankTopRight = { id: 'castle-flank-top-right', x: 4085, y: 570, w: 100, h: 160, kind: 'castle-wall' };
const castleFlankMidRight = { id: 'castle-flank-mid-right', x: 4125, y: 710, w: 120, h: 170, kind: 'castle-wall' };
const castleFlankBotRight = { id: 'castle-flank-bot-right', x: 4115, y: 830, w: 175, h: 185, kind: 'castle-wall' };


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

// Enemy spaceship — static prop (Map/enemie_spaceship.png) parked on the
// surface. The sprite is 1024×1024 with transparent margins; `source` crops to
// the opaque hull (694×570) and it is scaled down to roughly the shop NPC size
// (300×246) so the AABB below is small and tight. Center ≈ (3261, 2050).
const enemySpaceship = {
    id: 'enemy-spaceship',
    kind: 'npc',
    x: 3111,
    y: 1927,
    w: 300,
    h: 246,
    source: { x: 157, y: 204, w: 694, h: 570 },
    sprite: 'Map/enemie_spaceship.png',
};


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
        castleCliffBottomLeft,
        castleCliffBottomRight,
        castleMoundShelfLeft,
        castleMoundShelfRight,
        castleFlankTopLeft,
        castleFlankMidLeft,
        castleFlankBotLeft,
        castleFlankTopRight,
        castleFlankMidRight,
        castleFlankBotRight,
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
            targetMap: MAP_IDS.CASTLE_HALL,
            targetSpawn: 'hall-entry',
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
    '###################......##....########',
    '##################............#########',
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

const catacombsObjects = [
    // Lich — área superior central, encostado à parede norte.
    {
        x: 700,
        y: 250,
        sprite: `${CATACOMBS_OBJECTS_DIR}lich.png`,
        layer: 'back',
        anchor: 'bottom-center',
        scale: 1,
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
        x: 580,
        y: 270,
        sprite: `${CATACOMBS_OBJECTS_DIR}pile_skulls.png`,
        layer: 'front',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 625,
        y: 220,
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
        x: 865,
        y: 240,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_3.png`,
        layer: 'front',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 805,
        y: 260,
        sprite: `${CATACOMBS_OBJECTS_DIR}Dead_arm_1.png`,
        layer: 'front',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 850,
        y: 275,
        sprite: `${CATACOMBS_OBJECTS_DIR}pile_skulls.png`,
        layer: 'front',
        anchor: 'bottom-center',
        scale: 1,
    },
    {
        x: 895,
        y: 215,
        sprite: `${CATACOMBS_OBJECTS_DIR}Thorn_plant_2.png`,
        layer: 'back',
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
    decorations: catacombsObjects,
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
