/** Trilha em loop do menu (título, nome, seleção e créditos). */
import { loadSettings } from '../state/stateStorage.js';
import { createLoopingMusic } from './loopingMusic.js';

const menuMusic = createLoopingMusic('./src/assets/sounds/music menu/menu_music.mp3', {
    name: 'Música do menu',
    getVolume: () => loadSettings().musicVolume / 100,
});

export function startMenuMusic() { menuMusic.start(); }
export function stopMenuMusic() { menuMusic.stop(); }
export function setMenuMusicVolume() { menuMusic.setVolume(); }
