/**
 * controlsStorage.js
 * Bindings de controles do jogador (teclas do jogo).
 *
 * Cada ação mapeia para uma lista de `e.code` aceitos (o primeiro é o
 * binding "principal", os demais são fallbacks — ex.: setas para movimento).
 * A config fica no localStorage e é espelhada no Supabase por nome de
 * astronauta (ver services/controlsRemote.js), de modo que o mesmo nome
 * carrega os mesmos botões em qualquer máquina.
 */

const CONTROLS_KEY = 'nosignal.controls.v1';

export const DEFAULT_CONTROLS = {
    moveUp: ['KeyW', 'ArrowUp'],
    moveDown: ['KeyS', 'ArrowDown'],
    moveLeft: ['KeyA', 'ArrowLeft'],
    moveRight: ['KeyD', 'ArrowRight'],
    sprint: ['ShiftLeft', 'ShiftRight'],
    jump: ['Space'],
    dash: ['KeyQ'],
    interact: ['KeyE'],
    float: ['KeyF'],
    emote: ['KeyP'],
    item1: ['Digit1'],
    item2: ['Digit2'],
    item3: ['Digit3'],
    shoot: ['MouseLeft'],
    punch: ['MouseRight']
};

// Ordem em que as ações aparecem na HUD de remap.
export const CONTROL_ACTIONS = [
    { action: 'moveUp', label: 'MOVER CIMA' },
    { action: 'moveDown', label: 'MOVER BAIXO' },
    { action: 'moveLeft', label: 'MOVER ESQUERDA' },
    { action: 'moveRight', label: 'MOVER DIREITA' },
    { action: 'sprint', label: 'CORRER' },
    { action: 'jump', label: 'PULAR' },
    { action: 'dash', label: 'DASH' },
    { action: 'interact', label: 'INTERAGIR' },
    { action: 'float', label: 'EMOTE FLUTUAR' },
    { action: 'emote', label: 'EMOTE PUXAR' },
    { action: 'item1', label: 'ITEM 1' },
    { action: 'item2', label: 'ITEM 2' },
    { action: 'item3', label: 'ITEM 3' },
    { action: 'shoot', label: 'ATIRAR' },
    { action: 'punch', label: 'SOCAR' }
];

let cached = null;

function sanitize(raw) {
    if (!raw || typeof raw !== 'object') {
        return Object.fromEntries(
            Object.entries(DEFAULT_CONTROLS).map(([action, codes]) => [action, [...codes]])
        );
    }
    const out = {};
    for (const action in DEFAULT_CONTROLS) {
        const codes = raw[action];
        out[action] = Array.isArray(codes) && codes.length > 0
            ? codes.filter((c) => typeof c === 'string')
            : [...DEFAULT_CONTROLS[action]];
        if (out[action].length === 0) out[action] = [...DEFAULT_CONTROLS[action]];
    }
    return out;
}

function safeRead() {
    try {
        return JSON.parse(localStorage.getItem(CONTROLS_KEY));
    } catch (err) {
        return null;
    }
}

function safeWrite(data) {
    try {
        localStorage.setItem(CONTROLS_KEY, JSON.stringify(data));
    } catch (err) {
        // Storage indisponível (ex.: modo privado) — mantém apenas em memória.
    }
}

/** Carrega os binds salvos no localStorage (ou os padrões). */
export function loadControls() {
    if (cached) return { ...cached };
    cached = sanitize(safeRead());
    return { ...cached };
}

/** Substitui TODOS os binds (uso interno ao carregar do servidor). */
export function applyControls(controls) {
    cached = sanitize(controls);
    safeWrite(cached);
    return { ...cached };
}

/** Restaura os binds padrão e persiste. */
export function resetControls() {
    cached = sanitize(DEFAULT_CONTROLS);
    safeWrite(cached);
    return { ...cached };
}

/**
 * Define um novo código para a ação. `index` indica qual slot é substituído
 * (0 = binding principal; os demais são fallbacks como as setas). O novo
 * código é removido das outras ações (sem duplicidade) e o slot é trocado,
 * mantendo os demais binds da ação intactos.
 */
export function setActionCode(action, code, index = 0) {
    const controls = loadControls();
    if (!(action in controls)) return controls;

    // Remove o novo código de todas as outras ações.
    for (const key in controls) {
        if (key === action) continue;
        controls[key] = controls[key].filter((c) => c !== code);
    }

    const target = Math.max(0, Math.min(index, controls[action].length - 1));
    const previous = controls[action][target];
    const codes = controls[action].filter((c, i) => i !== target && c !== code);
    codes.splice(Math.min(target, codes.length), 0, code);

    controls[action] = codes.length > 0 ? codes : [...DEFAULT_CONTROLS[action]];

    // Nenhuma ação pode ficar vazia.
    for (const key in controls) {
        if (controls[key].length === 0) controls[key] = [...DEFAULT_CONTROLS[key]];
    }

    cached = sanitize(controls);
    safeWrite(cached);
    return { ...cached };
}

/** Códigos aceitos para uma ação. */
export function getActionCodes(action) {
    const controls = loadControls();
    return (controls[action] || []).slice();
}

/** true se `code` está entre os códigos aceitos da ação. */
export function isBound(action, code) {
    return getActionCodes(action).includes(code);
}

/** true se ao menos um código da ação está pressionado em `keys`. */
export function isActionDown(action, keys) {
    const codes = getActionCodes(action);
    return codes.some((code) => keys[code] === true);
}

/** Consulta o binding de combate configurado, seja ele mouse ou teclado. */
export function isCombatActionDown(action, input) {
    return getActionCodes(action).some((code) => {
        if (code === 'MouseLeft') return !!input.mouseLeft;
        if (code === 'MouseRight') return !!input.mouseRight;
        if (code === 'MouseMiddle') return !!input.mouseMiddle;
        if (code === 'Mouse4') return !!input.mouse4;
        if (code === 'Mouse5') return !!input.mouse5;
        return input.keys?.[code] === true;
    });
}

/** Vários binds simultâneos da mesma ação compartilham a mesma tecla? Não. */
export function findActionByCode(controls, code) {
    for (const action in controls) {
        if (controls[action].includes(code)) return action;
    }
    return null;
}

/** Nome curto da tecla para exibir na HUD (ex.: KeyW -> W). */
export function codeDisplay(code) {
    if (!code) return '—';
    const map = {
        Space: 'ESPAÇO',
        ShiftLeft: 'SHIFT',
        ShiftRight: 'SHIFT',
        ControlLeft: 'CTRL',
        ControlRight: 'CTRL',
        AltLeft: 'ALT',
        AltRight: 'ALT',
        MouseLeft: 'L-CLICK',
        MouseRight: 'R-CLICK',
        MouseMiddle: 'M-CLICK',
        Mouse4: 'M4',
        Mouse5: 'M5',
        ArrowUp: '↑',
        ArrowDown: '↓',
        ArrowLeft: '←',
        ArrowRight: '→',
        Semicolon: 'Ç'
    };
    if (map[code]) return map[code];
    if (/^Digit\d$/.test(code)) return code.slice(5);
    if (/^Key[A-Z]$/.test(code)) return code.slice(3);
    if (/^F\d+$/.test(code)) return code;
    return code;
}
