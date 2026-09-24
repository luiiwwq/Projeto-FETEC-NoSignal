/**
 * shopScreen.js
 * In-game shop interface with the surface Ally NPC.
 * Styled following the game's Martian Sci-Fi pixel art aesthetic.
 */

import { gameState } from '../state/gameState.js';
import { playClickButtonSound } from '../audio/uiClickSound.js';
import { isBound } from '../state/controlsStorage.js';

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
        description: 'Poção marciana: restaura 30 de vida, 1 dose por tecla (2 doses = +60). Uso infinito · recarga 15s por dose.',
        price: 20,
        type: 'consumable',
        effect: 'heal',
        amountPerUse: 30,
        cooldownPerUse: 15,
        sprite: '✚',
        iconPath: './src/assets/sprites/Itens/health_potion/item_health.png'
    },
    {
        id: 'energia_duna',
        name: 'Energia de Duna',
        description: 'Poção da tempestade: soma +25 de ENERGIA, 1 dose por tecla (2 doses = +50). Uso infinito · recarga 15s por dose.',
        price: 20,
        type: 'consumable',
        effect: 'energy',
        amountPerUse: 25,
        durationPerUse: 4.5,
        cooldownPerUse: 15,
        sprite: '⚡',
        iconPath: './src/assets/sprites/Itens/energy_potion/energy_item.png'
    },
    {
        id: 'cadencia_frenetica',
        name: 'Cadência Frenética',
        description: 'Estimulante de combate: +15% de CADÊNCIA no tiro, 1 dose por tecla (2 doses = +30%). Uso infinito · recarga 15s por dose.',
        price: 20,
        type: 'consumable',
        effect: 'attack_speed',
        amountPerUse: 0.15,
        durationPerUse: 4.5,
        cooldownPerUse: 15,
        sprite: '»',
        iconPath: './src/assets/sprites/Itens/attack_speed_potion/attack_speed_potion_item.png'
    },
    {
        id: 'necro_ally_help',
        name: 'Ajuda contra o Rei',
        description: 'O aliado surge na Sala do Rei para uma aparição rápida desferindo rajadas devastadoras no Boss.',
        price: 50,
        type: 'boss_assist',
        sprite: 'A',
        iconPath: './src/assets/sprites/Itens/helper_ally/ally_helper.png'
    }
];

// Quadros da animação de "quebrando" de cada item (frascos se partindo).
const ITEM_ASSETS = {
    cura_alienigena: {
        framePaths: Array.from({ length: 8 }, (_, i) =>
            `./src/assets/sprites/Itens/health_potion/health_animation/frame_${String(i + 1).padStart(2, '0')}.png`)
    },
    energia_duna: {
        framePaths: Array.from({ length: 8 }, (_, i) =>
            `./src/assets/sprites/Itens/energy_potion/energy_animation/frame_${String(i + 1).padStart(2, '0')}.png`)
    },
    cadencia_frenetica: {
        framePaths: Array.from({ length: 8 }, (_, i) =>
            `./src/assets/sprites/Itens/attack_speed_potion/attack_speed_potion_animation/frame_${String(i + 1).padStart(2, '0')}.png`)
    }
};

export function getItemIconPath(itemId) {
    return SHOP_ITEMS.find((it) => it.id === itemId)?.iconPath || null;
}

export function getItemFramePaths(itemId) {
    return ITEM_ASSETS[itemId]?.framePaths || null;
}

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
 * Consome o item do slot (teclas 1/2/3). Uso infinito após a compra, mas cada
 * tecla usa 1 dose: apertou N vezes, usou N doses (cada dose soma 15s de
 * recarga e seu efeito). O total de doses por carga é limitado pelo nº de
 * compras (1..3); ao fim da recarga, a carga inteira volta.
 * Retorna { used, message } para o engine dar o feedback no HUD.
 */
