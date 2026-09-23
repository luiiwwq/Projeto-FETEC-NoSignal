/**
 * Reprodutor compartilhado das cutscenes de encerramento.
 * Para adicionar um final futuro, configure sua pasta, quantidade de cenas e
 * cartão terminal em FINAL_DEFINITIONS.
 */

import { preloadCutsceneMusic, startCutsceneMusic, stopCutsceneMusic } from '../audio/cutsceneMusic.js';
import { stopMenuMusic } from '../audio/menuMusic.js';

export const FINAL_DEFINITIONS = Object.freeze({
    final1: {
        available: true,
        title: 'GAME OVER',
        directory: './src/assets/cutscenes/final_game/final_1',
        textFile: 'final1_texts_scene.txt',
        sceneCount: 7,
        imageFile: (index) => `scene${index}_final1.png`,
        terminalLines: [
            'OXIGÊNIO: 0%',
            'SUPORTE DE VIDA: DESATIVADO',
            'ARES-1 — SINAL PERDIDO',
            'GAME OVER'
        ]
    },
    final2: { available: false, directory: './src/assets/cutscenes/final_game/final_2' },
    final3: { available: false, directory: './src/assets/cutscenes/final_game/final_3' },
    final4: { available: false, directory: './src/assets/cutscenes/final_game/final_4' }
});

const TYPE_SPEED_MS = 28;
const BASE_DURATION_MS = 3000;
const CHARS_DURATION_MS = 42;
const MIN_DURATION_MS = 4200;
const MAX_DURATION_MS = 10000;
const FADE_MS = 600;

function parseSceneTexts(raw, sceneCount) {
    const scenes = Array.from({ length: sceneCount }, () => '');
    let currentIndex = -1;

    for (const line of raw.split(/\r?\n/)) {
        const match = line.match(/^scene\s*(\d+)\s*:\s*(.*)$/i);
        if (match) {
            currentIndex = Number(match[1]) - 1;
            if (currentIndex >= 0 && currentIndex < sceneCount) {
                scenes[currentIndex] += match[2].trim();
            }
        } else if (currentIndex >= 0 && currentIndex < sceneCount && line.trim()) {
            scenes[currentIndex] += `${scenes[currentIndex] ? ' ' : ''}${line.trim()}`;
        }
    }

    return scenes;
}

async function loadScenes(definition) {
    const response = await fetch(`${definition.directory}/${definition.textFile}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Falha ao carregar o texto do final: HTTP ${response.status}`);
    return parseSceneTexts(await response.text(), definition.sceneCount);
}

function sceneImagePath(definition, index) {
    return `${definition.directory}/${definition.imageFile(index)}`;
}

export async function playFinalGameCutscene(container, finalId, onReturnToMenu = () => {}) {
    const definition = FINAL_DEFINITIONS[finalId];
    if (!container || !definition || !definition.available) {
        console.warn(`[FinalCutscene] Final indisponível: ${finalId}`);
        return false;
    }

    stopMenuMusic();
    preloadCutsceneMusic();

    const skip = { triggered: false, now: null };
    const onSkipKey = (event) => {
        if (event.key !== 'Enter' && event.code !== 'Enter') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        skip.triggered = true;
        if (skip.now) skip.now();
    };
    skip.disableKeyListener = () => window.removeEventListener('keydown', onSkipKey, true);
    window.addEventListener('keydown', onSkipKey, true);

    try {
        let scenes;
        try {
            scenes = await loadScenes(definition);
        } catch (error) {
            console.error('[FinalCutscene] Não foi possível carregar os textos do final.', error);
            scenes = Array.from({ length: definition.sceneCount }, () => '');
        }

        return await showFinal(container, definition, scenes, skip, onReturnToMenu);
    } finally {
        window.removeEventListener('keydown', onSkipKey, true);
        stopCutsceneMusic();
    }
}

