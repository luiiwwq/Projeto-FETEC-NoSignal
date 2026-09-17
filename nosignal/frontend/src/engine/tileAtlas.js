/**
 * tileAtlas.js
 * Registry of expected tile sprite sheets for the map renderer.
 *
 * The renderer proceeds procedurally whenever a sheet is not available;
 * this module is the seam where real pixel-art PNGs hook in later. No PNG
 * asset exists yet, so `isReady()` returns false and `missingAssets()`
 * lists the exact files still to be created.
 *
 * Expected layout: each sheet is a grid of square frames.
 *   - *_16.png  → 16x16 frames (ground/detail micro-tiles)
 *   - *_props.png → 64x64 frames (rocks, cave formation, tower, crystal)
 */

export const EXPECTED_TILESETS = [
    {
        key: 'surface-ground',
        path: './src/assets/tiles/surface-ground-16.png',
        frameW: 16,
        frameH: 16,
        layers: ['ground'],
    },
    {
        key: 'surface-detail',
        path: './src/assets/tiles/surface-detail-16.png',
        frameW: 16,
        frameH: 16,
        layers: ['detail'],
    },
    {
        key: 'surface-props',
        path: './src/assets/tiles/surface-props-64.png',
        frameW: 64,
        frameH: 64,
        layers: ['props'],
    },
    {
        key: 'cave-tiles',
        path: './src/assets/tiles/cave-tiles-16.png',
        frameW: 16,
        frameH: 16,
        layers: ['ground', 'detail'],
    },
    {
        key: 'castle-tiles',
        path: './src/assets/tiles/castle-tiles-16.png',
        frameW: 16,
        frameH: 16,
        layers: ['ground', 'detail'],
    },
];

class TileAtlas {
    constructor() {
        this._frames = new Map();   // "sheetKey:tileId" → {image, frameW, frameH, rows, cols}
        this._ready = new Set();    // sheet keys fully loaded
    }

    /**
     * Register a fully-loaded sheet. frameIndex is a zero-based index into
     * the sheet grid; tileId is the logical tile name from content/tilemap.js.
     */
    registerFrame(sheetKey, tileId, image, frameW, frameH, cols, rows) {
        if (!this._frames.has(sheetKey)) {
            this._frames.set(sheetKey, { image, frameW, frameH, cols, rows });
            this._ready.add(sheetKey);
        }
        this._frames.set(`${sheetKey}:${tileId}`, image);
    }

    isReady(sheetKey) {
        return this._ready.has(sheetKey);
    }

    /**
     * Returns the loaded sprite (or null) for a sheet+tileId. The renderer
     * falls back to procedural drawing when null.
     */
    spriteFor(sheetKey, tileId) {
        return this._frames.get(`${sheetKey}:${tileId}`) || null;
    }

    /** Files still missing and therefore rendered procedurally for now. */
    missingAssets() {
        return EXPECTED_TILESETS.filter((ts) => !this._ready.has(ts.key)).map((ts) => ts.path);
    }
}

export const tileAtlas = new TileAtlas();

export { EXPECTED_TILESETS as EXPECTED_TILE_ASSETS };