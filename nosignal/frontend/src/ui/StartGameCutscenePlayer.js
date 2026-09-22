/**
 * StartGameCutscenePlayer.js
 * Exibe a cutscene de abertura do jogo (12 scenes em sequência) sobre um
 * overlay fullscreen, com imagem, texto em efeito máquina de escrever e trilha
 * sonora própria.
 *
 * Uso:
 *   import { playStartGameCutscene } from './StartGameCutscenePlayer.js';
 *   await playStartGameCutscene(container);
 *
 * Retorna uma Promise que resolve quando:
 *   - Todas as scenes terminam naturalmente
 *   - O jogador clica no botão PULAR ou pressiona ENTER (mesmo esquema dos bosses)
 *
 * O texto de cada scene é lido de `scenes_text.txt`; se a leitura falhar,
 * usa um fallback embutido para nunca travar o fluxo do jogo.
 */

import { preloadCutsceneMusic, startCutsceneMusic, stopCutsceneMusic } from '../audio/cutsceneMusic.js';
import { stopMenuMusic } from '../audio/menuMusic.js';

const SCENES_DIR = './src/assets/cutscenes/start_game';
const SCENES_TEXT_PATH = `${SCENES_DIR}/scenes_text.txt`;
const SCENE_IMAGES_PATH = `${SCENES_DIR}/scene%20(%i).png`;

const TYPE_SPEED_MS = 28;
const BASE_DURATION_MS = 3000;
const CHARS_DURATION_MS = 42;
const MIN_DURATION_MS = 4200;
const MAX_DURATION_MS = 10000;
const FADE_MS = 600;
const PRELOAD_TIMEOUT_MS = 8000;
const TEXT_TIMEOUT_MS = 6000;

const TOTAL_SCENES = 12;

const FALLBACK_TEXTS = [
    'Em uma galáxia distante, no ano de 2167,\nexistia um planeta chamado Kerbin, habitado por diversas formas de vida.',
    'Décadas de exploração destruíram os recursos do planeta.\nMilhões de vidas foram perdidas.',
    'Para salvar o que restava da população, a Asperance iniciou a Missão ARES-1.',
    'Três astronautas foram enviados em busca de um novo lar.',
    'Depois de meses de viagem, a ARES-1 chegou ao sistema de Duna.',
    'Antes da chegada, um dos astronautas entrou em uma nave de reconhecimento que foi enviada para pousar no planeta.\nPouco depois, o contato foi perdido.',
    'Então, a ARES-1 entrou em um enorme cinturão de asteroides.',
    'A nave foi atingida e perdeu o controle.',
    'A nave ARES-1 caiu em Duna.',
    'Milagrosamente, os dois astronautas sobrevivem,\nmas percebem que o contato com Kerbin foi perdido.',
    'E o pior, o sistema de suporte de vida foi danificado e o oxigênio restante durará apenas cinco dias.',
    'Apesar da queda, o equipamento responsável pela terraformação permanece intacto.\nA missão ainda pode ser concluída.'
];

function sceneImagePath(index) {
    // index é 1-based (1..12): scene (1).png, scene (2).png, ...
    return SCENE_IMAGES_PATH.replace('%i', index);
}

function withTimeout(promise, ms, fallback) {
    return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve(fallback);
        }, ms);
        Promise.resolve(promise).then(
            (value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(value);
            },
            () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(fallback);
            }
        );
    });
}

