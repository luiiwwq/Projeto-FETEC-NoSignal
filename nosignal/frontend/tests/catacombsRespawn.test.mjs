import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '../src/engine/GameEngine.js';
import { MAP_IDS } from '../src/content/maps.js';
import { gameState } from '../src/state/gameState.js';

test('esqueletos renascem só após limpar a sala, sair e esperar 40s; upgrade é único', async () => {
    const saved = {
        cleared: gameState.catacombsCleared,
        remaining: gameState.catacombsRespawnRemaining,
        waveActive: gameState.catacombsWaveActive,
        upgrades: gameState.upgrades,
        currentMap: gameState.currentMap
    };
    try {
        gameState.catacombsCleared = false;
        gameState.catacombsRespawnRemaining = null;
        gameState.catacombsWaveActive = false;
        gameState.upgrades = [];
        const engine = new GameEngine(null);
        engine.player = {
            setPosition() {}, setCollisionResolver() {}, setWorldBounds() {}, applyUpgrades() {},
            colliderHalfW: 10, colliderHalfH: 10
        };
        engine.mapRenderer.setMap = () => {};
        engine._buildCollisionResolver = () => () => {};
        engine._setupCharacterRoles = () => {};
        engine._respawnMissionWorldItems = () => {};
        let spawnCount = 0;
        let upgradesAwarded = 0;
        engine._spawnCatacombsWarriors = () => {
            spawnCount++;
            const skeleton = { isDead: false, shouldRemove: false };
            engine.skeletons.push(skeleton);
            engine.actors.push(skeleton);
        };
        engine._spawnCatacombsArchers = () => {};
        engine._spawnCatacombsSpearmen = () => {};
        engine.unlockUpgrade = () => { upgradesAwarded++; gameState.addUpgrade('damage_up'); };

        await engine.changeMap(MAP_IDS.MARS_CATACOMBS, 'catacombs-entry');
        assert.equal(spawnCount, 1);
        engine._checkCatacombsCleared();
        assert.equal(gameState.catacombsCleared, false, 'um esqueleto vivo impede a limpeza');
        await engine.changeMap(MAP_IDS.MARS_SURFACE, 'cave-return');
        assert.equal(gameState.catacombsRespawnRemaining, null, 'sair antes de matar não inicia o tempo');

        await engine.changeMap(MAP_IDS.MARS_CATACOMBS, 'catacombs-entry');
        engine.skeletons[0].isDead = true;
        engine._checkCatacombsCleared();
        assert.equal(upgradesAwarded, 1);
        assert.equal(gameState.catacombsRespawnRemaining, null, 'matar sem sair não inicia o tempo');
        engine._advanceCatacombsRespawn(40);
        assert.equal(gameState.catacombsRespawnRemaining, null);

        await engine.changeMap(MAP_IDS.MARS_SURFACE, 'cave-return');
        assert.equal(gameState.catacombsRespawnRemaining, 40);
        engine._advanceCatacombsRespawn(20);
        await engine.changeMap(MAP_IDS.MARS_CATACOMBS, 'catacombs-entry');
        assert.equal(engine.skeletons.length, 0, 'reentrada antes de 40s continua sem inimigos');
        engine._advanceCatacombsRespawn(40);
        assert.equal(gameState.catacombsRespawnRemaining, 20, 'tempo só corre fora da sala');
        await engine.changeMap(MAP_IDS.MARS_SURFACE, 'cave-return');
        engine._advanceCatacombsRespawn(20);
        assert.equal(gameState.catacombsRespawnRemaining, 0);

        await engine.changeMap(MAP_IDS.MARS_CATACOMBS, 'catacombs-entry');
        assert.equal(spawnCount, 3);
        assert.equal(engine.skeletons.length, 1);
        assert.equal(gameState.catacombsRespawnRemaining, null);

        await engine.changeMap(MAP_IDS.MARS_SURFACE, 'cave-return');
        assert.equal(gameState.catacombsRespawnRemaining, null, 'sair durante a horda não inicia novo prazo');
        await engine.changeMap(MAP_IDS.MARS_CATACOMBS, 'catacombs-entry');
        assert.equal(spawnCount, 4, 'horda incompleta reaparece ao voltar');
        engine.skeletons[0].isDead = true;
        engine._checkCatacombsCleared();
        assert.equal(upgradesAwarded, 1, 'segunda limpeza dá moedas dos inimigos, sem upgrade');
        await engine.changeMap(MAP_IDS.MARS_SURFACE, 'cave-return');
        assert.equal(gameState.catacombsRespawnRemaining, 40, 'nova limpeza habilita outro ciclo');
    } finally {
        gameState.catacombsCleared = saved.cleared;
        gameState.catacombsRespawnRemaining = saved.remaining;
        gameState.catacombsWaveActive = saved.waveActive;
        gameState.upgrades = saved.upgrades;
        gameState.currentMap = saved.currentMap;
    }
});
