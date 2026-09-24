import test from 'node:test';
import assert from 'node:assert/strict';

import { Player } from '../src/entities/Player.js';
import { applyControls, loadControls, resetControls } from '../src/state/controlsStorage.js';
import { withNetworkTimeout } from '../src/services/networkTimeout.js';

test('tiro e soco acompanham o remap; mouse padrão deixa de ativar ações remapeadas', () => {
    const saved = loadControls();
    const player = new Player();
    const camera = { worldToScreen: () => ({ x: 0, y: 0 }) };
    const actions = [];
    player.shoot = () => actions.push('shoot');
    player.punch = () => actions.push('punch');
    const input = { keys: {}, mouseX: 1, mouseY: 1, mouseLeft: false, mouseRight: false };

    try {
        resetControls();
        input.mouseLeft = true;
        input.mouseRight = true;
        player.handleInput(input, camera);
        assert.deepEqual(actions, ['shoot', 'punch']);

        actions.length = 0;
        applyControls({ ...loadControls(), shoot: ['KeyT'], punch: ['KeyY'] });
        player.handleInput(input, camera);
        assert.deepEqual(actions, [], 'o mouse não deve continuar atirando ou socando após o remap');

        input.mouseLeft = false;
        input.mouseRight = false;
        input.keys.KeyT = true;
        input.keys.KeyY = true;
        player.handleInput(input, camera);
        assert.deepEqual(actions, ['shoot', 'punch']);
    } finally {
        applyControls(saved);
    }
});

test('timeout abrange o corpo JSON parado mesmo depois de receber os cabeçalhos', async () => {
    let signal;
    await assert.rejects(
        withNetworkTimeout(async (requestSignal) => {
            signal = requestSignal;
            const response = new Response(new ReadableStream({ start() {} }), { status: 200 });
            return response.json();
        }, 40),
        /Tempo limite da conexão excedido/
    );
    assert.equal(signal.aborted, true);
});
