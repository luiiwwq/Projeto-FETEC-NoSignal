/**
 * BossCutscenePlayer.js
 * Exibe um vídeo de cutscene fullscreen sobre o canvas do jogo.
 *
 * Uso:
 *   import { playBossCutscene } from './BossCutscenePlayer.js';
 *   await playBossCutscene(container, './src/assets/cutscenes/necro/cutscene_necro.mp4');
 *
 * Retorna uma Promise que resolve quando:
 *   - O vídeo termina naturalmente (evento 'ended')
 *   - O jogador clica no botão PULAR ou pressiona ENTER
 */

import { loadSettings } from '../state/stateStorage.js';
import { startGameMusic, stopGameMusic } from '../audio/gameMusic.js';

export function playBossCutscene(container, videoSrc) {
    return new Promise((resolve) => {
        // Pausa temporariamente a música do jogo para destacar a trilha da cutscene
        stopGameMusic();

        /* ── Overlay fullscreen ────────────────────────────── */
        const overlay = document.createElement('div');
        overlay.id = 'boss-cutscene-overlay';
        overlay.style.cssText = `
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            background: #000;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9000;
            overflow: hidden;
        `;

        /* ── Vídeo ─────────────────────────────────────────── */
        const video = document.createElement('video');
        video.src = videoSrc;
        video.style.cssText = `
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
            display: block;
            object-fit: contain;
        `;
        video.autoplay = true;
        video.preload = 'auto';
        video.playsInline = true;
        // Sem controles nativos — o jogador usa apenas o botão PULAR
        video.controls = false;
        video.muted = false;
        try {
            const settings = loadSettings();
            const master = Number.isFinite(settings.masterVolume) ? settings.masterVolume : 1;
            const sfx = Number.isFinite(settings.sfxVolume) ? settings.sfxVolume : 1;
            video.volume = Math.max(0, Math.min(1, master * sfx));
        } catch (_) {
            video.volume = 1;
        }

        /* ── Botão PULAR ───────────────────────────────────── */
        const skipBtn = document.createElement('button');
        skipBtn.id = 'cutscene-skip-btn';
        skipBtn.type = 'button';
        skipBtn.innerHTML = 'PULAR &nbsp;<span style="opacity:0.75;font-size:0.78em">[ENTER]</span>';
        skipBtn.style.cssText = `
            position: absolute;
            bottom: 28px;
            right: 32px;
            background: rgba(10, 8, 16, 0.82);
            color: #e8dfc8;
            border: 1.5px solid rgba(232, 223, 200, 0.35);
            border-radius: 6px;
            padding: 8px 20px;
            font-family: 'Courier New', 'Lucida Console', monospace;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.08em;
            cursor: pointer;
            z-index: 9010;
            transition: background 0.15s, border-color 0.15s, color 0.15s;
            user-select: none;
            outline: none;
        `;

        skipBtn.addEventListener('mouseenter', () => {
            skipBtn.style.background = 'rgba(40, 30, 60, 0.95)';
            skipBtn.style.borderColor = 'rgba(232, 223, 200, 0.8)';
            skipBtn.style.color = '#fff';
        });
        skipBtn.addEventListener('mouseleave', () => {
            skipBtn.style.background = 'rgba(10, 8, 16, 0.82)';
            skipBtn.style.borderColor = 'rgba(232, 223, 200, 0.35)';
            skipBtn.style.color = '#e8dfc8';
        });

        /* ── Função de encerramento ───────────────────────── */
        let finished = false;
        function finish() {
            if (finished) return;
            finished = true;
            // Remove listener de teclado
            window.removeEventListener('keydown', onKeyDown, true);
            // Pausa o vídeo e remove o overlay
            try { video.pause(); } catch (_) { /* ignora */ }
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            // Retoma a música do jogo
            try { startGameMusic(); } catch (_) { /* ignora */ }
            resolve();
        }

        /* ── Tecla ENTER para pular ───────────────────────── */
        function onKeyDown(e) {
            if (e.code === 'Enter' || e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                finish();
            }
        }
        window.addEventListener('keydown', onKeyDown, true);

        /* ── Eventos do vídeo ─────────────────────────────── */
        video.addEventListener('ended', finish, { once: true });

        // Falha no carregamento: resolve mesmo assim para não travar o jogo
        video.addEventListener('error', () => {
            console.warn('[BossCutscene] Falha ao carregar vídeo:', videoSrc);
            finish();
        }, { once: true });

        skipBtn.addEventListener('click', finish);

        /* ── Monta no DOM ─────────────────────────────────── */
        overlay.appendChild(video);
        overlay.appendChild(skipBtn);
        container.appendChild(overlay);

        // Inicia a reprodução
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                // Autoplay bloqueado pelo browser: resolve sem travar
                console.warn('[BossCutscene] Autoplay bloqueado; pulando cutscene.');
                finish();
            });
        }
    });
}
