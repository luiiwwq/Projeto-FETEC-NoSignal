import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyControls, resetControls, loadControls, setActionCode,
    getActionCodes, isControlsModifiedThisSession
} from '../src/state/controlsStorage.js';

// Fingimento de localStorage para verificar a persistência real em disco.
function withLocalStorage(run) {
    const store = {};
    const original = globalThis.localStorage;
    globalThis.localStorage = {
        getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; }
    };
    try {
        return run(store);
    } finally {
        globalThis.localStorage = original;
    }
}

test('remap marca a config como modificada nesta sessão', () => {
    const saved = loadControls();
    try {
        applyControls({ ...loadControls(), dash: ['KeyQ'] });
        assert.equal(isControlsModifiedThisSession(), false, 'perfil aplicado zera a marca');

        setActionCode('dash', 'Mouse4', 0);
        assert.equal(isControlsModifiedThisSession(), true, 'remap marca como modificado');
        assert.equal(getActionCodes('dash')[0], 'Mouse4');
    } finally {
        applyControls(saved);
    }
});

test('restaurar padrão também marca como modificado', () => {
    const saved = loadControls();
    try {
        applyControls({ ...loadControls(), dash: ['KeyQ'] });
        resetControls();
        assert.equal(isControlsModifiedThisSession(), true, 'restaurar é uma modificação do jogador');
        assert.deepEqual(getActionCodes('dash'), ['KeyQ']);
    } finally {
        applyControls(saved);
    }
});

test('aplicar um perfil vindo da nuvem limpa a marca de modificação', () => {
    const saved = loadControls();
    try {
        setActionCode('sprint', 'KeyV', 0);
        assert.equal(isControlsModifiedThisSession(), true);
        applyControls({ ...loadControls(), dash: ['KeyK'] });
        assert.equal(isControlsModifiedThisSession(), false, 'perfil carregado = estado aceito');
    } finally {
        applyControls(saved);
    }
});

test('o remap do menu principal fica gravado no localStorage (sobrevive à recarga)', () => withLocalStorage(() => {
    applyControls({ ...loadControls(), dash: ['Mouse5'] });
    assert.deepEqual(getActionCodes('dash'), ['Mouse5']);
    const stored = globalThis.localStorage.getItem('nosignal.controls.v1');
    assert.ok(stored && stored.includes('"Mouse5"'), 'localStorage guarda o remap: ' + stored);
}));