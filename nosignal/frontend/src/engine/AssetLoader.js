/**
 * AssetLoader.js
 * Preloads sprite PNG frames from metadata.json.
 * Guarantees crisp pixel art rendering without smoothing.
 *
 * All three characters are loaded and kept resident at the same time, each in
 * its own image cache, so the player, allies and enemies can use different
 * characters simultaneously. Frame queries are per-character:
 *   assetLoader.getFrame(animName, direction, frameIndex, characterId)
 *   assetLoader.getFrameCount(animName, direction, characterId)
 */

import { getCharacter, CHARACTERS } from '../content/characters.js';

export class AssetLoader {
    constructor() {
        // characterId -> { metadata, images: Map<string, HTMLImageElement> }
        this.characters = new Map();
        this._metadataPromises = new Map();
        this.primaryCharacterId = null;
        this.totalAssets = 0;
        this.loadedAssets = 0;
        this.isLoaded = false;
    }

    _entry(characterId) {
        if (!this.characters.has(characterId)) {
            this.characters.set(characterId, { metadata: null, images: new Map() });
        }
        return this.characters.get(characterId);
    }

    async loadMetadata(characterId = null) {
        const profile = getCharacter(characterId);
        const entry = this._entry(profile.id);
        if (entry.metadata) return entry.metadata;
        if (!this._metadataPromises.has(profile.id)) {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
            const promise = fetch(profile.metadataPath, { signal: controller ? controller.signal : undefined })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`Failed to load sprite metadata: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then((metadata) => {
                    entry.metadata = metadata;
                    return metadata;
                })
                .finally(() => {
                    if (timer) clearTimeout(timer);
                });
            this._metadataPromises.set(profile.id, promise);
        }
        return this._metadataPromises.get(profile.id);
    }

    _buildQueue(profile, metadata) {
        const queue = [];
        const state = metadata.states[0];
        const basePath = profile.assetBasePath;

        // 1. Static Rotations
        if (state.frames && state.frames.rotations) {
            for (const [dir, relPath] of Object.entries(state.frames.rotations)) {
                queue.push({ key: `rotations/${dir}`, url: basePath + relPath });
            }
        }

        // 2. Animations
        if (state.frames && state.frames.animations) {
            for (const [animName, directions] of Object.entries(state.frames.animations)) {
                for (const [dir, framePaths] of Object.entries(directions)) {
                    framePaths.forEach((framePath, index) => {
                        queue.push({
                            key: `animations/${animName}/${dir}/${index}`,
                            url: basePath + framePath
                        });
                    });
                }
            }
        }

        return queue;
    }

    async preloadAll(onProgress = null, characterId = null) {
        const ids = Object.keys(CHARACTERS);
        const primary = characterId && CHARACTERS[characterId] ? characterId : ids[0];
        this.primaryCharacterId = primary;
        const ordered = [primary, ...ids.filter((id) => id !== primary)];

        const allReady = ordered.every((id) => {
            const entry = this.characters.get(id);
            return entry && entry.metadata && entry.images.size > 0;
        });
        if (this.isLoaded && allReady) {
            if (onProgress) onProgress(1.0, this.loadedAssets, this.totalAssets);
            return this;
        }

        // Collect every character's load queue first so progress can be
        // reported against the combined total.
        const jobs = [];
        let total = 0;
        for (const id of ordered) {
            const profile = getCharacter(id);
            const metadata = await this.loadMetadata(id);
            const queue = this._buildQueue(profile, metadata);
            total += queue.length;
            jobs.push({ id, queue });
        }

        this.totalAssets = total;
        this.loadedAssets = 0;
        if (onProgress) onProgress(0, 0, total);

        const batchSize = 16;
        for (const job of jobs) {
            const entry = this._entry(job.id);
            for (let i = 0; i < job.queue.length; i += batchSize) {
                const batch = job.queue.slice(i, i + batchSize);
                await Promise.all(batch.map((item) => this._loadImage(entry, item.key, item.url)));
                if (onProgress) {
                    onProgress(this.loadedAssets / this.totalAssets, this.loadedAssets, this.totalAssets);
                }
            }
        }

        this.isLoaded = true;
        return this;
    }

    _loadImage(entry, key, url) {
        return new Promise((resolve) => {
            const img = new Image();
            let settled = false;
            const done = (result) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(result);
            };
            // Watchdog: um sprite que travar (sem load nem error) não pode
            // deixar a tela de loading pendurada para sempre.
            const timer = setTimeout(() => {
                if (!settled) {
                    console.warn(`[AssetLoader] Sprite demorou demais para carregar (timeout): ${url}`);
                    this.loadedAssets++;
                    done(null);
                }
            }, 15000);
            img.onload = () => {
                entry.images.set(key, img);
                this.loadedAssets++;
                done(img);
            };
            img.onerror = () => {
                console.warn(`[AssetLoader] Could not load sprite: ${url}`);
                this.loadedAssets++;
                done(null);
            };
            img.src = url;
        });
    }

    _resolveCharacterId(characterId) {
        return characterId || this.primaryCharacterId || getCharacter(null).id;
    }

    getFrame(animName, direction, frameIndex, characterId = null) {
        const entry = this._entry(this._resolveCharacterId(characterId));
        return entry.images.get(`animations/${animName}/${direction}/${frameIndex}`) || null;
    }

    getRotation(direction, characterId = null) {
        const entry = this._entry(this._resolveCharacterId(characterId));
        return entry.images.get(`rotations/${direction}`) || null;
    }

    getFrameCount(animName, direction, characterId = null) {
        const entry = this._entry(this._resolveCharacterId(characterId));
        if (!entry.metadata) return 0;
        try {
            return entry.metadata.states[0].frames.animations[animName][direction].length;
        } catch {
            return 0;
        }
    }
}

export const assetLoader = new AssetLoader();
