/** Tempo mínimo de jogo decorrido (em segundos) para permitir concluir a
 * missão sem a nave pronta (Final 02). Bloqueia o botão no início da partida. */
export const MIN_CONCLUDE_PLAY_SECONDS = 120;

/** Decisões da missão principal na nave ARES-1. */
export function getMissionShipAction(missionComplete, spaceshipRepaired, finalDay = false) {
    if (!missionComplete) return finalDay ? 'game-over' : 'conclude';
    return spaceshipRepaired ? 'depart' : 'repair';
}

export function getMissionEnding(spaceshipRepaired, enemyNpcDefeated) {
    if (!spaceshipRepaired) return 'final2';
    return enemyNpcDefeated ? 'final3' : 'final4';
}
