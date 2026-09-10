/**
 * AssetLoader.js
 * Preloads all sprite PNG frames from metadata.json.
 * Guarantees crisp pixel art rendering without smoothing.
 */

export class AssetLoader {
    constructor() {
        this.images = new Map();
        this.metadata = null;
        this.totalAssets = 0;
        this.loadedAssets = 0;
        this.isLoaded = false;
    }

    async loadMetadata() {
        if (this.metadata) return this.metadata;
        const response = await fetch('./src/assets/sprites/metadata.json');
        if (!response.ok) {
            throw new Error(`Failed to load sprite metadata: ${response.statusText}`);
        }
        this.metadata = await response.json();
        return this.metadata;
    }

    async preloadAll(onProgress = null) {
        if (this.isLoaded) {
            if (onProgress) onProgress(1.0, this.loadedAssets, this.totalAssets);
            return this;
        }

        await this.loadMetadata();

        const state = this.metadata.states[0];
        const basePath = './src/assets/sprites/';
        const queue = [];

        // 1. Static Rotations
        if (state.frames && state.frames.rotations) {
            for (const [dir, relPath] of Object.entries(state.frames.rotations)) {
                queue.push({
                    key: `rotations/${dir}`,
                    url: basePath + relPath
                });
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

        this.totalAssets = queue.length;
        this.loadedAssets = 0;

        // Concurrency batching for fast and reliable loading
        const batchSize = 16;
        for (let i = 0; i < queue.length; i += batchSize) {
            const batch = queue.slice(i, i + batchSize);
            await Promise.all(batch.map(item => this._loadImage(item.key, item.url)));
            if (onProgress) {
                onProgress(this.loadedAssets / this.totalAssets, this.loadedAssets, this.totalAssets);
            }
        }

        this.isLoaded = true;
        return this;
    }

    _loadImage(key, url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.images.set(key, img);
                this.loadedAssets++;
                resolve(img);
            };
            img.onerror = () => {
                console.warn(`[AssetLoader] Could not load sprite: ${url}`);
                this.loadedAssets++;
                resolve(null);
            };
            img.src = url;
        });
    }

    getFrame(animName, direction, frameIndex) {
        return this.images.get(`animations/${animName}/${direction}/${frameIndex}`) || null;
    }

    getRotation(direction) {
        return this.images.get(`rotations/${direction}`) || null;
    }

    getFrameCount(animName, direction) {
        if (!this.metadata) return 0;
        const state = this.metadata.states[0];
        try {
            return state.frames.animations[animName][direction].length;
        } catch {
            return 0;
        }
    }
}

export const assetLoader = new AssetLoader();
