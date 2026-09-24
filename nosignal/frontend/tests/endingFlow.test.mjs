import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { getMissionEnding, getMissionShipAction, MIN_CONCLUDE_PLAY_SECONDS } from '../src/content/endings.js';
import { MAPS, MAP_IDS } from '../src/content/maps.js';
import { GameEngine } from '../src/engine/GameEngine.js';
import { gameState } from '../src/state/gameState.js';
import { OXYGEN_LIFETIME_DAYS, OXYGEN_LIFETIME_SECONDS } from '../src/systems/dayNightSystem.js';
import { FINAL_DEFINITIONS } from '../src/ui/FinalGameCutscenePlayer.js';
import { createEndingAttemptId, registerEndingResult } from '../src/services/ranking.js';
import { getActionCodes } from '../src/state/controlsStorage.js';
import { codeDisplay } from '../src/state/controlsStorage.js';

test('a decisão na nave respeita as peças, o conserto e a vida do NPC inimigo', () => {
    assert.equal(getMissionShipAction(false, false), 'conclude');
    assert.equal(getMissionShipAction(false, false, true), 'game-over');
    assert.equal(getMissionEnding(false, false), 'final2');
    assert.equal(getMissionShipAction(true, false), 'repair');
    assert.equal(getMissionShipAction(true, false, true), 'repair');
    assert.equal(getMissionShipAction(true, true), 'depart');
    assert.equal(getMissionEnding(true, true), 'final3');
    assert.equal(getMissionEnding(true, false), 'final4');
});

test('a interação na nave reparada aciona o final correto e o NPC derrotado não reaparece', () => {
    const originalHTMLElement = globalThis.HTMLElement;
    const collected = gameState.missionCollected;
    const repaired = gameState.spaceshipRepaired;
    const defeated = gameState.enemyNpcDefeated;
    const concluded = gameState.missionConcluded;
    const character = gameState.selectedCharacter;
    globalThis.HTMLElement = class {};
    try {
        gameState.selectedCharacter = 'astronaut';
        gameState.missionCollected = ['motor', 'meio', 'ponta'];
        gameState.spaceshipRepaired = true;
        const engine = new GameEngine(null);
        engine.player = { isDead: false };
        engine.interactableMissionShip = true;
        engine.mapTransitionCooldown = 0;
        const triggered = [];
        engine._triggerEnding = (id) => triggered.push(id);

        gameState.enemyNpcDefeated = false;
        engine._setupCharacterRoles(MAPS[MAP_IDS.MARS_SURFACE]);
        assert.ok(engine._enemyNpcActor, 'o NPC aparece antes de ser derrotado');
        gameState.missionConcluded = false;
        engine._handleKeyDown({ code: 'KeyE', target: null, repeat: false });

        gameState.enemyNpcDefeated = true;
        engine._setupCharacterRoles(MAPS[MAP_IDS.MARS_SURFACE]);
        assert.equal(engine._enemyNpcActor, null, 'o NPC não reaparece ao voltar à superfície');
        gameState.missionConcluded = false;
        engine._handleKeyDown({ code: 'KeyE', target: null, repeat: false });
        assert.deepEqual(triggered, ['final4', 'final3']);
    } finally {
        globalThis.HTMLElement = originalHTMLElement;
        gameState.missionCollected = collected;
        gameState.spaceshipRepaired = repaired;
        gameState.enemyNpcDefeated = defeated;
        gameState.missionConcluded = concluded;
        gameState.selectedCharacter = character;
    }
});

test('a virada para o quinto dia aciona o final 1 automaticamente, inclusive fora da superfície', () => {
    const repaired = gameState.spaceshipRepaired;
    const concluded = gameState.missionConcluded;
    const dayNight = gameState.dayNight;
    try {
        const engine = new GameEngine(null);
        engine.currentMapId = MAP_IDS.MARS_CATACOMBS;
        const triggered = [];
        engine._triggerEnding = (id) => {
            triggered.push(id);
            engine._endingTriggered = true;
        };
        engine.dayNight.update(OXYGEN_LIFETIME_SECONDS - 0.05);
        assert.equal(engine.dayNight.dayCount, OXYGEN_LIFETIME_DAYS - 1);
        gameState.spaceshipRepaired = false;
        gameState.missionConcluded = false;
        engine._updateDayNight(0.02);
        assert.deepEqual(triggered, [], 'o final não começa antes da virada de dia');
        engine._updateDayNight(0.1);
        assert.equal(engine.dayNight.dayCount, OXYGEN_LIFETIME_DAYS);
        assert.deepEqual(triggered, ['final1']);
        assert.equal(gameState.missionConcluded, true);
        engine._updateDayNight(0.1);
        assert.deepEqual(triggered, ['final1'], 'a cutscene não pode ser disparada duas vezes');

        const repairedEngine = new GameEngine(null);
        repairedEngine.dayNight.update(OXYGEN_LIFETIME_SECONDS - 0.05);
        const otherEndings = [];
        repairedEngine._triggerEnding = (id) => otherEndings.push(id);
        gameState.spaceshipRepaired = true;
        repairedEngine._updateDayNight(0.1);
        assert.deepEqual(otherEndings, [], 'a nave reparada preserva os outros finais');
    } finally {
        gameState.spaceshipRepaired = repaired;
        gameState.missionConcluded = concluded;
        gameState.dayNight = dayNight;
    }
});

