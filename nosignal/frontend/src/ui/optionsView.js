/**
 * optionsView.js
 * Conjunto de controles de configurações (volume, brilho, tela cheia)
 * usado tanto no menu de pausa quanto na tela inicial.
 *
 * O preenchimento dos sliders é normalizado pelo range (min/max), então o
 * preenchimento sempre acompanha a posição exata do polegar.
 */

import { loadSettings, saveSettings } from '../state/stateStorage.js';

const RANGES = [
    { setting: 'musicVolume', label: 'VOLUME DA MÚSICA', min: 0, max: 100 },
    { setting: 'sfxVolume', label: 'VOLUME DOS EFEITOS', min: 0, max: 100 },
    { setting: 'brightness', label: 'BRILHO DA TELA', min: 0, max: 100 },
];

let fsListenerBound = false;

function fillPercent(slider) {
    const min = Number(slider.min);
    const max = Number(slider.max);
    const value = Number(slider.value);
    if (max <= min) return 100;
    return Math.round(((value - min) / (max - min)) * 100);
}

function applyBrightness(containerRef) {
    const settings = loadSettings();
    const canvas =
        (containerRef ? containerRef.querySelector('#game-canvas') : null) ||
        document.querySelector('#game-canvas');
    if (canvas) {
        canvas.style.filter = settings.brightness < 100
            ? `brightness(${(settings.brightness / 100).toFixed(2)})`
            : '';
    }
}

function refreshFullscreenButtons() {
    document.querySelectorAll('button[data-action="fullscreen"]').forEach((btn) => {
        btn.textContent = document.fullscreenElement ? 'TELA CHEIA: LIGADO' : 'TELA CHEIA: DESLIGADO';
    });
    const settings = loadSettings();
    settings.fullscreen = !!document.fullscreenElement;
    saveSettings(settings);
}

function bindFsListenerOnce() {
    if (fsListenerBound) return;
    document.addEventListener('fullscreenchange', refreshFullscreenButtons);
    fsListenerBound = true;
}

function toggleFullscreen(containerRef) {
    const target = containerRef || document.documentElement;
    if (document.fullscreenElement) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
    } else if (target.requestFullscreen) {
        target.requestFullscreen();
    } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
    }
}

/**
 * Constrói o corpo da tela de opções.
 * onBack: callback disparado ao clicar em "VOLTAR".
 * containerRef: elemento que contém o canvas do jogo (para aplicar o brilho).
 * Retorna o fragmento DOM já populado e vinculado.
 */
export function createOptionsContent({ onBack, containerRef } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'pause-panel__body pause-panel__options';

    RANGES.forEach(({ setting, label, min, max }) => {
        const item = document.createElement('div');
        item.className = 'opt-item';
        item.innerHTML = `
            <div class="opt-item__head">
                <span class="opt-item__label">${label}</span>
                <span class="opt-item__value" data-value-for="${setting}"></span>
            </div>
        `;
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'opt-item__slider';
        slider.dataset.setting = setting;
        slider.min = min;
        slider.max = max;
        slider.step = 5;
        item.appendChild(slider);
        wrap.appendChild(item);
    });

    const fsBtn = document.createElement('button');
    fsBtn.type = 'button';
    fsBtn.className = 'pause-panel__btn';
    fsBtn.dataset.action = 'fullscreen';
    fsBtn.textContent = 'TELA CHEIA: DESLIGADO';
    wrap.appendChild(fsBtn);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'pause-panel__btn';
    backBtn.textContent = 'VOLTAR';
    wrap.appendChild(backBtn);

    bindFsListenerOnce();

    wrap.querySelectorAll('.opt-item__slider').forEach((slider) => {
        slider.addEventListener('input', () => {
            const value = Number(slider.value);
            slider.style.setProperty('--val', fillPercent(slider));
            const label = wrap.querySelector(`[data-value-for="${slider.dataset.setting}"]`);
            if (label) label.textContent = value + '%';
            saveSettings({ [slider.dataset.setting]: value });
            applyBrightness(containerRef);
        });
    });

    fsBtn.addEventListener('click', () => toggleFullscreen(containerRef));

    backBtn.addEventListener('click', () => {
        if (onBack) onBack();
    });

    syncOptionsUI(wrap, containerRef);
    return wrap;
}

export function syncOptionsUI(wrap, containerRef) {
    if (!wrap) return;
    const settings = loadSettings();
    wrap.querySelectorAll('.opt-item__slider').forEach((slider) => {
        const value = Number.isFinite(settings[slider.dataset.setting])
            ? settings[slider.dataset.setting]
            : Number(slider.value);
        slider.value = value;
        slider.style.setProperty('--val', fillPercent(slider));
        const label = wrap.querySelector(`[data-value-for="${slider.dataset.setting}"]`);
        if (label) label.textContent = value + '%';
    });
    refreshFullscreenButtons();
    applyBrightness(containerRef);
}