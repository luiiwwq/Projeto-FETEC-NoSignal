import test from 'node:test';
import assert from 'node:assert/strict';

import { MAP_IDS, MAPS } from '../src/content/maps.js';
import { RadarRenderer, getRadarView, getRadarMarkers, radarWorldToScreen } from '../src/engine/RadarRenderer.js';

test('minimapa local revela pontos próximos e acompanha o jogador sem expor o resto da superfície', () => {
    const map = MAPS[MAP_IDS.MARS_SURFACE];
    const radar = new RadarRenderer();
    const markers = getRadarMarkers({
        currentMap: map,
        currentMapId: map.id,
        actors: [{ role: 'ally', x: 2111, y: 410 }],
        worldItems: [{ id: 'meio', x: 2138, y: 2527 }],
    });
    const byLabel = (name) => markers.find((marker) => marker.label === name);
    assert.ok(byLabel('NAVE'));
    assert.ok(byLabel('CAVERNA'));
    assert.ok(byLabel('LOJA'));
    assert.ok(byLabel('PEÇA'));
    assert.ok(byLabel('CASTELO'));

    const plot = { x: 10, y: 10, width: 154, height: 98 };
    const startView = getRadarView(map, plot, { x: 470, y: 700 });
    radar.reveal(map, 470, 700);
    assert.ok(radar.isExplored(map, byLabel('NAVE').x, byLabel('NAVE').y));
    assert.equal(radar.isExplored(map, byLabel('CAVERNA').x, byLabel('CAVERNA').y), false);
    assert.ok(radarWorldToScreen(startView, byLabel('CAVERNA').x, byLabel('CAVERNA').y).x > plot.x + plot.width);

    const cave = byLabel('CAVERNA');
    const caveView = getRadarView(map, plot, { x: cave.x, y: cave.y });
    radar.reveal(map, cave.x, cave.y);
    assert.ok(caveView.worldX > startView.worldX && caveView.worldY > startView.worldY);
    assert.ok(radar.isExplored(map, cave.x, cave.y));
    assert.ok(radar.isExplored(map, byLabel('NAVE').x, byLabel('NAVE').y), 'a exploração anterior persiste ao andar');
    assert.equal(radar.isExplored(map, byLabel('CASTELO').x, byLabel('CASTELO').y), false);
});

test('minimapa preserva descoberta por área; chefe e saída só surgem quando descobertos', () => {
    const map = MAPS[MAP_IDS.MARS_CORE];
    const radar = new RadarRenderer();
    radar.reveal(MAPS[MAP_IDS.MARS_SURFACE], 470, 700);
    const boss = { x: 792, y: 512, isDead: false };
    const engine = {
        currentMap: map,
        currentMapId: map.id,
        skeletonAxeBoss: boss,
        shouldLockBossRoomExit: () => !boss.isDead,
    };

    const locked = getRadarMarkers(engine);
    assert.ok(locked.some((marker) => marker.type === 'boss' && marker.x === boss.x));
    assert.ok(locked.some((marker) => marker.type === 'locked' && marker.label === 'TRANCADA'));
    radar.reveal(map, 368, 496);
    assert.ok(radar.isExplored(map, 240, 496), 'a saída próxima é revelada na entrada');
    assert.equal(radar.isExplored(map, boss.x, boss.y), false, 'o chefe distante ainda não aparece');
    radar.reveal(map, boss.x, boss.y);
    assert.ok(radar.isExplored(map, boss.x, boss.y));

    boss.isDead = true;
    engine.worldItems = [{ id: 'motor', x: boss.x, y: boss.y }];
    const cleared = getRadarMarkers(engine);
    assert.equal(cleared.some((marker) => marker.type === 'boss'), false);
    assert.ok(cleared.some((marker) => marker.type === 'exit'));
    assert.ok(cleared.some((marker) => marker.type === 'item' && marker.label === 'MOTOR'));
    assert.equal(cleared.some((marker) => marker.label === 'NAVE'), false);
    assert.ok(radar.isExplored(MAPS[MAP_IDS.MARS_SURFACE], 470, 700));
    assert.equal(new RadarRenderer().isExplored(map, 368, 496), false, 'nova partida não mantém mapa revelado');
});
