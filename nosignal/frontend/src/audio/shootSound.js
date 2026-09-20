/**
 * shootSound.js
 * Sons de tiro dos personagens (No Signal).
 *
 * Centraliza o carregamento e a reprodução do efeito de disparo de cada
 * tripulante/oponente (astronaut, space-lizard e ocstronaut). O som é tocado
 * no exato momento em que o projétil é criado (Player.shoot), mantendo o
 * disparo perfeitamente sincronizado com o tiro.
 *
 * Cada som tem um POOL de instâncias de Audio: em cadência de tiro contínua,
 * disparos consecutivos se sobrepõem sem cortar/atrasar o final do disparo
 * anterior — em vez de recriar dezenas de new Audio() por rajada.
 *
 * O volume segue a configuração de efeitos sonoros (sfxVolume em
 * stateStorage), lida a cada toque, atenuado pela constante SHOOT_VOLUME.
 */

import { loadSettings } from '../state/stateStorage.js';

const SHOOTING_DIR = './src/assets/sounds/sound effects/shooting/';

// Som de cada personagem (id em characters.js -> arquivo de áudio).
const SHOOT_SOUNDS = {
    astronaut: `${SHOOTING_DIR}astronaut_shoot.mp3`,
    'space-lizard': `${SHOOTING_DIR}space_lizard_shoot.wav`,
    ocstronaut: `${SHOOTING_DIR}ocstronaut_shoot.mp3`
};

// Volume base dos disparos (nunca volume máximo: camadas de tiro se somam
// durante o combate, o som precisa ser discreto).
const SHOOT_VOLUME = 0.7;

// Instâncias por som. Cadência mais rápida (astronaut 0.22s) em um efeito de
// ~0.6s precisa de sobreposição; o pool roda em round-robin para cada disparo.
const POOL_SIZE = 4;

const pools = {}; // characterId -> [Audio, ...]
const nextIndexByCharacter = {}; // characterId -> próximo índice round-robin

let shootSoundsWarned = false;

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

// Volume final = (sfxVolume/100) * SHOOT_VOLUME, lido a cada toque para
// respeitar mudanças em tempo real feitas nas opções.
function _resolveVolume() {
    const settings = loadSettings();
    const sfx = Number.isFinite(settings.sfxVolume)
        ? clamp(settings.sfxVolume, 0, 100)
        : 100;
    return (sfx / 100) * SHOOT_VOLUME;
}

/**
 * Pré-carrega o pool de áudio de todos os personagens durante a tela de
 * loading. Assim o primeiro play() no gameplay já encontra o buffer pronto e
 * o tiro soa no frame exato em que o projétil nasce (zero latência inicial).
 */
export function preloadShootSounds() {
    if (typeof Audio === 'undefined') return;

    Object.keys(SHOOT_SOUNDS).forEach((characterId) => {
        if (pools[characterId] && pools[characterId].length) return;

        const path = SHOOT_SOUNDS[characterId];
        const pool = [];
        for (let i = 0; i < POOL_SIZE; i++) {
            const audio = new Audio(path);
            audio.preload = 'auto';
            audio.volume = _resolveVolume();

            audio.addEventListener('error', () => {
                if (!shootSoundsWarned) {
                    shootSoundsWarned = true;
                    console.warn(`[Audio] Som de tiro não pôde ser carregado: ${path}`);
                }
            });

            pool.push(audio);
        }
        pools[characterId] = pool;
    });
}

/**
 * Toca o som de disparo do personagem informado (characterId de characters.js).
 * Sempre chamado de dentro de Player.shoot(), no ponto em que o projétil é
 * adicionado — o áudio e a bala saem juntos.
 */
export function playShootSound(characterId) {
    if (!SHOOT_SOUNDS[characterId]) return;

    if (!pools[characterId] || !pools[characterId].length) {
        preloadShootSounds();
    }

    const audioList = pools[characterId];
    if (!audioList || !audioList.length) return;

    // Round-robin: cada disparo usa a próxima instância do pool para
    // sobrepor cadências rápidas sem cortar o disparo anterior.
    const index = (nextIndexByCharacter[characterId] || 0) % audioList.length;
    nextIndexByCharacter[characterId] = index + 1;

    const audio = audioList[index];

    try {
        audio.volume = _resolveVolume();

        // Variação sutil de pitch (~±5%) para não soar "em loop robótico"
        // em rajadas longas. Pequena o bastante para não desalinhar a
        // percepção com o disparo.
        audio.playbackRate = 0.95 + Math.random() * 0.1;

        // Reinicia a instância no disparo mais recente para o som sair
        // imediatamente, sem esperar o clique.
        audio.currentTime = 0;

        const result = audio.play();
        if (result && typeof result.catch === 'function') {
            result.catch(() => {
                // O navegador pode recusar áudio antes da primeira interação.
            });
        }
    } catch {
        // O som nunca deve quebrar o combate.
    }
}