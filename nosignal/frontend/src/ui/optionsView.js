/**
 * optionsView.js
 * Conjunto de controles de configurações (volume, brilho, tela cheia)
 * usado tanto no menu de pausa quanto na tela inicial.
 *
 * O preenchimento dos sliders é normalizado pelo range (min/max), então o
 * preenchimento sempre acompanha a posição exata do polegar.
 */

import { loadSettings, saveSettings } from '../state/stateStorage.js';
import { setMenuMusicVolume } from '../audio/menuMusic.js';
import { setGameMusicVolume } from '../audio/gameMusic.js';

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
    settings.fullscreen = !!document.fullscreenElement || fsKeepRequested;
    saveSettings(settings);
}

/* ── Tela cheia estável: ESC do navegador não derruba mais ──
 * O navegador encerra a tela cheia ao apertar ESC e isso não pode ser
 * cancelado com preventDefault().
 *
 * Solução moderna: Keyboard Lock API. Sem ela, o Chrome CONSUME a tecla
 * ESC no fullscreen — nem chega a entregar o keydown para a página (por
 * isso o alerta/teste anterior nunca disparava). Com a trava ativa, o ESC
 * continua chegando ao GameEngine, que chama preventDefault() e mantém a
 * tela cheia. Como fallback (navegadores sem suporte), reentramos em
 * fullscreen quando ele é perdido sem ter sido uma saída manual (ex.:
 * usuário clicou novamente no botão "TELA CHEIA").
 */
let fsKeepRequested = false; // intenção do jogo: manter tela cheia ligada
let fsManualExit = false;    // saída manual em andamento (via botão)
let fsTarget = null;         // último elemento alvo da tela cheia

function supportsKeyboardLock() {
    return typeof navigator !== 'undefined' &&
        'keyboard' in navigator &&
        typeof navigator.keyboard.lock === 'function';
}

function lockEscapeKey() {
    if (!supportsKeyboardLock()) return;
    Promise.resolve(navigator.keyboard.lock(['Escape']))
        .catch(() => { /* navegador recusou a trava: usa o fallback */ });
}

function unlockEscapeKey() {
    if (!supportsKeyboardLock()) return;
    try {
        navigator.keyboard.unlock();
    } catch (err) { /* ignora */ }
}

function enterFullscreen(el) {
    if (!el) return;
    if (el.requestFullscreen) {
        try { el.requestFullscreen(); } catch (err) { /* ignora */ }
        return;
    }
    if (el.webkitRequestFullscreen) {
        try { el.webkitRequestFullscreen(); } catch (err) { /* ignora */ }
    }
}

function exitFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) {
        try { exit.call(document); } catch (err) { /* ignora */ }
    }
}

function onFullscreenChange() {
    refreshFullscreenButtons();

    if (document.fullscreenElement) {
        fsTarget = document.fullscreenElement;
        fsKeepRequested = true;
        fsManualExit = false;
        // Adquire o teclado no fullscreen para o ESC chegar ao jogo
        lockEscapeKey();
        return;
    }

    // Tela cheia perdida sem saída manual (ex.: apertou ESC). Reentra
    // imediatamente — a ativação de usuário do ESC ainda está válida.
    if (fsKeepRequested && !fsManualExit) {
        const target = (fsTarget && fsTarget.isConnected)
            ? fsTarget
            : document.documentElement;
        enterFullscreen(target);
    }
    unlockEscapeKey();
    fsManualExit = false;
}

function bindFsListenerOnce() {
    if (fsListenerBound) return;
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    fsListenerBound = true;
}

function toggleFullscreen(containerRef) {
    const target = containerRef || document.documentElement;
    fsTarget = target;
    if (document.fullscreenElement) {
        fsKeepRequested = false;
        fsManualExit = true;
        window.__noSignalKeepFullscreen = false;
        exitFullscreen();
    } else {
        fsKeepRequested = true;
        fsManualExit = false;
        window.__noSignalKeepFullscreen = true;
        enterFullscreen(target);
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
        const onSliderChange = () => {
            const value = Number(slider.value);
            slider.style.setProperty('--val', fillPercent(slider));
            const label = wrap.querySelector(`[data-value-for="${slider.dataset.setting}"]`);
            if (label) label.textContent = value + '%';
            saveSettings({ [slider.dataset.setting]: value });
            applyBrightness(containerRef);
            // Volumes de música (menu e gameplay) seguem ao vivo, sem reiniciar.
            if (slider.dataset.setting === 'musicVolume') {
                setMenuMusicVolume();
                setGameMusicVolume();
            }
        };
        slider.addEventListener('input', onSliderChange);
        slider.addEventListener('change', onSliderChange);
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