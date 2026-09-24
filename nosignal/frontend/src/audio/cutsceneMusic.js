/** Trilha em loop reutilizada nas cutscenes de abertura e dos finais. */
import { loadSettings } from '../state/stateStorage.js';
import { createLoopingMusic } from './loopingMusic.js';

const cutsceneMusic = createLoopingMusic(
    './src/assets/cutscenes/start_game/soundtrack_start/soundtrack_start_scenes.mp3', {
        name: 'Trilha da cutscene',
        getVolume: () => loadSettings().musicVolume / 100,
    }
);

export function preloadCutsceneMusic() { return cutsceneMusic.preload(); }
export function startCutsceneMusic() { cutsceneMusic.start(); }
export function stopCutsceneMusic() { cutsceneMusic.stop(); }
export function setCutsceneMusicVolume() { cutsceneMusic.setVolume(); }
