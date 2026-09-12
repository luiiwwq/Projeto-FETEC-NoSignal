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

const surfaceRocks = [
    { x: 280, y: 1360, w: 84, h: 84, kind: 'rock' },
    { x: 760, y: 1180, w: 64, h: 64, kind: 'rock' },
    { x: 900, y: 560, w: 96, h: 96, kind: 'rock' },
    { x: 1180, y: 1540, w: 72, h: 72, kind: 'rock' },
    { x: 1300, y: 420, w: 88, h: 88, kind: 'rock' },
    { x: 1980, y: 840, w: 104, h: 104, kind: 'rock' },
    { x: 2240, y: 1500, w: 80, h: 80, kind: 'rock' },
    { x: 2520, y: 540, w: 92, h: 92, kind: 'rock' },
    { x: 2760, y: 1180, w: 110, h: 110, kind: 'rock' },
    { x: 3000, y: 1850, w: 76, h: 76, kind: 'rock' },
    { x: 3320, y: 400, w: 86, h: 86, kind: 'rock' },
    { x: 3920, y: 1280, w: 98, h: 98, kind: 'rock' },
    { x: 4240, y: 640, w: 84, h: 84, kind: 'rock' },
    { x: 4520, y: 2100, w: 102, h: 102, kind: 'rock' },
];

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
        ...surfaceRocks,
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
    [MAP_IDS.CASTLE_HALL]: castleHallMap,
    [MAP_IDS.CASTLE_SIDE_ROOM]: castleSideRoomMap,
    [MAP_IDS.CASTLE_LOWER_AREA]: castleLowerAreaMap,
    [MAP_IDS.CASTLE_BOSS_ARENA]: castleBossArenaMap,
};