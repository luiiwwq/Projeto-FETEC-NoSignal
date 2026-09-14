/**
 * caveChoiceScreen.js
 * Tela de escolha de caminho da caverna (cutscene estática, sem animação).
 *
 * Aberta ao interagir com o exit "cave-entrance" ([E] ENTRAR NA CAVERNA) em
 * vez de transicionar direto para mars-cave. O jogador escolhe entre duas
 * entradas ("Núcleo de Marte" / "Catacumbas Marcianas") e só então a troca de
 * mapa acontece. Pode ser cancelada com ESC, voltando ao jogo sem viajar.
 *
 * Padrões seguem pauseMenu.js / nameModal.js: overlay DOM em tela cheia,
 * pausing o jogo enquanto aberta (engine.paused), navegação por teclado
 * (setas + Enter) e clique nos hotspots.
 */

import { gameState } from '../state/gameState.js';
import { MAP_IDS } from '../content/maps.js';

/* ── Caminhos de caverna ─────────────────────────────────── */
// Valores gravados em gameState.lastCavePath (usados pelo roteamento futuro).
export const CAVE_PATHS = {
    MARS_CORE: 'nucleo-marte',
    CATACOMBS: 'catacumbas',
};

/* ── Fundo (PASSO 1) ─────────────────────────────────────── */
// Caminho do asset da tela de escolha (cavern_choice.jpeg — a arte real já
// entregue pelo artista). Se no futuro a arte chegar como .png, trocar aqui.
// O carregamento usa o mesmo padrão de MapRenderer.loadCaveEntranceSprite:
// um único new Image() com guarda para nunca recarregar, e fallback de
// retângulo sólido com console.warn caso o arquivo ainda não exista.
const CAVERN_CHOICE_BG_PATH = './src/assets/sprites/Cavern/cavern_choice.jpeg';

let cavernChoiceBackground = null;
let _cavernChoiceRequested = false;
let _cavernChoiceWarned = false;

function loadCavernChoiceBackground() {
    if (cavernChoiceBackground || _cavernChoiceRequested) return;
    _cavernChoiceRequested = true;
    if (typeof Image === 'undefined') return; // non-browser (tests)
    const img = new Image();
    img.onload = () => {
        cavernChoiceBackground = img;
        // Se a tela já estiver aberta quando a arte terminar de carregar,
        // troca o placeholder sólido pelo fundo real na hora.
        if (bgElementRef) _applyBackground(bgElementRef);
    };
    img.onerror = () => {
        if (!_cavernChoiceWarned) {
            _cavernChoiceWarned = true;
            console.warn(
                `[caveChoiceScreen] ${CAVERN_CHOICE_BG_PATH} não carregou — usando retângulo de fundo sólido.`
            );
        }
    };
    img.src = CAVERN_CHOICE_BG_PATH;
}

function _applyBackground(el) {
    if (!el) return;
    if (
        cavernChoiceBackground &&
        cavernChoiceBackground.complete &&
        cavernChoiceBackground.naturalWidth !== 0
    ) {
        el.style.backgroundImage = `url('${CAVERN_CHOICE_BG_PATH}')`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.classList.add('has-bg');
    } else {
        // Fallback: retângulo de cor sólida/escura enquanto a arte não chega.
        el.style.backgroundImage = 'none';
        el.classList.remove('has-bg');
    }
}

/* ── Hotspots (PASSO 2) ──────────────────────────────────── */
// Posições dos dois "buracos" de caverna na arte cavern_choice.jpeg.
// Agora cada botão é CENTRALIZADO num ponto (cx, cy) — frações (0..1) de
// largura/altura do overlay (1280×720 no jogo) — e sua área de clique é
// apenas o tamanho do texto (shrink-to-fit). Layout placeholder para dois
// buracos lado a lado — CALIBRAR quando a arte final for conferida.
const HOTSPOTS = [
    {
        path: CAVE_PATHS.MARS_CORE,
        label: 'NÚCLEO DE MARTE',
        // centro ≈ (301, 396) em 1280×720
        cx: 0.235,
        cy: 0.55,
    },
    {
        path: CAVE_PATHS.CATACOMBS,
        label: 'CATACUMBAS MARCIANAS',
        // centro ≈ (928, 396) em 1280×720
        cx: 0.725,
        cy: 0.55,
    },
];

/* ── Estado do módulo ────────────────────────────────────── */
let screenElement = null;
let bgElementRef = null;
let isOpen = false;
let containerRef = null;
let engineRef = null;
// Modalidade de navegação: true = teclado (destaque permanece no foco),
// false = mouse (destaque só existe enquanto o ponteiro está em cima).
let keyboardNav = false;
let _mouseGuardBound = false;

// Destaca `btn` e limpa os demais hotspots (usado na navegação por teclado).
function _selectHotspot(btn) {
    const all = screenElement ? screenElement.querySelectorAll('button.cave-choice-hotspot') : [];
    all.forEach((b) => {
        if (b === btn) b.classList.add('is-selected');
        else b.classList.remove('is-selected');
    });
}

