/**
 * loadingScreen.js
 * Sci-Fi Loading Screen with retro progress bar and telemetry status.
 * Preloads all sprite assets via AssetLoader before launching GameEngine.
 */

import { assetLoader } from '../engine/AssetLoader.js';
import { GameEngine } from '../engine/GameEngine.js';
import { gameState } from '../state/gameState.js';
import { stopMenuMusic } from '../audio/menuMusic.js';
import { startGameMusic, preloadGameMusic } from '../audio/gameMusic.js';

export function renderLoadingScreen(container) {
    // O jogador deixou o menu: interrompe a música do menu antes do gameplay.
    stopMenuMusic();

    container.innerHTML = `
        <div class="loading-screen-wrapper">
            <div class="mars-grid-overlay"></div>

            <div class="loading-panel">
                <div class="loading-header">
                    <span class="pulse-beacon"></span>
                    <h2 class="loading-title">ESTABELECENDO CONEXÃO ORBITAL</h2>
                </div>

                <div class="loading-status-text" id="loading-status-text">
                    SINCRONIZANDO MÓDULOS DE POUSO...
                </div>

                <div class="loading-bar-container">
                    <div class="loading-bar-fill" id="loading-bar-fill" style="width: 0%;"></div>
                </div>

                <div class="loading-footer">
                    <span id="loading-counter">0 / 0 MÓDULOS</span>
                    <span id="loading-percent">0%</span>
                </div>
            </div>
        </div>
    `;

    const fillElement = document.getElementById('loading-bar-fill');
    const statusElement = document.getElementById('loading-status-text');
    const counterElement = document.getElementById('loading-counter');
    const percentElement = document.getElementById('loading-percent');

    const statusPhrases = [
        'INICIALIZANDO SUBSISTEMAS DO TRAJE...',
        'CALIBRANDO PROPULSORES DE MANOBRA...',
        'DESCOMPACTANDO MATRIZES DE ANIMAÇÃO...',
        'MAPEANDO TOPOGRAFIA DO SOLO MARCIANO...',
        'ESTABELECENDO LINK COM ARES-BASE...',
        'VERIFICANDO INTEGRIDADE DO CAPACETE...'
    ];

    let phraseIndex = 0;
    const phraseInterval = setInterval(() => {
        phraseIndex = (phraseIndex + 1) % statusPhrases.length;
        if (statusElement) {
            statusElement.innerText = statusPhrases[phraseIndex];
        }
    }, 450);

    // Pré-carrega a música do gameplay em paralelo com os sprites, para que
    // o play() no início da partida já tenha o buffer pronto (início imediato).
    const musicReady = preloadGameMusic();

    // Run preload
    assetLoader.preloadAll((progress, loaded, total) => {
        const pct = Math.floor(progress * 100);
        if (fillElement) fillElement.style.width = `${pct}%`;
        if (counterElement) counterElement.innerText = `${loaded} / ${total} MÓDULOS`;
        if (percentElement) percentElement.innerText = `${pct}%`;
    }, gameState.selectedCharacter).then(() => musicReady).then(() => {
        clearInterval(phraseInterval);
        if (statusElement) statusElement.innerText = 'POUSO AUTORIZADO! INICIANDO SIMULAÇÃO...';
        if (fillElement) fillElement.style.width = '100%';
        if (percentElement) percentElement.innerText = '100%';

        setTimeout(() => {
            // O jogador deixou o menu: a música ambiente do gameplay assume.
            startGameMusic();
            const engine = new GameEngine(container);
            engine.init();
        }, 500);
    }).catch((err) => {
        clearInterval(phraseInterval);
        console.error('[AssetLoader] Error preloading:', err);
        if (statusElement) {
            statusElement.innerText = 'AVISO: FALHA PARCIAL NO CARREGAMENTO. INICIANDO...';
        }
        setTimeout(() => {
            startGameMusic();
            const engine = new GameEngine(container);
            engine.init();
        }, 800);
    });
}
