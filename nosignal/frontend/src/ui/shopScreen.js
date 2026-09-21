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
        id: 'cura_alienigena',
        name: 'Cura Alienígena',
        description: 'Poção marciana: restaura 30 de vida instantaneamente. Uso infinito · recarga 15s.',
        price: 20,
        type: 'consumable',
        effect: 'heal_30',
        sprite: '✚'
    },
    {
        id: 'energia_duna',
        name: 'Energia de Duna',
        description: 'Poção da tempestade: eleva a ENERGIA a 150 durante 4.5 segundos. Uso infinito · recarga 15s.',
        price: 20,
        type: 'consumable',
        effect: 'energy_boost',
        sprite: '⚡'
    },
    {
        id: 'item_slot_3',
        name: 'Item 3',
        description: 'Espaço reservado para um futuro item.',
        price: 10,
        type: 'placeholder',
        sprite: '?'
    },
    {
        id: 'necro_ally_help',
        name: 'Ajuda no Boss Necromancer',
        description: 'O aliado surge na Sala do Rei para uma aparição rápida desferindo rajadas devastadoras no Boss.',
        price: 50,
        type: 'boss_assist',
        sprite: '★'
    }
];

let shopOverlay = null;
let isOpen = false;
let engineRef = null;

export function isShopOpen() {
    return isOpen;
}

/**
 * Retorna o item associado ao slot do hotbar (1, 2 ou 3).
 * Os slots são preenchidos pela ORDEM de compra (igual aos upgrades):
 * o primeiro consumível comprado vai para o slot 1, o segundo para o 2, etc.
 */
export function getSlotItem(slot) {
    const itemId = gameState.getHotbarItemId(slot);
    return SHOP_ITEMS.find((it) => it.id === itemId) || null;
}

/**
 * Consome o item do slot (teclas 1/2/3). Uso infinito após a compra, mas
 * cada item tem recarga de 15s entre usos.
 * Retorna { used, message } para o engine dar o feedback no HUD.
 */
export function consumeInventorySlot(slot, player) {
    const item = getSlotItem(slot);
    if (!item || item.type !== 'consumable') return { used: false, message: '' };
    if (gameState.getItemPurchases(item.id) < 1) return { used: false, message: '' };

    // Recarga de 15s por item (uso infinito, mas sem spam)
    if (gameState.getItemCooldown(item.id) > 0) {
        const secs = Math.ceil(gameState.getItemCooldown(item.id));
        return { used: false, message: `${item.name}: recarregando ${secs}s` };
    }

    gameState.setItemCooldown(item.id, 15);

    let message = '';
    if (item.effect === 'heal_30') {
        player.heal(30);
        message = `${item.name}: +30 VIDA`;
    } else if (item.effect === 'energy_boost') {
        player.boostEnergy(150, 4.5);
        message = `${item.name}: ENERGIA 150 · 4.5s`;
    }

    return { used: true, message };
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
    const isSpecial = item.type === 'boss_assist';
    const isPlaceholder = item.type === 'placeholder';
    const isConsumable = item.type === 'consumable';

    const isPurchased = isSpecial
        ? _isAllyHelpPermanentlyPurchased()
        : (isConsumable && gameState.getItemPurchases(item.id) >= 1);
    const purchaseCount = isConsumable ? gameState.getItemPurchases(item.id) : 0;
    const isMaxed = isConsumable && purchaseCount >= 3;

    // Campo "compra única permanente" ou "limite 3/3" / contador
    const badgeText = isSpecial
        ? '★ ESPECIAL'
        : isPlaceholder
            ? 'EM BREVE'
            : `${purchaseCount}/3`;

    let btnText;
    let btnDisabled = false;
    if (isPlaceholder) {
        btnText = 'EM BREVE';
        btnDisabled = true;
    } else if (isSpecial && isPurchased) {
        btnText = '✔ ADQUIRIDO';
        btnDisabled = true;
    } else if (isConsumable && isMaxed) {
        btnText = `✔ MÁXIMO (${purchaseCount}/3)`;
        btnDisabled = true;
    } else {
        btnText = `COMPRAR (${item.price} 🪙)`;
    }

    return `
        <div class="shop-card ${isSpecial ? 'shop-card-special' : ''} ${isMaxed || (isSpecial && isPurchased) ? 'is-bought' : ''}" data-item-id="${item.id}">
            <div class="shop-card-sprite" data-item-id="${item.id}">
                <span>${item.sprite || '?'}</span>
            </div>
            <div class="shop-card-badge">${badgeText}</div>
            <div class="shop-card-name">${item.name}</div>
            <div class="shop-card-desc">${item.description}</div>
            <div class="shop-card-price">
                <span class="price-tag">VALOR:</span>
                <span class="price-val">🪙 ${item.price}</span>
            </div>
            <button class="shop-buy-btn ${btnDisabled ? 'bought' : ''}" data-buy-id="${item.id}" ${btnDisabled ? 'disabled' : ''}>
                ${btnText}
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

    if (item.type === 'placeholder') {
        _showShopMessage('Este item chega em breve!', 'warning');
        return;
    }

    if (item.type === 'boss_assist') {
        if (_isAllyHelpPermanentlyPurchased()) {
            _showShopMessage('Você já adquiriu este item!', 'warning');
            return;
        }
        if ((gameState.coins || 0) < item.price) {
            _showShopMessage('Moedas insuficientes!', 'error');
            return;
        }
        gameState.spendCoins(item.price);
        playClickButtonSound();
        gameState.allyBossHelpPurchased = true;
        _markAllyHelpPermanentlyPurchased();
        _showShopMessage('Apoio Tático contratado! O aliado entrará na Sala do Rei. (Compra única permanente)', 'success');

        _refreshShopPurchaseState(item, true);
        _updateWallet();
        return;
    }

    // Consumável: uso infinito, limite de 3 compras
    const purchases = gameState.getItemPurchases(item.id);
    if (purchases >= 3) {
        _showShopMessage(`${item.name}: limite de compra atingido (3/3)!`, 'warning');
        return;
    }
    if ((gameState.coins || 0) < item.price) {
        _showShopMessage('Moedas insuficientes!', 'error');
        return;
    }

    gameState.spendCoins(item.price);
    playClickButtonSound();
    const newCount = gameState.addItemPurchase(item.id);

    _showShopMessage(`${item.name}: ${newCount}/3 adquirido!`, 'success');
    _updateWallet();
    _refreshShopPurchaseState(item, newCount >= 3);
}

function _updateWallet() {
    const walletEl = shopOverlay?.querySelector('#shop-wallet-val');
    if (walletEl) {
        walletEl.textContent = `🪙 ${gameState.coins}`;
    }
}

// Atualiza card + botão na tela após uma compra sem re-renderizar tudo.
function _refreshShopPurchaseState(item, isMaxed) {
    const card = shopOverlay?.querySelector(`[data-item-id="${item.id}"]`);
    if (!card) return;
    const btn = card.querySelector('.shop-buy-btn');
    if (!btn) return;

    card.querySelector('.shop-card-badge').textContent = isMaxed ? '3/3' : `${gameState.getItemPurchases(item.id)}/3`;

    if (isMaxed) {
        card.classList.add('is-bought');
        btn.classList.add('bought');
        btn.setAttribute('disabled', 'true');
        btn.textContent = `✔ MÁXIMO (${gameState.getItemPurchases(item.id)}/3)`;
    } else {
        btn.textContent = `COMPRAR (${item.price} 🪙)`;
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
