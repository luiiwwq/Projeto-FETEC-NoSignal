/** Decisões da missão principal na nave ARES-1. */
export function getMissionShipAction(missionComplete, spaceshipRepaired, finalDay = false) {
    if (!missionComplete) return finalDay ? 'game-over' : 'conclude';
    return spaceshipRepaired ? 'depart' : 'repair';
}

export function getMissionEnding(spaceshipRepaired, enemyNpcDefeated) {
    if (!spaceshipRepaired) return 'final2';
    return enemyNpcDefeated ? 'final3' : 'final4';
}
