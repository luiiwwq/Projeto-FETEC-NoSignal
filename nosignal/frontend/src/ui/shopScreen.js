/**
 * shopScreen.js
 * In-game shop interface with the surface Ally NPC.
 * Styled following the game's Martian Sci-Fi pixel art aesthetic.
 */

import { gameState } from '../state/gameState.js';
import { playClickButtonSound } from '../audio/uiClickSound.js';

const ALLY_HELP_STORAGE_KEY = 'noSignal_allyBossHelpPurchased';

/** Verifica se a ajuda do aliado já foi comprada permanentemente. */
function _isAllyHelpPermanentlyPurchased() {
    try {
        return localStorage.getItem(ALLY_HELP_STORAGE_KEY) === 'true';
    } catch { return !!gameState.allyBossHelpPurchased; }
}

/** Marca a compra como permanente no localStorage. */
function _markAllyHelpPermanentlyPurchased() {
    try {
        localStorage.setItem(ALLY_HELP_STORAGE_KEY, 'true');
    } catch { /* sem suporte a localStorage */ }
}

export const SHOP_ITEMS = [
    {
        id: 'item_slot_1',
        name: 'Item 1',
        description: 'Espaço reservado para futuro item.',
        price: 10,
        type: 'placeholder'
    },
    {
        id: 'item_slot_2',
        name: 'Item 2',
        description: 'Espaço reservado para futuro item.',
        price: 10,
        type: 'placeholder'
    },
    {
        id: 'item_slot_3',
        name: 'Item 3',
        description: 'Espaço reservado para futuro item.',
        price: 10,
        type: 'placeholder'
    },
    {
        id: 'necro_ally_help',
        name: 'Ajuda no Boss Necromancer',
        description: 'O aliado surge na Sala do Rei para uma aparição rápida desferindo rajadas devastadoras no Boss.',
        price: 50,
        type: 'boss_assist'
    }
];

let shopOverlay = null;
let isOpen = false;
let engineRef = null;

export function isShopOpen() {
    return isOpen;
}

export function openShopScreen(container, engine) {
    if (isOpen) return;
    engineRef = engine;
    isOpen = true;

    if (engineRef) {
        engineRef.paused = true;
    }

    const mountTarget = container.querySelector('.game-viewport') || container;

    shopOverlay = document.createElement('div');
    shopOverlay.className = 'shop-modal-overlay';
    shopOverlay.id = 'shop-screen';

    shopOverlay.innerHTML = `
        <div class="shop-panel">
            <div class="shop-header">
                <div class="shop-title-wrap">
                    <span class="shop-header-icon">✦</span>
                    <h2 class="shop-title">LOJA DO ALIADO</h2>
                    <span class="shop-header-icon">✦</span>
                </div>
                <div class="shop-wallet">
                    <span class="shop-wallet-label">SUAS MOEDAS:</span>
                    <span class="shop-wallet-amount" id="shop-wallet-val">🪙 ${gameState.coins ?? 0}</span>
                </div>
            </div>

            <div class="shop-message-bar" id="shop-msg" style="display: none;"></div>

            <div class="shop-items-grid">
                ${SHOP_ITEMS.map((item, idx) => _renderItemCard(item, idx)).join('')}
            </div>

            <div class="shop-footer">
                <button class="shop-close-btn" id="shop-close-btn" type="button">
                    [ESC / E] VOLTAR AO JOGO
                </button>
            </div>
        </div>
    `;

    mountTarget.appendChild(shopOverlay);
    _bindShopEvents();
}

