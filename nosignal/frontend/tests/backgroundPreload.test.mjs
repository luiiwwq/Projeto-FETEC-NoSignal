import test from 'node:test';
import assert from 'node:assert/strict';

import { MapRenderer, preloadBackgroundAssets } from '../src/engine/MapRenderer.js';

function withFakeImage(run) {
    const originalImage = globalThis.Image;
    const originalSetTimeout = globalThis.setTimeout;
    const images = [];
    const timer = { calls: 0, fire: () => { const fn = timer.fn; timer.fn = null; fn(); } };
    globalThis.Image = class {
        constructor() {
            this.src = '';
            this.onload = null;
            this.onerror = null;
            images.push(this);
        }
    };
    globalThis.setTimeout = (fn) => {
        timer.fn = fn;
        timer.calls++;
        return 0;
    };
    try {
        return run({ images, timer });
    } finally {
        globalThis.Image = originalImage;
        globalThis.setTimeout = originalSetTimeout;
    }
}

test('mapas do castelo usam URL estável e tentam de novo após falha transitória', () => withFakeImage(({ images, timer }) => {
    const renderer = new MapRenderer();
    renderer.loadSpriteCastleMapSprite('castle-principal-room');

    assert.equal(images.length, 1);
    assert.match(images[0].src, /map_principal_room\.png\?v=\d+$/);
    assert.doesNotMatch(images[0].src, /v=\d{10,}/, 'não pode ser timestamp Date.now()');

    images[0].onerror();
    assert.equal(timer.calls, 1, 'falha transitória agenda um retry');
    timer.fire();
    assert.equal(images.length, 2, 'retry tenta uma nova Image');

    images[1].onerror();
    assert.equal(timer.calls, 1, 'segunda falha desiste e não agenda novo retry');
    assert.equal(renderer.castleMapSprites.size, 0, 'mapa não é marcado como carregado após falhar');
}));

test('load bem-sucedido da caverna guarda o sprite para o renderer', () => withFakeImage(({ images, timer }) => {
    const renderer = new MapRenderer();
    renderer.loadCavernMapSprite('mars-catacombs');
    assert.match(images[0].src, /cave_catacomb_map2\.png$/);
    images[0].onload();
    assert.ok(renderer.cavernSprites.has('mars-catacombs'));
    assert.equal(timer.calls, 0, 'sucesso não agenda retry');
}));

test('preloadBackgroundAssets aquece os cenários grandes com as mesmas URLs do runtime', () => withFakeImage(({ images }) => {
    preloadBackgroundAssets();
    const urls = images.map((img) => img.src);
    assert.ok(urls.some((url) => /map_surface2\.png$/.test(url)), 'textura da superfície');
    assert.ok(urls.some((url) => /cavern_entrance\.png\?v=\d+$/.test(url)), 'entrada da caverna');
    assert.ok(urls.some((url) => /map_nucle\.png$/.test(url)), 'caverna núcleo');
    assert.ok(urls.some((url) => /map_principal_room\.png\?v=\d+$/.test(url)), 'castelo sala principal');
    assert.ok(urls.some((url) => /map_king_room\.png\?v=\d+$/.test(url)), 'castelo sala do rei');
    assert.ok(urls.every((url) => !/v=\d{10,}/.test(url)), 'nenhum timestamp nas URLs');
}));