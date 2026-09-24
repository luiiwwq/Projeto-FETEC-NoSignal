/**
 * gameState.js
 * Central state store for No Signal game session.
 */

import { DAY_NIGHT_DURATION, DAY_NIGHT_PERIOD } from '../systems/dayNightSystem.js';

export const gameState = {
    playerName: 'ARES-1',
    currentScene: 'TITLE', // 'TITLE', 'NAME_ENTRY', 'LOADING', 'GAMEPLAY'
    selectedCharacter: null, // 'astronaut' | 'space-lizard' | 'ocstronaut' — escolhido no characterSelectScreen
    playerHp: 105,
    maxPlayerHp: 105,
    activeEngine: null,
    activeEnding: null,
    currentMap: 'mars-surface',
    lastCavePath: null, // 'nucleo-marte' | 'catacumbas' — caminho de caverna escolhido no caveChoiceScreen

    // Sistema de Upgrades (ordem de obtenção preservada)
    // IDs: 'damage_up' (+20% dano), 'life_up' (+25 vida máx -> 130), 'movespeed_up' (+10% velocidade)
    upgrades: [],

    hasUpgrade(id) {
        return Array.isArray(this.upgrades) && this.upgrades.includes(id);
    },

    addUpgrade(id) {
        if (!Array.isArray(this.upgrades)) this.upgrades = [];
        if (!this.upgrades.includes(id)) {
            this.upgrades.push(id);
            return true;
        }
        return false;
    },

    // Ciclo dia/noite global da sessão (sobrevive à troca de mapas; reset só
    // em nova sessão). O GameEngine mantém a instância viva e espelha aqui.
    dayNight: {
        period: DAY_NIGHT_PERIOD.DAY,
        remainingTime: DAY_NIGHT_DURATION,
        dayCount: 1,
        nightCount: 0,
        waveCount: 0
    },

    // Economia e loja
    coins: 50, // Saldo inicial generoso para permitir testes imediatos
    totalCoinsEarned: 0, // Apenas moedas coletadas durante a partida (não inclui saldo inicial)
    deaths: 0,
    inventory: [], // (legado) IDs de itens já comprados
    itemPurchases: {}, // itemId -> nº de compras (máx 3; consumíveis com uso infinito)
    hotbarOrder: [], // ordem de compra dos consumíveis: [0]=slot 1, [1]=slot 2, [2]=slot 3
    itemCooldowns: {}, // itemId -> segundos restantes da recarga compartilhada
    itemActivationUses: {}, // itemId -> doses usadas na carga atual (máx = compras; zera quando a recarga termina)
    allyBossHelpPurchased: (() => { try { return localStorage.getItem('noSignal_allyBossHelpPurchased') === 'true'; } catch { return false; } })(),

    // Estado permanente de chefes e áreas da sessão
    necromancerDefeated: false,
    skeletonAxeBossDefeated: false,
    catacombsCleared: false,

    // Flags de sessão: cutscene de introdução já exibida (não persiste nem
    // reseta em retry — só em nova partida). Impede que a cutscene toque de
    // novo após o jogador morrer e retornar à sala do boss.
    necroIntroDone: false,
    axeBossIntroDone: false,

    // Missão principal — "Conserte a nave e saia de Duna".
    // missionCollected: ids ('motor' | 'meio' | 'ponta') já coletados.
    // missionDrops:     itemId -> { mapId, x, y } para os itens dropados pelos
    //                   chefes (persistem ao trocar de mapa; o item do meio da
    //                   nave nasce já na superfície).
    // spaceshipRepaired: true depois de instalar as 3 peças na nave.
    missionCollected: [],
    missionDrops: {},
    spaceshipRepaired: false,
    enemyNpcDefeated: false, // o terceiro astronauta não reaparece após ser derrotado
    missionConcluded: false,

    hasMissionItem(id) {
        return Array.isArray(this.missionCollected) && this.missionCollected.includes(id);
    },

    addMissionItem(id) {
        if (!Array.isArray(this.missionCollected)) this.missionCollected = [];
        if (!this.missionCollected.includes(id)) {
            this.missionCollected.push(id);
            return true;
        }
        return false;
    },

    isMissionComplete() {
        const collected = Array.isArray(this.missionCollected) ? this.missionCollected : [];
        return ['motor', 'meio', 'ponta'].every((id) => collected.includes(id));
    },

    addCoins(amount) {
        if (amount > 0) this.totalCoinsEarned += amount;
        this.coins = Math.max(0, (this.coins || 0) + amount);
        return this.coins;
    },

    spendCoins(amount) {
        if ((this.coins || 0) >= amount) {
            this.coins -= amount;
            return true;
        }
        return false;
    },

    // Itens consumíveis: uso infinito após a 1ª compra, limite de 3 compras.
    getItemPurchases(itemId) {
        return this.itemPurchases[itemId] || 0;
    },
    addItemPurchase(itemId) {
        if (!this.itemPurchases[itemId]) this.itemPurchases[itemId] = 0;
        this.itemPurchases[itemId]++;
        if (!this.hotbarOrder.includes(itemId)) this.hotbarOrder.push(itemId);
        return this.itemPurchases[itemId];
    },
    // Slot do hotbar (1-3) preenchido pela ORDEM de compra (como os upgrades).
    getHotbarItemId(slot) {
        return this.hotbarOrder[slot - 1] || null;
    },
    getItemCooldown(itemId) {
        return this.itemCooldowns[itemId] || 0;
    },
    setItemCooldown(itemId, seconds) {
        this.itemCooldowns[itemId] = Math.max(0, seconds);
    },
    getItemActivationUses(itemId) {
        return this.itemActivationUses[itemId] || 0;
    },
    setItemActivationUses(itemId, uses) {
        this.itemActivationUses[itemId] = Math.max(0, uses);
    },
    tickItemCooldowns(dt) {
        for (const id in this.itemCooldowns) {
            if (this.itemCooldowns[id] > 0) {
                this.itemCooldowns[id] = Math.max(0, this.itemCooldowns[id] - dt);
                // Fim da recarga: as doses da carga voltam a ficar disponíveis.
                if (this.itemCooldowns[id] <= 0) {
                    this.itemActivationUses[id] = 0;
                }
            }
        }
    },

    reset() {
        this.playerHp = 105;
        this.maxPlayerHp = 105;
        this.currentScene = 'TITLE';
        this.activeEnding = null;
        this.coins = 50;
        this.totalCoinsEarned = 0;
        this.deaths = 0;
        this.inventory = [];
        this.itemPurchases = {};
        this.hotbarOrder = [];
        this.itemCooldowns = {};
        this.itemActivationUses = {};
        this.upgrades = [];
        this.necromancerDefeated = false;
        this.skeletonAxeBossDefeated = false;
        this.catacombsCleared = false;
        this.necroIntroDone = false;
        this.axeBossIntroDone = false;
        this.missionCollected = [];
        this.missionDrops = {};
        this.spaceshipRepaired = false;
        this.enemyNpcDefeated = false;
        this.missionConcluded = false;
        try {
            localStorage.removeItem('noSignal_allyBossHelpPurchased');
        } catch { /* sem suporte a localStorage */ }
        this.allyBossHelpPurchased = false;
        this.dayNight = {
            period: DAY_NIGHT_PERIOD.DAY,
            remainingTime: DAY_NIGHT_DURATION,
            dayCount: 1,
            nightCount: 0,
            waveCount: 0
        };
        if (this.activeEngine) {
            this.activeEngine.stop();
            this.activeEngine = null;
        }
    }
};