function showFinal(container, definition, scenes, skip, onReturnToMenu) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position:absolute;inset:0;width:100%;height:100%;background:#000;
            display:flex;align-items:center;justify-content:center;z-index:9500;
            overflow:hidden;font-family:var(--font-pixel,'Press Start 2P',monospace);
        `;

        const image = document.createElement('img');
        image.alt = '';
        image.draggable = false;
        image.style.cssText = `
            position:absolute;inset:0;width:100%;height:100%;object-fit:contain;
            opacity:0;transition:opacity ${FADE_MS}ms ease;user-select:none;pointer-events:none;
        `;

        const caption = document.createElement('div');
        caption.style.cssText = `
            position:absolute;left:50%;bottom:96px;transform:translateX(-50%);
            width:min(860px,92%);box-sizing:border-box;background:rgba(5,6,12,.86);
            border:1.5px solid rgba(232,223,200,.3);border-left:4px solid #e07228;
            border-radius:8px;padding:16px 22px;color:#e8dfc8;font-size:11px;
            line-height:1.9;letter-spacing:.03em;text-align:center;white-space:pre-line;
            text-shadow:0 0 8px rgba(224,114,40,.25);box-shadow:0 6px 30px #0009;
            z-index:2;pointer-events:none;
        `;

        const counter = document.createElement('div');
        counter.style.cssText = `
            position:absolute;top:24px;right:32px;color:rgba(232,223,200,.6);
            font-size:12px;letter-spacing:.14em;z-index:2;
        `;

        const skipButton = document.createElement('button');
        skipButton.type = 'button';
        skipButton.textContent = 'PULAR [ENTER]';
        skipButton.style.cssText = `
            position:absolute;right:32px;bottom:28px;background:rgba(10,8,16,.9);
            color:#e8dfc8;border:1.5px solid rgba(232,223,200,.4);border-radius:6px;
            padding:10px 16px;font:700 9px var(--font-pixel,'Press Start 2P',monospace);letter-spacing:.04em;
            cursor:pointer;z-index:3;
        `;

        overlay.append(image, caption, counter, skipButton);
        container.appendChild(overlay);

        let finished = false;
        let terminalShown = false;
        let currentScene = 0;
        let timers = [];
        const clearTimers = () => {
            for (const timer of timers) clearTimeout(timer);
            timers = [];
        };

        const finish = () => {
            if (finished) return;
            finished = true;
            clearTimers();
            overlay.remove();
            resolve(true);
            onReturnToMenu();
        };

        skip.now = () => {
            if (finished) return;
            clearTimers();
            showTerminalCard();
        };

        const typeText = (text) => {
            let charIndex = 0;
            caption.textContent = '';
            const typeNext = () => {
                charIndex += 1;
                caption.textContent = text.slice(0, charIndex);
                if (charIndex < text.length) timers.push(setTimeout(typeNext, TYPE_SPEED_MS));
            };
            if (text) typeNext();
        };

        const showTerminalCard = () => {
            if (terminalShown || finished) return;
            terminalShown = true;
            skip.disableKeyListener();
            clearTimers();
            image.style.opacity = '0';
            image.removeAttribute('src');
            counter.textContent = 'SINAL PERDIDO';
            caption.textContent = '';
            caption.style.display = 'none';
            skipButton.style.display = 'none';

            const card = document.createElement('div');
            card.style.cssText = `
                position:relative;z-index:2;display:flex;flex-direction:column;gap:18px;
                align-items:center;justify-content:center;width:min(760px,90%);padding:40px 24px;
                color:#e8dfc8;text-align:center;background:rgba(5,6,12,.86);
                border:1px solid rgba(224,114,40,.6);box-shadow:0 0 48px #000;
            `;
            for (const [index, line] of definition.terminalLines.entries()) {
                const label = document.createElement('div');
                label.textContent = line;
                label.style.cssText = `max-width:100%;overflow-wrap:anywhere;font-size:${index === definition.terminalLines.length - 1 ? 15 : 9}px;line-height:1.9;letter-spacing:.04em;`;
                if (index === definition.terminalLines.length - 1) {
                    label.style.color = '#e07228';
                    label.style.fontWeight = 'bold';
                }
                card.appendChild(label);
            }

            const menuButton = document.createElement('button');
            menuButton.type = 'button';
            menuButton.textContent = 'VOLTAR AO MENU';
            menuButton.style.cssText = `
                margin-top:18px;padding:10px 22px;color:#e8dfc8;background:#15121a;
                border:1px solid rgba(232,223,200,.45);border-radius:4px;
                font:700 9px var(--font-pixel,'Press Start 2P',monospace);letter-spacing:.04em;cursor:pointer;
            `;
            menuButton.addEventListener('click', finish, { once: true });
            card.appendChild(menuButton);
            overlay.appendChild(card);
            menuButton.focus();
        };

        const showScene = (index) => {
            if (finished) return;
            clearTimers();
            currentScene = index;
            if (currentScene >= definition.sceneCount) {
                showTerminalCard();
                return;
            }

            const text = scenes[currentScene] || '';
            counter.textContent = `CENA ${currentScene + 1} / ${definition.sceneCount}`;
            caption.style.display = '';
            const src = sceneImagePath(definition, currentScene + 1);
            image.style.opacity = '0';
            const loader = new Image();
            loader.onload = () => {
                if (finished || currentScene !== index) return;
                image.src = src;
                image.style.opacity = '1';
            };
            loader.onerror = () => {
                if (finished || currentScene !== index) return;
                image.removeAttribute('src');
                image.style.opacity = '1';
            };
            loader.src = src;
            typeText(text);

            const duration = Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, BASE_DURATION_MS + text.length * CHARS_DURATION_MS));
            timers.push(setTimeout(() => { image.style.opacity = '0'; }, duration - FADE_MS));
            timers.push(setTimeout(() => showScene(index + 1), duration));
        };

        skipButton.addEventListener('click', showTerminalCard);
        startCutsceneMusic();
        if (skip.triggered) showTerminalCard();
        else showScene(0);
    });
}
