import test from 'node:test';
import assert from 'node:assert/strict';

import { GameEngine } from '../src/engine/GameEngine.js';
import { Player } from '../src/entities/Player.js';
import {
    applyControls, resetControls, loadControls,
    setActionCode, getActionCodes, isBound, findActionByCode, codeDisplay
} from '../src/state/controlsStorage.js';

test('DASH pode ser remapeado para os botões laterais do mouse', () => {
    const saved = loadControls();
    try {
        resetControls();
        assert.deepEqual(getActionCodes('dash'), ['KeyQ']);

        applyControls({ ...loadControls(), dash: ['Mouse5'] });
        assert.equal(getActionCodes('dash')[0], 'Mouse5');
        assert.ok(isBound('dash', 'Mouse5'));
        assert.equal(findActionByCode(loadControls(), 'Mouse5'), 'dash');

        assert.equal(codeDisplay('Mouse4'), 'M4');
        assert.equal(codeDisplay('Mouse5'), 'M5');
    } finally {
        applyControls(saved);
    }
});

test('setActionCode remove um botão lateral que esteja duplicado em outra ação', () => {
    const saved = loadControls();
    try {
        applyControls({ ...loadControls(), jump: ['Mouse4'], dash: ['KeyQ'] });
        setActionCode('dash', 'Mouse4', 0);
        const controls = loadControls();
        assert.equal(controls.dash[0], 'Mouse4');
        assert.equal(controls.jump.includes('Mouse4'), false, 'Mouse4 não pode ficar no PULAR');
    } finally {
        applyControls(saved);
    }
});

test('mousedown do botão lateral dispara o dash quando ele está remapeado', () => {
    const saved = loadControls();
    try {
        const engine = new GameEngine(null);
        let dashCalls = 0;
        let fxCalls = 0;
        engine.player = { isDead: false, dash: () => { dashCalls++; return true; } };
        engine._spawnDashFx = () => { fxCalls++; };

        applyControls({ ...loadControls(), dash: ['Mouse4'] });
        engine._handleMouseDown({ button: 3, preventDefault: () => {} });
        assert.equal(dashCalls, 1, 'Mouse4 dispara o dash remapeado');
        assert.equal(fxCalls, 1);

        applyControls({ ...loadControls(), dash: ['KeyQ'] });
        engine._handleMouseDown({ button: 4, preventDefault: () => {} });
        assert.equal(dashCalls, 1, 'sem remap o botão lateral não deve disparar o dash');

        assert.equal(engine.input.mouse4, true, 'estado do botão fica pressionado');
        engine._handleMouseUp({ button: 3 });
        engine._handleMouseUp({ button: 4 });
        assert.equal(engine.input.mouse4, false, 'mouseup libera o botão 4');
        assert.equal(engine.input.mouse5, false, 'mouseup libera o botão 5');
    } finally {
        applyControls(saved);
    }
});

test('ATIRAR também pode usar os botões laterais do mouse', () => {
    const saved = loadControls();
    try {
        const player = new Player();
        const camera = { worldToScreen: () => ({ x: 0, y: 0 }) };
        const actions = [];
        player.shoot = () => actions.push('shoot');
        const input = { keys: {}, mouseX: 1, mouseY: 1, mouse4: false, mouse5: false };

        applyControls({ ...loadControls(), shoot: ['Mouse5'] });
        player.handleInput(input, camera);
        assert.deepEqual(actions, [], 'botão solto não atira');

        input.mouse5 = true;
        player.handleInput(input, camera);
        assert.deepEqual(actions, ['shoot'], 'Mouse5 remapeado atira enquanto pressionado');
    } finally {
        applyControls(saved);
    }
});

test('botão lateral não dispara dash com o jogo pausado ou em cutscene', () => {
    const saved = loadControls();
    try {
        const engine = new GameEngine(null);
        let dashCalls = 0;
        engine.player = { isDead: false, dash: () => { dashCalls++; return true; } };
        applyControls({ ...loadControls(), dash: ['Mouse5'] });

        engine.paused = true;
        engine._handleMouseDown({ button: 4, preventDefault: () => {} });
        assert.equal(dashCalls, 0, 'pausado não dispara');

        engine.paused = false;
        engine._cutsceneActive = true;
        engine._handleMouseDown({ button: 4, preventDefault: () => {} });
        assert.equal(dashCalls, 0, 'cutscene não dispara');

        engine._cutsceneActive = false;
        engine._handleMouseDown({ button: 4, preventDefault: () => {} });
        assert.equal(dashCalls, 1, 'em jogo normal o botão dispara');
    } finally {
        applyControls(saved);
    }
});