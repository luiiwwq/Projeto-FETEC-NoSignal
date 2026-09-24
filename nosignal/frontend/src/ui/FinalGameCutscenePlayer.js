/**
 * Reprodutor compartilhado das cutscenes de encerramento.
 * Cada final usa suas imagens, textos e cartão terminal em FINAL_DEFINITIONS.
 */

import { preloadCutsceneMusic, startCutsceneMusic, stopCutsceneMusic } from '../audio/cutsceneMusic.js';
import { stopMenuMusic } from '../audio/menuMusic.js';
import { withNetworkTimeout } from '../services/networkTimeout.js';

export const FINAL_DEFINITIONS = Object.freeze({
    final1: {
        available: true,
        title: 'GAME OVER',
        directory: './src/assets/cutscenes/final_game/final1',
        textFile: 'text_scenes_final1.txt',
        sceneCount: 3,
        imageFile: (index) => `scene${index}_final1.png`,
        terminalLines: [
            'OXIGÊNIO: 0%',
            'SUPORTE DE VIDA: DESATIVADO',
            'ARES-1 — SINAL PERDIDO',
            'GAME OVER'
        ]
    },
    final2: {
        available: true,
        title: 'DUNA TERRAFORMADA',
        directory: './src/assets/cutscenes/final_game/final2',
        textFile: 'text_scenes_final2.txt',
        sceneCount: 6,
        imageFile: (index) => `scene${index}_final2.png`,
        terminalLines: ['TERRAFORMAÇÃO: CONCLUÍDA', 'ASTRONAUTA: SEM OXIGÊNIO', 'KERBIN: SEM NOTÍCIAS', 'DUNA: NÃO COLONIZADA POR KERBIN']
    },
    final3: {
        available: true,
        title: 'UM NOVO LAR',
        directory: './src/assets/cutscenes/final_game/final3',
        textFile: 'text_scenes_final3.txt',
        sceneCount: 7,
        imageFile: (index) => `scene${index}_final3.png`,
        terminalLines: ['TERRAFORMAÇÃO: CONCLUÍDA', 'DUNA: HABITÁVEL', 'MIGRAÇÃO DE KERBIN: INICIADA', 'FIM']
    },
    final4: {
        available: true,
        title: 'SOBREVIVÊNCIA',
        directory: './src/assets/cutscenes/final_game/final4',
        textFile: 'text_scenes_final4.txt',
        sceneCount: 8,
        imageFile: (index) => `scene${index}_final4.png`,
        terminalLines: ['TERRAFORMAÇÃO: INDISPONÍVEL', 'DUNA: INADEQUADO PARA KERBIN', 'COLONIZAÇÃO: INICIADA', 'SUPORTE DE VIDA: OBRIGATÓRIO', 'FIM']
    }
});

const TYPE_SPEED_MS = 28;
const BASE_DURATION_MS = 3000;
const CHARS_DURATION_MS = 42;
const MIN_DURATION_MS = 4200;
const MAX_DURATION_MS = 10000;
const FADE_MS = 600;

export function parseSceneTexts(raw, sceneCount) {
    const scenes = Array.from({ length: sceneCount }, () => '');
    let currentIndex = -1;

    for (const line of raw.split(/\r?\n/)) {
        const match = line.match(/^(?:scene|cena)\s*(\d+)\s*:\s*(.*)$/i);
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
    return withNetworkTimeout(async (signal) => {
        const response = await fetch(`${definition.directory}/${definition.textFile}`, { cache: 'no-cache', signal });
        if (!response.ok) throw new Error(`Falha ao carregar o texto do final: HTTP ${response.status}`);
        return parseSceneTexts(await response.text(), definition.sceneCount);
    });
}

function sceneImagePath(definition, index) {
    return `${definition.directory}/${definition.imageFile(index)}`;
}

export async function playFinalGameCutscene(container, finalId, onContinue = () => {}) {
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

        return await showFinal(container, definition, scenes, skip, onContinue);
    } finally {
        window.removeEventListener('keydown', onSkipKey, true);
        stopCutsceneMusic();
    }
}

function showFinal(container, definition, scenes, skip, onContinue) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'cutscene-ending-overlay';
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
        caption.className = 'cutscene-caption';

        const counter = document.createElement('div');
        counter.className = 'cutscene-counter';

        const skipButton = document.createElement('button');
        skipButton.className = 'ns-pixel-button cutscene-skip';
        skipButton.type = 'button';
        skipButton.textContent = 'PULAR [ENTER]';

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
            onContinue();
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
            counter.style.display = 'none';
            caption.textContent = '';
            caption.style.display = 'none';
            skipButton.style.display = 'none';

            const card = document.createElement('div');
            card.className = 'ns-pixel-panel ending-terminal';
            const heading = document.createElement('h2');
            heading.className = 'ending-terminal__title';
            heading.textContent = definition.title;
            card.appendChild(heading);
            for (const [index, line] of definition.terminalLines.entries()) {
                const label = document.createElement('div');
                label.textContent = line;
                label.className = 'ending-terminal__line';
                if (index === definition.terminalLines.length - 1) {
                    label.classList.add('ending-terminal__line--closing');
                }
                card.appendChild(label);
            }

            const continueButton = document.createElement('button');
            continueButton.className = 'ns-pixel-button ending-terminal__button';
            continueButton.type = 'button';
            continueButton.textContent = 'CONTINUAR';
            continueButton.addEventListener('click', finish, { once: true });
            card.appendChild(continueButton);
            overlay.appendChild(card);
            continueButton.focus();
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
