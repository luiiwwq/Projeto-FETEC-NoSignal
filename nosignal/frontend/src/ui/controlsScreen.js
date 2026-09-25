/**
 * controlsScreen.js
 * Tela separada de "Controles" (remap de teclas), aberta a partir das
 * opções (título ou pausa). É um overlay de tela cheia com grid largo,
 * para os binds não ficarem espremidos dentro do painel de opções.
 *
 * Fecha com o botão VOLTAR ou ESC; as opções continuam abertas por baixo.
 */

import { gameState } from '../state/gameState.js';
import { CONTROL_ACTIONS, loadControls, setActionCode, resetControls, codeDisplay, findActionByCode } from '../state/controlsStorage.js';
import { saveControlsByPlayer } from '../services/controlsRemote.js';
import { playClickButtonSound } from '../audio/uiClickSound.js';

let overlay = null;
let listening = null; // { action, index, btn }

// Teclas bloqueadas do remap: nunca podem ser reassignadas (navegador/jogo).
const LOCKED_CODES = new Set(['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']);

export function openControlsScreen(container) {
    if (overlay) return overlay;

    const mount = container && container.querySelector('.title-screen-wrapper')
        ? container.querySelector('.title-screen-wrapper')
        : container && container.querySelector('.game-viewport')
        ? container.querySelector('.game-viewport')
        : container || document.body;

    overlay = document.createElement('section');
    overlay.className = 'controls-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'controls-title');

    overlay.innerHTML = `
        <div class="controls-panel">
            <div class="pause-panel__header">
                <span class="pause-panel__icon">||</span>
                <h2 id="controls-title" class="pause-panel__title">CONTROLES</h2>
                <span class="pause-panel__icon">||</span>
            </div>
            <div class="controls-panel__body">
                <p class="controls-remap__hint">CLIQUE NAS TECLAS/BOTÕES PARA TROCAR</p>
                <div class="controls-grid"></div>
                <div class="controls-panel__actions">
                    <button type="button" class="pause-panel__btn controls-remap__reset">RESTAURAR PADRÃO</button>
                    <button type="button" class="pause-panel__btn controls-panel__back">VOLTAR</button>
                </div>
            </div>
            <div class="pause-panel__footer">
                <span>NO SIGNAL v1.0 — ESC PARA VOLTAR</span>
            </div>
        </div>
    `;

    mount.appendChild(overlay);
    _buildRows(overlay.querySelector('.controls-grid'));
    _bindEvents(overlay);

    const firstKey = overlay.querySelector('.controls-remap__key');
    if (firstKey) setTimeout(() => firstKey.focus(), 60);

    return overlay;
}

export function closeControlsScreen() {
    if (!overlay) return;
    // Cancela qualquer remap em andamento ANTES de remover o overlay: senão o
    // listener global de keydown segue vivo e a próxima tecla troca o bind
    // ("escutando" após fechar), gerando ainda TypeError em _refreshAll(null).
    cancelListening();
    overlay.remove();
    overlay = null;
    _unbindGlobalEscape();
}

export function isControlsScreenOpen() {
    return !!overlay;
}

/* ── DOM / construção ─────────────────────────────────────── */
function _buildRows(grid) {
    if (!grid || grid.dataset.built) return;
    grid.dataset.built = '1';

    const controls = loadControls();
    CONTROL_ACTIONS.forEach(({ action, label }) => {
        const row = document.createElement('div');
        row.className = 'controls-remap__row';
        row.dataset.action = action;

        const rowLabel = document.createElement('span');
        rowLabel.className = 'controls-remap__label';
        rowLabel.textContent = label;
        row.appendChild(rowLabel);

        const codesBox = document.createElement('div');
        codesBox.className = 'controls-remap__binds';
        codesBox.dataset.action = action;

        (controls[action] || []).forEach((code, index) => {
            codesBox.appendChild(_makeKeyButton(action, code, index));
        });

        row.appendChild(codesBox);
        grid.appendChild(row);
    });
}

function _makeKeyButton(action, code, index) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'controls-remap__key';
    btn.textContent = codeDisplay(code);
    btn.dataset.action = action;
    btn.dataset.index = String(index);
    return btn;
}

/* ── Eventos ─────────────────────────────────────────────── */
function _bindEvents(screen) {
    // Fecha ao clicar no fundo.
    screen.addEventListener('click', (e) => {
        if (e.target === screen) closeControlsScreen();
        const back = e.target.closest('.controls-panel__back');
        if (back) {
            playClickButtonSound();
            closeControlsScreen();
        }
    });

    // Botão restaurar padrão.
    screen.querySelector('.controls-remap__reset').addEventListener('click', () => {
        resetControls();
        persistControlsRemote();
        _refreshAll(screen);
    });

    // Binds clicáveis.
    screen.querySelectorAll('.controls-remap__key').forEach((btn) => {
        btn.addEventListener('click', () => startListening(btn));
    });

    _bindGlobalEscape();
}