/* ── API pública ─────────────────────────────────────────── */
export function openCaveChoiceScreen(container, engine, exit) {
    if (isOpen) return;
    containerRef = container;
    engineRef = engine;

    // Garante que o fundo seja solicitado (guarda interna evita recarregar).
    loadCavernChoiceBackground();

    const mountTarget = container.querySelector('.game-viewport') || container;

    if (!screenElement) {
        screenElement = _buildDOM();
        mountTarget.appendChild(screenElement);
        _bindEvents();
    } else if (screenElement.parentElement !== mountTarget) {
        mountTarget.appendChild(screenElement);
    }
    screenElement.hidden = false;
    bgElementRef = screenElement.querySelector('.cave-choice-bg');
    _applyBackground(bgElementRef);

    isOpen = true;

    // Congela o jogo enquanto a tela estiver aberta (mesmo princípio do pause).
    if (engine) engine.paused = true;

    const firstHotspot = screenElement.querySelector('button.cave-choice-hotspot');
    if (firstHotspot) setTimeout(() => firstHotspot.focus(), 60);
}

export function closeCaveChoiceScreen() {
    if (!screenElement) return;
    screenElement.hidden = true;
    screenElement.remove();
    screenElement = null;
    bgElementRef = null;
    isOpen = false;
    if (engineRef) engineRef.paused = false;
    engineRef = null;
    containerRef = null;
}

export function isCaveChoiceOpen() {
    return isOpen;
}

/* ── Roteamento das escolhas ────────────────────────────── */
// Cada opção leva ao seu mapa dedicado (antes, ambas caíam em mars-cave).
// A escolha continua sendo gravada em gameState.lastCavePath.
function _beginCaveTravel(path) {
    const engine = engineRef;
    if (!engine) return;

    gameState.lastCavePath = path;

    // Fecha (despausa) e só então viaja — o cancelamento via ESC não viaja.
    closeCaveChoiceScreen();

    if (path === CAVE_PATHS.MARS_CORE) {
        engine.changeMap(MAP_IDS.MARS_CORE, 'core-entry');
    } else {
        engine.changeMap(MAP_IDS.MARS_CATACOMBS, 'catacombs-entry');
    }
}

/* ── DOM builder ─────────────────────────────────────────── */
function _buildDOM() {
    const el = document.createElement('section');
    el.className = 'cave-choice-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'cave-choice-title');
    el.hidden = true;

    const hotspotsHTML = HOTSPOTS.map((h) => `
        <button
            type="button"
            class="cave-choice-hotspot"
            data-path="${h.path}"
            style="left:${(h.cx * 100).toFixed(2)}%;top:${(h.cy * 100).toFixed(2)}%;"
            aria-label="${h.label}"
        >
            <span class="cave-choice-hotspot__label">► ${h.label} ◄</span>
        </button>`).join('');

    el.innerHTML = `
        <div class="cave-choice-bg"></div>

        <header class="cave-choice-header">
            <span id="cave-choice-title" class="cave-choice-title">ESCOLHA SEU CAMINHO</span>
            <span class="cave-choice-sub">DOIS SINAIS AGUARDAM NAS PROFUNDEZAS DE MARTE</span>
        </header>

        <div class="cave-choice-hotspots">
            ${hotspotsHTML}
        </div>

        <div class="cave-choice-footer">
            <span>◄ ► NAVEGAR · ENTER CONFIRMAR · ESC CANCELAR</span>
        </div>
    `;

    return el;
}

/* ── Event wiring ────────────────────────────────────────── */
function _bindEvents() {
    if (!screenElement) return;

    // CORREÇÃO (hover preso): com o mouse o destaque só aparece enquanto o
    // ponteiro está sobre o hotspot (CSS :hover + mouseenter/mouseleave);
    // com teclado (keyboardNav) o destaque permanece no hotspot focado.
    screenElement.querySelectorAll('button.cave-choice-hotspot').forEach((btn) => {
        btn.addEventListener('mouseenter', () => {
            btn.classList.add('is-selected');
        });
        btn.addEventListener('mouseleave', () => {
            if (!keyboardNav) btn.classList.remove('is-selected');
        });
        btn.addEventListener('focus', () => {
            if (keyboardNav) _selectHotspot(btn);
        });
        btn.addEventListener('blur', () => {
            if (!keyboardNav) btn.classList.remove('is-selected');
        });
    });

    if (!_mouseGuardBound) {
        _mouseGuardBound = true;
        // Qualquer clique do mouse desativa a "modalidade teclado"
        document.addEventListener('mousedown', () => { keyboardNav = false; });
    }

    // Clique apenas nos hotspots viaja. Clicar fora dos botões NÃO fecha a
    // tela — o cancelamento acontece somente via ESC.
    screenElement.addEventListener('click', (e) => {
        const btn = e.target.closest('button.cave-choice-hotspot');
        if (!btn || !btn.dataset.path) return;
        _beginCaveTravel(btn.dataset.path);
    });

    // Navegação por teclado: setas ciclam os hotspots, ESC cancela.
    screenElement.addEventListener('keydown', (e) => {
        const hotspots = Array.from(screenElement.querySelectorAll('button.cave-choice-hotspot'));

        if (e.code === 'Escape') {
            e.preventDefault();
            e.stopPropagation(); // não deixa o ESC abrir o pause menu
            closeCaveChoiceScreen();
            return;
        }

        if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight' && e.code !== 'ArrowUp' && e.code !== 'ArrowDown') return;
        if (hotspots.length === 0) return;

        const idx = hotspots.indexOf(document.activeElement);
        let next;
        if (idx === -1) {
            next = 0;
        } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
            next = (idx - 1 + hotspots.length) % hotspots.length;
        } else {
            next = (idx + 1) % hotspots.length;
        }
        e.preventDefault();
        e.stopPropagation();
        keyboardNav = true;
        _selectHotspot(hotspots[next]);
        hotspots[next].focus();
    });

    // Focus trap (Tab) enquanto o diálogo está aberto.
    screenElement.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const focusable = screenElement.querySelectorAll('button:not([disabled])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });
}