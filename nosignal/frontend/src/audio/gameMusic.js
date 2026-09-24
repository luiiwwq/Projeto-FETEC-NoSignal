/** Trilha ambiente em loop, retomada ao sair da pausa e ao voltar dos chefes. */
import { loadSettings } from '../state/stateStorage.js';
import { createLoopingMusic } from './loopingMusic.js';

const gameMusic = createLoopingMusic('./src/assets/sounds/music game ambient/music_game.mp3', {
    name: 'Música do gameplay',
    getVolume: () => loadSettings().musicVolume / 100,
});

export function preloadGameMusic() { return gameMusic.preload(); }
export function startGameMusic() { gameMusic.start(); }
export function pauseGameMusic() { gameMusic.pause(); }
export function resumeGameMusic() { gameMusic.resume(); }
export function stopGameMusic() { gameMusic.stop(); }
export function setGameMusicVolume() { gameMusic.setVolume(); }