async function loadScenesText() {
    try {
        const response = await fetch(SCENES_TEXT_PATH, { cache: 'no-cache' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const raw = await response.text();

        const scenes = [];
        const lines = raw.split(/\r?\n/);

        // Remove rótulos como "Frase 1:" e "Frase 2 (Continuação):" e agrupa
        // o texto de cada bloco "sceneN:".
        for (const line of lines) {
            const match = line.match(/^scene\s*(\d+)\s*:\s*(.*)$/i);
            if (match) {
                const index = parseInt(match[1], 10);
                const trimmed = match[2].trim();
                while (scenes.length < index) scenes.push(null);
                if (scenes[index - 1] === null) scenes[index - 1] = '';
                let text = trimmed;
                text = text.replace(/Frase\s*\d+\s*\(Continuação\)\s*:/g, '\n');
                text = text.replace(/Frase\s*\d+\s*:/g, '');
                scenes[index - 1] += text;
            } else if (scenes.length > 0 && scenes[scenes.length - 1] !== null) {
                const trimmed = line.trim();
                if (trimmed) {
                    // Linha de continuação, ex.: "Frase 2 (Continuação): ..."
                    let add = trimmed;
                    add = add.replace(/^Frase\s*\d+\s*\(Continuação\)\s*:\s*/i, '');
                    add = add.replace(/^Frase\s*\d+\s*:\s*/i, '');
                    const wasFrase = /^Frase/i.test(trimmed);
                    scenes[scenes.length - 1] += (wasFrase ? '\n' : ' ') + add.trim();
                }
            }
        }

        const cleaned = scenes.map((text) => (text === null ? '' : text.trim()));
        if (cleaned.length > 0 && cleaned.some((t) => t.length > 0)) return cleaned;
        return FALLBACK_TEXTS;
    } catch (err) {
        console.warn('[StartGameCutscene] Falha ao ler scenes_text.txt; usando fallback.', err);
        return FALLBACK_TEXTS;
    }
}

function preloadImage(path) {
    return new Promise((resolve) => {
        const img = new Image();
        const timer = setTimeout(() => resolve(false), PRELOAD_TIMEOUT_MS);
        img.onload = () => {
            clearTimeout(timer);
            resolve(true);
        };
        img.onerror = () => {
            clearTimeout(timer);
            resolve(false);
        };
        img.src = path;
    });
}

function preloadAllImages(count) {
    return Promise.all(Array.from({ length: count }, (_, i) => preloadImage(sceneImagePath(i + 1))));
}

export async function playStartGameCutscene(container) {
    if (!container) return;

    // Pausa a música do menu para dar lugar à trilha da cutscene.
    stopMenuMusic();
    preloadCutsceneMusic();

    // Carrega imagens e texto em paralelo com um limite de segurança.
    const texts = await withTimeout(
        loadScenesText(),
        TEXT_TIMEOUT_MS,
        FALLBACK_TEXTS
    );
    await withTimeout(preloadAllImages(TOTAL_SCENES), PRELOAD_TIMEOUT_MS + 500, []);

    await confirmCutscene(container, texts || FALLBACK_TEXTS);

    // Ao sair das cutscenes, a tela de loading assume a música do gameplay.
    stopCutsceneMusic();
}

function confirmCutscene(container, scenesText) {
    return new Promise((resolve) => {
        /* ── Overlay fullscreen ────────────────────────────── */
        const overlay = document.createElement('div');
        overlay.id = 'start-cutscene-overlay';
        overlay.style.cssText = `
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9200;
            overflow: hidden;
        `;

        const img = document.createElement('img');
        img.draggable = false;
        img.style.cssText = `
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
            opacity: 0;
            transition: opacity ${FADE_MS}ms ease;
            user-select: none;
            pointer-events: none;
        `;

        /* ── Caixa de texto (legenda) ──────────────────────── */
        const caption = document.createElement('div');
        caption.id = 'start-cutscene-caption';
        caption.style.cssText = `
            position: absolute;
            left: 50%;
            bottom: 96px;
            transform: translateX(-50%);
            width: min(860px, 92%);
            background: rgba(5, 6, 12, 0.82);
            border: 1.5px solid rgba(232, 223, 200, 0.28);
            border-left: 4px solid rgba(120, 220, 255, 0.75);
            border-radius: 8px;
            padding: 16px 22px;
            color: #e8dfc8;
            font-family: 'Courier New', 'Lucida Console', monospace;
            font-size: 16px;
            line-height: 1.65;
            letter-spacing: 0.03em;
            text-shadow: 0 0 8px rgba(120, 220, 255, 0.25);
            text-align: center;
            white-space: pre-line;
            box-shadow: 0 6px 30px rgba(0, 0, 0, 0.6);
            z-index: 9010;
            pointer-events: none;
        `;

        /* ── Indicador de cena ─────────────────────────────── */
        const counter = document.createElement('div');
        counter.id = 'start-cutscene-counter';
        counter.style.cssText = `
            position: absolute;
            top: 24px;
            right: 32px;
            color: rgba(232, 223, 200, 0.55);
            font-family: 'Courier New', 'Lucida Console', monospace;
            font-size: 12px;
            letter-spacing: 0.14em;
            z-index: 9010;
        `;

        /* ── Botão PULAR (mesmo esquema dos bosses) ────────── */
        const skipBtn = document.createElement('button');
        skipBtn.id = 'cutscene-skip-btn';
        skipBtn.type = 'button';
        skipBtn.innerHTML = 'PULAR &nbsp;<span style="opacity:0.75;font-size:0.78em">[ENTER]</span>';
        skipBtn.style.cssText = `
            position: absolute;
            bottom: 28px;
            right: 32px;
            background: rgba(10, 8, 16, 0.82);
            color: #e8dfc8;
            border: 1.5px solid rgba(232, 223, 200, 0.35);
            border-radius: 6px;
            padding: 8px 20px;
            font-family: 'Courier New', 'Lucida Console', monospace;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.08em;
            cursor: pointer;
            z-index: 9010;
            transition: background 0.15s, border-color 0.15s, color 0.15s;
            user-select: none;
            outline: none;
        `;

        skipBtn.addEventListener('mouseenter', () => {
            skipBtn.style.background = 'rgba(40, 30, 60, 0.95)';
            skipBtn.style.borderColor = 'rgba(232, 223, 200, 0.8)';
            skipBtn.style.color = '#fff';
        });
        skipBtn.addEventListener('mouseleave', () => {
            skipBtn.style.background = 'rgba(10, 8, 16, 0.82)';
            skipBtn.style.borderColor = 'rgba(232, 223, 200, 0.35)';
            skipBtn.style.color = '#e8dfc8';
        });

        overlay.appendChild(img);
        overlay.appendChild(caption);
        overlay.appendChild(counter);
        overlay.appendChild(skipBtn);
        container.appendChild(overlay);

        let finished = false;
        let timers = [];
        let currentScene = 0;
        let currentImageLoaded = '';

        function stopTimers() {
            timers.forEach(clearTimeout);
            timers = [];
        }

        function finish() {
            if (finished) return;
            finished = true;
            stopTimers();
            window.removeEventListener('keydown', onKeyDown, true);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            resolve();
        }

        /* ── Efeito máquina de escrever ────────────────────── */
        function typeText(el, fullText) {
            let index = 0;
            const tick = () => {
                index += 1;
                el.textContent = fullText.slice(0, index);
                if (index < fullText.length) {
                    timers.push(window.setTimeout(tick, TYPE_SPEED_MS));
                }
            };
            tick();
        }

        function sceneDuration(text) {
            return Math.min(
                MAX_DURATION_MS,
                Math.max(MIN_DURATION_MS, BASE_DURATION_MS + text.length * CHARS_DURATION_MS)
            );
        }

        /* ── Reprodução das scenes ─────────────────────────── */
        function showScene(index) {
            if (finished) return;
            stopTimers();
            currentScene = index;

            if (index >= TOTAL_SCENES) {
                finish();
                return;
            }

            counter.textContent = `CENA ${index + 1} / ${TOTAL_SCENES}`;

            const src = sceneImagePath(index + 1);
            if (currentImageLoaded !== src) {
                const loader = new Image();
                loader.onload = () => {
                    if (finished) return;
                    currentImageLoaded = src;
                    img.src = src;
                    img.style.opacity = '1';
                };
                loader.onerror = () => {
                    if (finished) return;
                    currentImageLoaded = src;
                    img.style.opacity = '1';
                };
                loader.src = src;
            } else {
                img.style.opacity = '1';
            }

            const text = (scenesText && scenesText[index]) || FALLBACK_TEXTS[index] || '';
            caption.textContent = '';
            typeText(caption, text);

            const duration = sceneDuration(text);
            timers.push(window.setTimeout(() => {
                if (finished) return;
                img.style.opacity = '0';
            }, duration - FADE_MS));
            timers.push(window.setTimeout(() => {
                showScene(index + 1);
            }, duration));
        }

        /* ── Tecla ENTER para pular (capture, como nos bosses) */
        function onKeyDown(e) {
            if (e.code === 'Enter' || e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                finish();
            }
        }

        // Aguarda um instante antes de capturar o ENTER para que o mesmo
        // keydown que confirmou o tripulante não pule a cutscene também.
        const bindTimer = window.setTimeout(() => {
            if (finished) return;
            window.addEventListener('keydown', onKeyDown, true);
        }, 350);
        timers.push(bindTimer);

        skipBtn.addEventListener('click', finish);

        // Inicia a trilha da cutscene (chamado dentro de um gesto do usuário,
        // então o play() é permitido pelo navegador e começa imediato).
        startCutsceneMusic();
        showScene(0);
    });
}