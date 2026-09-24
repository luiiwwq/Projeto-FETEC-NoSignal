import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '../src/engine/GameEngine.js';
import { MAP_IDS } from '../src/content/maps.js';
import { saveSettings } from '../src/state/stateStorage.js';
import { gameState } from '../src/state/gameState.js';
import { pauseBossMusic, resumeBossMusic, setBossMusicVolume, stopBossMusic } from '../src/audio/bossMusic.js';
import { stopGameMusic } from '../src/audio/gameMusic.js';

test('catacumbas usam trilha a 60% e devolvem a música ambiente ao sair ou eliminar os esqueletos', async () => {
    const originalAudio = globalThis.Audio;
    const originalWindow = globalThis.window;
    const originalCleared = gameState.catacombsCleared;
    const originalRespawn = gameState.catacombsRespawnRemaining;
    const originalWave = gameState.catacombsWaveActive;
    const tracks = [];
    globalThis.Audio = class {
        constructor(src) {
            this.src = src;
            this.paused = true;
            tracks.push(this);
        }
        addEventListener() {}
        play() { this.paused = false; }
        pause() { this.paused = true; }
    };
    try {
        saveSettings({ musicVolume: 100 });
        gameState.catacombsCleared = false;
        gameState.catacombsRespawnRemaining = null;
        gameState.catacombsWaveActive = false;
        const engine = new GameEngine(null);
        engine._loadMap = (mapId) => {
            engine.currentMapId = mapId;
            engine._catacombsSkeletonsActive = mapId === MAP_IDS.MARS_CATACOMBS && !gameState.catacombsCleared;
        };

        await engine.changeMap(MAP_IDS.MARS_CATACOMBS, 'catacombs-entry');
        const combat = tracks.at(-1);
        assert.match(combat.src, /skeleton catacombs\/audio_combat\.mp3$/);
        assert.equal(combat.volume, 0.6);
        assert.equal(combat.paused, false);

        pauseBossMusic();
        assert.equal(combat.paused, true);
        assert.equal(resumeBossMusic(), true);
        assert.equal(combat.paused, false);
        saveSettings({ musicVolume: 50 });
        setBossMusicVolume();
        assert.equal(combat.volume, 0.3);

        await engine.changeMap(MAP_IDS.MARS_SURFACE, 'cave-return');
        assert.equal(combat.paused, true);
        const ambient = tracks.at(-1);
        assert.match(ambient.src, /music_game\.mp3$/);
        assert.equal(ambient.paused, false);
        assert.equal(ambient.volume, 0.5);

        await engine.changeMap(MAP_IDS.MARS_CATACOMBS, 'catacombs-entry');
        engine.skeletons = [{ isDead: true, shouldRemove: false }];
        engine.unlockUpgrade = () => {};
        const lastCombat = tracks.at(-1);
        engine._checkCatacombsCleared();
        assert.equal(gameState.catacombsCleared, true);
        assert.equal(lastCombat.paused, true);
        assert.equal(ambient.paused, false);
        assert.equal(resumeBossMusic(), false);

        await engine.changeMap(MAP_IDS.MARS_SURFACE, 'cave-return');
        const trackCount = tracks.length;
        await engine.changeMap(MAP_IDS.MARS_CATACOMBS, 'catacombs-entry');
        assert.equal(tracks.length, trackCount, 'catacumbas limpas não reiniciam a trilha de combate');
        assert.equal(ambient.paused, false);
    } finally {
        stopBossMusic();
        stopGameMusic();
        gameState.catacombsCleared = originalCleared;
        gameState.catacombsRespawnRemaining = originalRespawn;
        gameState.catacombsWaveActive = originalWave;
        globalThis.Audio = originalAudio;
        globalThis.window = originalWindow;
    }
});
