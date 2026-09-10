/**
 * gameState.js
 * Central state store for No Signal game session.
 */

export const gameState = {
    playerName: 'ARES-1',
    currentScene: 'TITLE', // 'TITLE', 'NAME_ENTRY', 'LOADING', 'GAMEPLAY'
    playerHp: 100,
    maxPlayerHp: 100,
    activeEngine: null,

    reset() {
        this.playerHp = 100;
        this.currentScene = 'TITLE';
        if (this.activeEngine) {
            this.activeEngine.stop();
            this.activeEngine = null;
        }
    }
};