function _refreshAll(screen) {
    const controls = loadControls();
    screen.querySelectorAll('.controls-remap__row').forEach((row) => {
        const action = row.dataset.action;
        const codes = controls[action] || [];
        const binds = row.querySelector('.controls-remap__binds');
        binds.innerHTML = '';
        codes.forEach((code, index) => binds.appendChild(_makeKeyButton(action, code, index)));
    });
    screen.querySelectorAll('.controls-remap__key').forEach((btn) => {
        btn.addEventListener('click', () => startListening(btn));
    });
}

/* ── Persistência ────────────────────────────────────────── */
function persistControlsRemote() {
    const nome = gameState && gameState.playerName ? gameState.playerName : null;
    if (!nome) return;
    // No menu principal ainda não existe um astronauta definido: o remap fica
    // só no localStorage (configuração "padrão do dispositivo") até o nome ser
    // escolhido. Sem isso a mudança seria gravada sob o nome padrão 'ARES-1' e
    // depois sobrescrita pelo perfil do nome real ao iniciar a partida.
    if (gameState && gameState.currentScene === 'TITLE') return;
    saveControlsByPlayer(nome, loadControls())
        .catch(() => { /* sem rede: fica só no localStorage */ });
}

/* ── Escuta de tecla ─────────────────────────────────────── */
// Botões laterais do mouse que podem ser capturados no remap (3 e 4 =
// "voltar"/"avançar"; usados por ex. no DASH). O e.button é a chave.
const MOUSE_SIDE_BUTTONS = { 3: 'Mouse4', 4: 'Mouse5' };

function startListening(btn) {
    if (listening && listening._cancel) listening._cancel();
    const action = btn.dataset.action;
    const index = Number(btn.dataset.index);
    listening = { action, index, btn };
    btn.classList.add('controls-remap__key--listening');
    btn.textContent = '?';

    const applyCode = (code) => {
        // Feedback de tecla bloqueada/em uso com cancelamento retardado. O
        // setTimeout só cancela a escuta SE ela ainda for esta sessão: um novo
        // clique em outro bind nos 400ms seguintes não pode ser desfeito por
        // um timer antigo.
        const delayedReject = (label) => {
            const session = listening;
            if (session && session.btn) session.btn.textContent = label;
            setTimeout(() => {
                if (session && listening === session) cancelListening();
            }, 400);
        };

        if (LOCKED_CODES.has(code)) {
            delayedReject('BLOQUEADA');
            return;
        }

        // Evita duplicidade: a mesma tecla não pode atender duas ações.
        const controls = loadControls();
        const other = findActionByCode(controls, code);
        if (other && other !== action) {
            delayedReject('EM USO');
            return;
        }

        setActionCode(action, code, index);
        _refreshAll(overlay);
        persistControlsRemote();
        cancelListening();
    };

    const onKeyDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.removeEventListener('keydown', onKeyDown, true);

        if (e.key === 'Escape') {
            cancelListening();
            return;
        }
        if (!e.code) {
            const session = listening;
            if (session && session.btn) session.btn.textContent = 'BLOQUEADA';
            setTimeout(() => {
                if (session && listening === session) cancelListening();
            }, 400);
            return;
        }
        applyCode(e.code);
    };

    // Também captura os botões laterais do mouse (4/5) durante o remap:
    // sem isso o DASH não podia ser trocado para eles, e o navegador
    // ainda tratava o clique como "voltar"/"avançar" no histórico.
    const onMouseDown = (e) => {
        const code = MOUSE_SIDE_BUTTONS[e.button];
        if (!code) return;
        e.preventDefault();
        e.stopPropagation();
        window.removeEventListener('mousedown', onMouseDown, true);
        applyCode(code);
    };

    listening._cancel = () => {
        window.removeEventListener('keydown', onKeyDown, true);
        window.removeEventListener('mousedown', onMouseDown, true);
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('mousedown', onMouseDown, true);
}

function cancelListening() {
    if (!listening) return;
    if (listening._cancel) listening._cancel();
    if (listening.btn) listening.btn.classList.remove('controls-remap__key--listening');
    listening = null;
    if (overlay) _refreshAll(overlay);
}

/* ── ESC global ──────────────────────────────────────────── */
let globalEscBound = false;

function _bindGlobalEscape() {
    if (globalEscBound) return;
    globalEscBound = true;
    window.addEventListener('keydown', _onGlobalEscape, true);
}

function _unbindGlobalEscape() {
    if (!globalEscBound) return;
    globalEscBound = false;
    window.removeEventListener('keydown', _onGlobalEscape, true);
}

function _onGlobalEscape(e) {
    // Enquanto uma tecla está sendo escutada, o ESC cancela a escuta
    // (tratado pelo listener de startListening, que chega primeiro por
    // ter sido registrado depois). Aqui só fechamos a tela quando não
    // há escuta ativa — e impedimos o ESC de fechar as opções por baixo.
    if (e.key !== 'Escape' || listening) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    playClickButtonSound();
    closeControlsScreen();
}