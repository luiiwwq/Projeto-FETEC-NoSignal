/**
 * gameState.js
 * Central state store for No Signal game session.
 */

import { DAY_NIGHT_DURATION, DAY_NIGHT_PERIOD } from '../systems/dayNightSystem.js';

export const gameState = {
    playerName: 'ARES-1',
    currentScene: 'TITLE', // 'TITLE', 'NAME_ENTRY', 'LOADING', 'GAMEPLAY'
    selectedCharacter: null, // 'astronaut' | 'space-lizard' | 'ocstronaut' — escolhido no characterSelectScreen
    playerHp: 100,
    maxPlayerHp: 100,
    activeEngine: null,
    currentMap: 'mars-surface',
    lastCavePath: null, // 'nucleo-marte' | 'catacumbas' — caminho de caverna escolhido no caveChoiceScreen

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
    allyBossHelpPurchased: false, // Flag de assistência tática no Necromancer

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
        this.playerHp = 100;
        this.currentScene = 'TITLE';
        this.coins = 50;
        this.inventory = [];
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
