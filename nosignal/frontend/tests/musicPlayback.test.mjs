import test from 'node:test';
import assert from 'node:assert/strict';

import { createLoopingMusic } from '../src/audio/loopingMusic.js';

const settle = () => new Promise((resolve) => setImmediate(resolve));

function withFakeAudio(run) {
    const originalAudio = globalThis.Audio;
    const originalWindow = globalThis.window;
    const instances = [];
    let onPlay = () => Promise.resolve();

    globalThis.window = new EventTarget();
    globalThis.Audio = class extends EventTarget {
        constructor(src) {
            super();
            this.src = src;
            this.paused = true;
            this.ended = false;
            this.error = null;
            this.readyState = 2;
            this.currentTime = 0;
            this.playCalls = 0;
            instances.push(this);
        }
        play() {
            this.playCalls++;
            const result = onPlay(this);
            if (result !== false) {
                this.paused = false;
                this.ended = false;
            }
            return result === false ? Promise.reject(Error('Autoplay blocked')) : result;
        }
        pause() {
            if (this.paused) return;
            this.paused = true;
            this.dispatchEvent(new Event('pause'));
        }
    };

    return Promise.resolve().then(() => run({ instances, setPlay: (fn) => { onPlay = fn; } }))
        .finally(() => {
            globalThis.Audio = originalAudio;
            globalThis.window = originalWindow;
        });
}

test('música reinicia se a faixa terminar e pode tocar em uma nova partida', () => withFakeAudio(async ({ instances }) => {
    const music = createLoopingMusic('ambient.mp3', { name: 'Ambiente', getVolume: () => 0.6 });
    music.start();
    const audio = instances[0];
    assert.equal(audio.loop, true);
    assert.equal(audio.playCalls, 1);
    await settle();

    audio.paused = true;
    audio.ended = true;
    audio.currentTime = 30;
    audio.dispatchEvent(new Event('ended'));
    assert.equal(audio.currentTime, 0);
    assert.equal(audio.playCalls, 2);
    await settle();

    music.stop();
    assert.equal(audio.paused, true);
    music.start();
    assert.equal(audio.playCalls, 3);
    music.stop();
}));

test('stop cancela retry de autoplay e invalida play() atrasado', () => withFakeAudio(async ({ instances, setPlay }) => {
    const releases = [];
    setPlay(() => new Promise((resolve) => releases.push(resolve)));
    const music = createLoopingMusic('menu.mp3', { name: 'Menu', getVolume: () => 1 });
    music.start();
    music.stop();
    music.start();
    assert.equal(instances[0].playCalls, 2);
    releases[0]();
    await settle();
    assert.equal(instances[0].paused, false, 'promessa antiga não deve pausar a trilha nova');
    releases[1]();
    await settle();
    music.start();
    assert.equal(instances[0].playCalls, 2, 'chamadas repetidas não reiniciam áudio já ativo');
    music.stop();

    setPlay(() => false);
    music.start();
    await settle();
    const calls = instances[0].playCalls;
    music.stop();
    window.dispatchEvent(new Event('click'));
    assert.equal(instances[0].playCalls, calls, 'menu não pode ressurgir ao clicar durante gameplay');
}));

test('falha de mídia não deixa o estado de tocando preso; volume zero volta ao aumentar', () => withFakeAudio(async ({ instances }) => {
    let volume = 0;
    const music = createLoopingMusic('ambient.mp3', { name: 'Ambiente', getVolume: () => volume });
    music.start();
    assert.equal(instances.length, 0);

    volume = 0.5;
    music.setVolume();
    assert.equal(instances[0].playCalls, 1);
    volume = 0;
    music.setVolume();
    assert.equal(instances[0].paused, true);
    volume = 0.7;
    music.setVolume();
    assert.equal(instances[0].playCalls, 2);
    assert.equal(instances[0].volume, 0.7);

    instances[0].error = { code: 3 };
    instances[0].dispatchEvent(new Event('error'));
    music.stop();
    music.start();
    assert.equal(instances.length, 2);
    assert.equal(instances[1].playCalls, 1);
    music.stop();
}));

test('pausa externa retoma na próxima interação apenas enquanto a trilha estiver ativa', () => withFakeAudio(async ({ instances }) => {
    const music = createLoopingMusic('menu.mp3', { name: 'Menu', getVolume: () => 0.5 });
    music.start();
    await settle();
    const audio = instances[0];
    audio.pause();
    window.dispatchEvent(new Event('pointerdown'));
    assert.equal(audio.playCalls, 2);
    assert.equal(audio.paused, false);
    music.stop();
    window.dispatchEvent(new Event('pointerdown'));
    assert.equal(audio.playCalls, 2);
}));