test('concluir missão sem peças aparece no lugar do botão de partir', () => {
    const collected = gameState.missionCollected;
    const repaired = gameState.spaceshipRepaired;
    try {
        const engine = new GameEngine(null);
        engine.currentMap = { obstacles: [{ id: 'mission-spaceship', x: 154, y: 337, w: 631, h: 323 }] };
        const positions = [];
        const labels = [];
        engine.camera.worldToScreen = (x, y) => {
            positions.push({ x, y });
            return { x, y };
        };
        const ctx = {
            save() {}, restore() {}, measureText: () => ({ width: 140 }),
            fillRect() {}, strokeRect() {}, fillText: (text) => labels.push(text)
        };
        gameState.missionCollected = [];
        gameState.spaceshipRepaired = false;
        engine._renderMissionShipPrompt(ctx);
        gameState.missionCollected = ['motor', 'meio', 'ponta'];
        gameState.spaceshipRepaired = true;
        engine._renderMissionShipPrompt(ctx);
        assert.deepEqual(positions[0], positions[1]);
        const interactKey = codeDisplay(getActionCodes('interact')[0]);
        assert.deepEqual(labels, [
            `[${interactKey}] CONCLUIR MISSÃO`,
            'AGUARDE 02:00',
            `[${interactKey}] INTERAJA COM A NAVE`
        ]);
    } finally {
        gameState.missionCollected = collected;
        gameState.spaceshipRepaired = repaired;
    }
});

test('o final 2 fica bloqueado até ~2 minutos de jogo e é liberado depois', () => {
    const collected = gameState.missionCollected;
    const repaired = gameState.spaceshipRepaired;
    const concluded = gameState.missionConcluded;
    const originalHTMLElement = globalThis.HTMLElement;
    const originalDocument = globalThis.document;
    const originalWindow = globalThis.window;
    globalThis.HTMLElement = class {};
    globalThis.document = {
        createElement: () => ({
            className: '', id: '', textContent: '', type: 'button',
            setAttribute() {}, appendChild() {}, append() {},
            addEventListener() {}, remove() {}, classList: { add() {} }
        })
    };
    globalThis.window = { addEventListener() {} };
    try {
        const engine = new GameEngine(null);
        engine.player = { isDead: false };
        engine.interactableMissionShip = true;
        engine.mapTransitionCooldown = 0;
        engine.container = { appendChild() {} };
        const triggered = [];
        engine._triggerEnding = (id) => triggered.push(id);

        gameState.missionCollected = [];
        gameState.spaceshipRepaired = false;
        gameState.missionConcluded = false;

        assert.equal(engine._canConcludeMission(), false, 'no início o final 2 está bloqueado');
        engine.dayNight.update(MIN_CONCLUDE_PLAY_SECONDS - 0.1);
        engine._handleKeyDown({ code: 'KeyE', target: null, repeat: false });
        assert.deepEqual(triggered, [], 'E antes de 2 min não abre a conclusão');
        assert.equal(engine.hudMessage.startsWith('CONCLUIR MISSÃO EM'), true, 'mostra o tempo restante na hud');

        engine.dayNight.update(0.2);
        assert.equal(engine._canConcludeMission(), true, 'após 2 min o final 2 está liberado');
        engine._handleKeyDown({ code: 'KeyE', target: null, repeat: false });
        assert.ok(engine._cutsceneActive, 'após 2 min abre a confirmação do final 2');
    } finally {
        globalThis.HTMLElement = originalHTMLElement;
        globalThis.document = originalDocument;
        globalThis.window = originalWindow;
        gameState.missionCollected = collected;
        gameState.spaceshipRepaired = repaired;
        gameState.missionConcluded = concluded;
    }
});

test('cada final configurado tem texto para todas as imagens que exibe', () => {
    const root = fileURLToPath(new URL('../', import.meta.url));
    for (const [id, definition] of Object.entries(FINAL_DEFINITIONS)) {
        assert.equal(definition.available, true, `${id} deve estar disponível`);
        const directory = resolve(root, definition.directory.replace(/^\.\//, ''));
        const textPath = resolve(directory, definition.textFile);
        assert.ok(existsSync(textPath), textPath);
        const text = readFileSync(textPath, 'utf8');
        for (let index = 1; index <= definition.sceneCount; index++) {
            assert.ok(existsSync(resolve(directory, definition.imageFile(index))), `${id} imagem ${index}`);
            assert.match(text, new RegExp(`^cena${index}:\\s*\\S`, 'im'), `${id} texto ${index}`);
        }
        assert.ok(definition.terminalLines.length >= 4, `${id} cartão terminal`);
    }
});

test('o registro do final usa um UUID da partida reutilizável na repetição', async () => {
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (url, options) => {
        requests.push({ url, options });
        return { ok: true, status: 204 };
    };
    try {
        const partidaId = createEndingAttemptId();
        assert.match(partidaId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        await registerEndingResult({ partidaId, finalId: 'final3' });
        await registerEndingResult({ partidaId, finalId: 'final3' });
        assert.equal(requests.length, 2);
        assert.ok(requests.every(({ url }) => url.endsWith('/rpc/registrar_final')));
        assert.deepEqual(requests.map(({ options }) => JSON.parse(options.body)), [
            { p_partida_id: partidaId, p_final_id: 'final3' },
            { p_partida_id: partidaId, p_final_id: 'final3' }
        ]);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