function _renderItemCard(item, index) {
    const isPurchased = item.type === 'boss_assist'
        ? _isAllyHelpPermanentlyPurchased()
        : (gameState.inventory && gameState.inventory.includes(item.id));

    const isSpecial = item.type === 'boss_assist';

    return `
        <div class="shop-card ${isSpecial ? 'shop-card-special' : ''} ${isPurchased ? 'is-bought' : ''}" data-item-id="${item.id}">
            <div class="shop-card-badge">${isSpecial ? '★ ESPECIAL' : `SLOT ${index + 1}`}</div>
            <div class="shop-card-name">${item.name}</div>
            <div class="shop-card-desc">${item.description}</div>
            <div class="shop-card-price">
                <span class="price-tag">VALOR:</span>
                <span class="price-val">🪙 ${item.price}</span>
            </div>
            <button class="shop-buy-btn ${isPurchased ? 'bought' : ''}" data-buy-id="${item.id}" ${isPurchased ? 'disabled' : ''}>
                ${isPurchased ? '✔ ADQUIRIDO' : `COMPRAR (${item.price} 🪙)`}
            </button>
        </div>
    `;
}

function _bindShopEvents() {
    if (!shopOverlay) return;

    // Fechar pelo botão
    const closeBtn = shopOverlay.querySelector('#shop-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            playClickButtonSound();
            closeShopScreen();
        });
    }

    // Botões de compra
    const buyBtns = shopOverlay.querySelectorAll('.shop-buy-btn');
    buyBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = btn.getAttribute('data-buy-id');
            _handlePurchase(itemId);
        });
    });

    // Tecla ESC ou E para fechar
    const keyHandler = (e) => {
        if (!isOpen) {
            window.removeEventListener('keydown', keyHandler, true);
            return;
        }
        if (e.code === 'Escape' || e.code === 'KeyE') {
            e.preventDefault();
            e.stopPropagation();
            playClickButtonSound();
            closeShopScreen();
        }
    };
    window.addEventListener('keydown', keyHandler, true);
}

function _handlePurchase(itemId) {
    const item = SHOP_ITEMS.find((it) => it.id === itemId);
    if (!item) return;

    const isPurchased = item.type === 'boss_assist'
        ? _isAllyHelpPermanentlyPurchased()
        : (gameState.inventory && gameState.inventory.includes(item.id));

    if (isPurchased) {
        _showShopMessage('Você já adquiriu este item!', 'warning');
        return;
    }

    if ((gameState.coins || 0) < item.price) {
        _showShopMessage('Moedas insuficientes!', 'error');
        return;
    }

    // Processa compra
    gameState.spendCoins(item.price);
    playClickButtonSound();

    if (item.type === 'boss_assist') {
        gameState.allyBossHelpPurchased = true;
        _markAllyHelpPermanentlyPurchased();
        _showShopMessage('Apoio Tático contratado! O aliado entrará na Sala do Rei. (Compra única permanente)', 'success');
    } else {
        if (!gameState.inventory) gameState.inventory = [];
        gameState.inventory.push(item.id);
        _showShopMessage(`${item.name} adquirido com sucesso!`, 'success');
    }

    // Atualiza carteira na tela
    const walletEl = shopOverlay?.querySelector('#shop-wallet-val');
    if (walletEl) {
        walletEl.textContent = `🪙 ${gameState.coins}`;
    }

    // Atualiza botão do item
    const card = shopOverlay?.querySelector(`[data-item-id="${item.id}"]`);
    if (card) {
        card.classList.add('is-bought');
        const btn = card.querySelector('.shop-buy-btn');
        if (btn) {
            btn.classList.add('bought');
            btn.setAttribute('disabled', 'true');
            btn.textContent = '✔ ADQUIRIDO';
        }
    }
}

function _showShopMessage(text, type = 'info') {
    const msgEl = shopOverlay?.querySelector('#shop-msg');
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className = `shop-message-bar msg-${type}`;
    msgEl.style.display = 'block';

    clearTimeout(msgEl._timer);
    msgEl._timer = setTimeout(() => {
        if (msgEl) msgEl.style.display = 'none';
    }, 3000);
}

export function closeShopScreen() {
    if (!isOpen) return;
    isOpen = false;

    if (shopOverlay) {
        shopOverlay.remove();
        shopOverlay = null;
    }

    if (engineRef) {
        engineRef.paused = false;
        // Evita reabrir instantaneamente se E estava pressionado
        engineRef.mapTransitionCooldown = 0.3;
    }
}