export function consumeInventorySlot(slot, player) {
    const item = getSlotItem(slot);
    if (!item || item.type !== 'consumable') return { used: false, message: '' };
    const stacks = gameState.getItemPurchases(item.id);
    if (stacks < 1) return { used: false, message: '' };

    // Todas as doses da carga já foram usadas: só volta após a recarga.
    const dosesUsed = gameState.getItemActivationUses(item.id);
    if (dosesUsed >= stacks) {
        const secs = Math.ceil(gameState.getItemCooldown(item.id));
        return { used: false, message: `${item.name}: recarregando ${secs}s` };
    }

    // Cada dose soma 15s à recarga compartilhada do item.
    const newDoses = dosesUsed + 1;
    gameState.setItemActivationUses(item.id, newDoses);
    gameState.setItemCooldown(item.id, (item.cooldownPerUse ?? 15) * newDoses);

    let message = '';
    if (item.effect === 'heal') {
        const amount = item.amountPerUse ?? 0;
        player.heal(amount);
        message = `${item.name}: +${amount} VIDA`;
    } else if (item.effect === 'energy') {
        const amount = item.amountPerUse ?? 0;
        const duration = item.durationPerUse ?? 0;
        player.boostEnergy(amount, duration);
        message = `${item.name}: +${amount} ENERGIA`;
    } else if (item.effect === 'attack_speed') {
        const percent = item.amountPerUse ?? 0;
        const duration = item.durationPerUse ?? 0;
        player.boostFireRate(percent, duration);
        message = `${item.name}: +${Math.round(percent * 100)}% CADÊNCIA`;
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

    // Badge text - special item shows 1/1 when purchased, consumables show X/3
    let badgeText;
    if (isPlaceholder) {
        badgeText = 'EM BREVE';
    } else if (isSpecial) {
        badgeText = isPurchased ? '★ ADQUIRIDO (1/1)' : '★ ESPECIAL (1/1)';
    } else {
        badgeText = `${purchaseCount}/3`;
    }

    let btnText;
    let btnDisabled = false;
    if (isPlaceholder) {
        btnText = 'EM BREVE';
        btnDisabled = true;
    } else if (isSpecial && isPurchased) {
        btnText = '✔ ADQUIRIDO';
        btnDisabled = true;
    } else if (isConsumable && isMaxed) {
        btnText = `✔ MÁXIMO (3/3)`;
        btnDisabled = true;
    } else {
        btnText = `COMPRAR`;
    }

    // Stats para consumíveis
    let statsHtml = '';
    if (isConsumable) {
        const effects = {
            cura_alienigena: { label: 'CURA', value: '+30 HP' },
            energia_duna: { label: 'ENERGIA', value: '+25' },
            cadencia_frenetica: { label: 'CADÊNCIA', value: '+15%' }
        };
        const eff = effects[item.id];
        if (eff) {
            statsHtml = `
                <div class="shop-card-stats">
                    <span class="shop-stat">${eff.label}: <span class="shop-stat-value">${eff.value}</span></span>
                    <span class="shop-stat">RECARGA: <span class="shop-stat-value">15s</span></span>
                </div>
            `;
        }
    } else if (isSpecial) {
        statsHtml = `
            <div class="shop-card-stats">
                <span class="shop-stat">TIPO: <span class="shop-stat-value">APOIO TÁTICO</span></span>
                <span class="shop-stat">USO: <span class="shop-stat-value">ÚNICO</span></span>
            </div>
        `;
    }

    // Purchase count badge for bottom left - only show when NOT purchased/maxed
    const showPurchaseBadge = (isConsumable && !isMaxed) || (isSpecial && !isPurchased);
    const purchaseBadge = showPurchaseBadge
        ? (isConsumable
            ? `<div class="shop-card-purchase-badge">${purchaseCount}/3</div>`
            : `<div class="shop-card-purchase-badge">0/1</div>`)
        : '';

    return `
        <div class="shop-card ${isSpecial ? 'shop-card-special' : ''} ${isMaxed || (isSpecial && isPurchased) ? 'is-bought' : ''}" data-item-id="${item.id}">
            <div class="shop-card-sprite" data-item-id="${item.id}">
                ${item.iconPath
                    ? `<img src="${item.iconPath}" alt="${item.name}" draggable="false" loading="lazy">`
                    : `<span>${item.sprite || '?'}</span>`}
            </div>
            <div class="shop-card-info">
                <div class="shop-card-badge">${badgeText}</div>
                <div class="shop-card-name">${item.name}</div>
                <div class="shop-card-desc">${item.description}</div>
                ${statsHtml}
                <div class="shop-card-price">
                    <span class="price-tag">VALOR:</span>
                    <span class="price-val">🪙 ${item.price}</span>
                </div>
                <button class="shop-buy-btn ${btnDisabled ? 'bought' : ''}" data-buy-id="${item.id}" ${btnDisabled ? 'disabled' : ''}>
                    ${btnText}
                </button>
            </div>
            ${purchaseBadge}
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
        if (e.code === 'Escape' || isBound('interact', e.code)) {
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

// Atualiza card + botão + badge inferior na tela após uma compra sem re-renderizar tudo.
function _refreshShopPurchaseState(item, isMaxed) {
    const card = shopOverlay?.querySelector(`[data-item-id="${item.id}"]`);
    if (!card) return;
    const btn = card.querySelector('.shop-buy-btn');
    if (!btn) return;

    const isSpecial = item.type === 'boss_assist';
    const purchaseCount = gameState.getItemPurchases(item.id);
    const isPurchased = isSpecial ? _isAllyHelpPermanentlyPurchased() : purchaseCount >= 1;

    // Atualiza badge superior
    let badgeText;
    if (isSpecial) {
        badgeText = isPurchased ? '★ ADQUIRIDO (1/1)' : '★ ESPECIAL (1/1)';
    } else {
        badgeText = isMaxed ? '3/3' : `${purchaseCount}/3`;
    }
    card.querySelector('.shop-card-badge').textContent = badgeText;

    // Atualiza badge inferior (contador de compras)
    const purchaseBadge = card.querySelector('.shop-card-purchase-badge');
    if (purchaseBadge) {
        if (isSpecial) {
            purchaseBadge.textContent = isPurchased ? '1/1' : '0/1';
            if (isPurchased) purchaseBadge.style.display = 'none';
        } else {
            purchaseBadge.textContent = `${purchaseCount}/3`;
            if (isMaxed) purchaseBadge.style.display = 'none';
        }
    }

    if (isMaxed || (isSpecial && isPurchased)) {
        card.classList.add('is-bought');
        btn.classList.add('bought');
        btn.setAttribute('disabled', 'true');
        if (isSpecial) {
            btn.textContent = '✔ ADQUIRIDO';
        } else {
            btn.textContent = `✔ MÁXIMO (3/3)`;
        }
    } else {
        btn.textContent = `COMPRAR`;
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
