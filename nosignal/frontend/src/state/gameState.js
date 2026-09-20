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
        nightCount: 0,
        waveCount: 0
    },

    // Economia e loja
    coins: 50, // Saldo inicial generoso para permitir testes imediatos
    inventory: [], // IDs de itens comprados
    allyBossHelpPurchased: (() => { try { return localStorage.getItem('noSignal_allyBossHelpPurchased') === 'true'; } catch { return false; } })(),

    // Estado permanente de chefes e áreas da sessão
    necromancerDefeated: false,
    skeletonAxeBossDefeated: false,
    catacombsCleared: false,

    addCoins(amount) {
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

    reset() {
        this.playerHp = 105;
        this.maxPlayerHp = 105;
        this.currentScene = 'TITLE';
        this.coins = 50;
        this.inventory = [];
        this.upgrades = [];
        this.necromancerDefeated = false;
        this.skeletonAxeBossDefeated = false;
        this.catacombsCleared = false;
        try {
            localStorage.removeItem('noSignal_allyBossHelpPurchased');
        } catch { /* sem suporte a localStorage */ }
        this.allyBossHelpPurchased = false;
        this.dayNight = {
            period: DAY_NIGHT_PERIOD.DAY,
            remainingTime: DAY_NIGHT_DURATION,
            nightCount: 0,
            waveCount: 0
        };
        if (this.activeEngine) {
            this.activeEngine.stop();
            this.activeEngine = null;
        }
    }
};
