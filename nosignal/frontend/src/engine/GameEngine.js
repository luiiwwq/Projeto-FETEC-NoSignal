/**
 * GameEngine.js
 * Core engine loop managing Canvas rendering, Camera, Player,
 * Projectiles, Input handling, and Sci-Fi Mars HUD.
 */

import { Camera } from './Camera.js';
import { MapRenderer } from './MapRenderer.js';
import { Player, PlayerState } from '../entities/Player.js?v=dash-3';
import { CharacterActor, ActorRole } from '../entities/CharacterActor.js';
import { Golem, GOLEM_WAVE_SPAWNS, GOLEM_COLLIDER_HALF_W, GOLEM_COLLIDER_HALF_H, preloadGolemSprites } from '../entities/Golem.js';
import { AmongUsEasterEgg, preloadAmongUsSprites, AMONG_US_ELIGIBLE_MAPS, AMONG_US_INTERVAL_SECONDS, AMONG_US_TEST_HALF_W, AMONG_US_TEST_HALF_H, AMONG_US_MAX_ATTEMPTS, DEBUG_AMONG_US_EASTER_EGG } from '../entities/AmongUsEasterEgg.js';
import {
    SKELETON_COLLIDER_HALF_W,
    SKELETON_COLLIDER_HALF_H,
    preloadSkeletonAxeSprites,
} from '../entities/SkeletonAxe.js';
import {
    SkeletonWarrior,
    CATACOMBS_SKELETON_WARRIOR_SPAWNS,
    WARRIOR_COLLIDER_HALF_W,
    WARRIOR_COLLIDER_HALF_H,
    preloadSkeletonWarriorSprites,
} from '../entities/SkeletonWarrior.js';
import {
    SkeletonArcher,
    CATACOMBS_SKELETON_ARCHER_SPAWNS,
    ARCHER_COLLIDER_HALF_W,
    ARCHER_COLLIDER_HALF_H,
    preloadSkeletonArcherSprites,
} from '../entities/SkeletonArcher.js';
import {
    SkeletonAxeBoss,
    NUCLEUS_SKELETON_AXE_BOSS_SPAWN,
    SKELETON_AXE_BOSS_COLLIDER_HALF_W,
    SKELETON_AXE_BOSS_COLLIDER_HALF_H,
} from '../entities/SkeletonAxeBoss.js';
import {
    SkeletonSpearman,
    CATACOMBS_SKELETON_SPEARMAN_SPAWNS,
    SPEARMAN_COLLIDER_HALF_W,
    SPEARMAN_COLLIDER_HALF_H,
    preloadSkeletonSpearmanSprites,
} from '../entities/SkeletonSpearman.js';
import {
    NecromancerBoss,
    NECROMANCER_SPAWN,
    NECROMANCER_COLLIDER_HALF_W,
    NECROMANCER_COLLIDER_HALF_H,
    NECROMANCER_REAPER_OFFSETS,
    getSkillImages,
    getNecroSkillHitRect,
    UNHOLY_GROWN_FRAME_INDEX,
    UNHOLY_FRAME_HZ,
    preloadNecromancerSprites,
} from '../entities/NecromancerBoss.js';
import {
    Reaper,
    REAPER_COLLIDER_HALF_W,
    REAPER_COLLIDER_HALF_H,
    preloadReaperSprites,
} from '../entities/Reaper.js';
import { DroppedItem } from '../entities/DroppedItem.js';
import {
    SPACESHIP_ITEM_DEFS,
    MISSION_ITEM_ORDER,
    preloadMissionItemSprites,
    getMissionItemImage,
} from '../content/missionItems.js';
import { gameState } from '../state/gameState.js';
import { MAPS, MAP_IDS } from '../content/maps.js';
import { CHARACTERS, DEFAULT_CHARACTER_ID } from '../content/characters.js';
import { CHARACTER_ALLY_SHOP_POSITION, CHARACTER_ENEMY_SPAWNS, resolveCharacterRoles } from '../content/characterRoles.js';
import { resolveSlide, pointInCircle, rectsOverlap } from '../systems/collisionSystem.js';
import { DayNightSystem, DAY_NIGHT_PERIOD, OXYGEN_LIFETIME_SECONDS, SPAWN_WAVE_EVERY_SECOND_NIGHT, formatDayNightTime } from '../systems/dayNightSystem.js';
import { openPauseMenu, closePauseMenu, isPauseMenuOpen, destroyPauseMenu } from '../ui/pauseMenu.js';
import { openCaveChoiceScreen, closeCaveChoiceScreen, isCaveChoiceOpen } from '../ui/caveChoiceScreen.js';
import { openShopScreen, closeShopScreen, isShopOpen, consumeInventorySlot, getSlotItem, getItemIconPath, getItemFramePaths } from '../ui/shopScreen.js';
import { Bullet } from '../entities/Bullet.js';
import { playClickButtonSound } from '../audio/uiClickSound.js';
import { loadSettings, brightnessFilter } from '../state/stateStorage.js';
import { playBossCutscene } from '../ui/BossCutscenePlayer.js';
import { playFinalGameCutscene } from '../ui/FinalGameCutscenePlayer.js';
import { playNpcDialogue } from '../ui/npcDialogue.js';
import { submitRankingResult } from '../services/ranking.js';

const DAY_NIGHT_ICON_PATH = {
    [DAY_NIGHT_PERIOD.DAY]: './src/assets/sprites/Night_Day_System/sun_sprite.png',
    [DAY_NIGHT_PERIOD.NIGHT]: './src/assets/sprites/Night_Day_System/moon_sprite.png'
};

const MAP_LABELS = {
    [MAP_IDS.MARS_SURFACE]: 'SUPERFICIE DE DUNA',
    [MAP_IDS.MARS_CAVE]: 'CAVERNA DE DUNA',
    [MAP_IDS.MARS_CORE]: 'NUCLEO DE DUNA',
    [MAP_IDS.MARS_CATACOMBS]: 'CATACUMBAS DE DUNA',
    [MAP_IDS.CASTLE_PRINCIPAL_ROOM]: 'SALA PRINCIPAL',
    [MAP_IDS.CASTLE_KING_ROOM]: 'SALA DO REI',
};

// Collision debug overlay for the sprite-castle rooms. When ON it paints the
// room's real collision data on top of the art: red = solid obstacles, blue =
// door interaction areas, bright green = spawn points, yellow = player body.
// Flip to `true` only while reviewing the castle maps; commit as `false`.
const SHOW_CASTLE_COLLISION_DEBUG = false;

// Temporary debug overlay for the Catacombs skeletons (Skeleton_Axe +
// Skeleton_Spearman). When ON it paints each spawn point (with id, local
// coordinates and current map) plus every skeleton's collider box over the
// map art. Flip to `true` only while reviewing the spawns; commit as `false`.
const DEBUG_CATACOMBS_SKELETONS = false;

// Debug do boss Necromancer (Sala do Rei): mostra o spawn local, collider,
// HP, estado, cooldowns, áreas de habilidades e pontos candidatos/finais dos
// Reapers. Commit como `false`.
const DEBUG_NECROMANCER_BOSS = false;

// Excavate each freeMoveZone out of an obstacle, splitting it into the
// remaining pieces, so the band becomes a real collision-free corridor
// instead of a collision bypass (no penetration -> no resolveSlide teleport).
function subtractZoneFromObstacles(list, zx, zy, zw, zh) {
    const out = [];
    for (const o of list) {
        const ix = Math.max(o.x, zx);
        const iw = Math.min(o.x + o.w, zx + zw) - ix;
        const iy = Math.max(o.y, zy);
        const ih = Math.min(o.y + o.h, zy + zh) - iy;
        if (iw <= 0 || ih <= 0) {
            out.push(o);
            continue;
        }
        if (o.y < iy) out.push({ x: o.x, y: o.y, w: o.w, h: iy - o.y });
        if (o.y + o.h > iy + ih) out.push({ x: o.x, y: iy + ih, w: o.w, h: o.y + o.h - (iy + ih) });
        if (o.x < ix) out.push({ x: o.x, y: iy, w: ix - o.x, h: ih });
        if (o.x + o.w > ix + iw) out.push({ x: ix + iw, y: iy, w: o.x + o.w - (ix + iw), h: ih });
    }
    return out;
}

// Duração (s) da animação "risco verde + ✓" do log de missões antes da
// próxima quest da nave ser liberada.
export const QUEST_FLASH_DURATION = 1.3;

// Obstáculos podem declarar uma colisão mais natural que o rect de desenho
// (ex.: naves cuja silhueta não é um quadrado). O campo `collisionBoxes` é uma
// lista de rects RELATIVOS ao topo-esquerdo do prop: { dx, dy, w, h }. Várias
// caixas pequenas contornando a silhueta substituem o box cheio por algo
// "recortado" e natural. Sem o campo, o rect do obstáculo vale como colisão.
function obstacleCollisionRects(o) {
    if (o && Array.isArray(o.collisionBoxes) && o.collisionBoxes.length) {
        return o.collisionBoxes.map((b) => ({
            x: o.x + (b.dx || 0),
            y: o.y + (b.dy || 0),
            w: b.w,
            h: b.h,
        }));
    }
    return [o];
}

function buildCollisionObstacles(map, halfW, halfH) {
    let list = [];
    for (const o of map.obstacles || []) {
        const rects = obstacleCollisionRects(o);
        if (rects.length === 1 && rects[0] === o) list.push(o);
        else list.push(...rects);
    }
    for (const z of map.freeMoveZones || []) {
        list = subtractZoneFromObstacles(list, z.x, z.y - halfH, z.w, z.h + halfH * 2);
    }
    return list;
}

export class GameEngine {
    constructor(container) {
        this.container = container;
        this.canvas = null;
        this.ctx = null;
        this.width = 1280;
        this.height = 720;

        this.isRunning = false;
        this.lastTime = 0;
        this.animationFrameId = null;
        this.paused = false;

        // Subsystems
        this.camera = new Camera(this.width, this.height);
        this.mapRenderer = new MapRenderer();
        this.player = null;
        this.bullets = [];
        this.particles = [];

        // Non-player characters (ally/enemy) derived from the selected character
        this.actors = [];
        this.characterRoles = { ally: null, enemy: null };

        // Among Us easter egg (estado do loop entre aparições)
        this.amongUsTimer = 0;
        this.amongUsEasterEgg = null;

        // Golem wave + day/night cycle
        this.golems = [];
        this.skeletons = [];

        // Boss Necromancer (Sala do Rei) + Reapers invocados + efeitos ativos
        this.necromancerBoss = null;
        this.reapers = [];
        this.necromancerEffects = [];
        this._reaperPlacementLog = [];

        // Boss Skeleton_Axe (Núcleo de Marte) — o Skeleton_Axe que saiu das
        // Catacumbas virou guardião do Núcleo; some ao trocar de mapa.
        this.skeletonAxeBoss = null;
        this.dayNight = new DayNightSystem();
        this._golemWavePendingNight = 0; // night that must still be paid out
        this._lastGolemWaveNight = 0;    // guard against a double spawn
        this._golemWaveCount = 0;
        this._waveGolemsActive = false;
        this._nightBannerTimer = 0;
        this._nightBannerText = '';
        this._nightFlashTimer = 0;
        this._nightBlend = 0; // 0 = full day, 1 = full night tint
        this._dayNightIcons = { cached: new Map(), requested: false };
        this._upgradeIcons = new Map();
        this._upgradeIconsRequested = false;
        // Sprites dos itens consumíveis (ícone + quadros da animação de quebrar)
        this._itemFxIcons = new Map();
        this._itemFxFrames = new Map();
        this._itemSpritesRequested = false;
        this._itemFx = []; // animações de item sendo quebrado ao seu lado
        this._loadItemSprites();
        this._catacombsSkeletonsActive = false;
        this._enemyNpcActor = null;
        this._loadUpgradeIcons();

        // Map state
        this.currentMapId = MAP_IDS.MARS_SURFACE;
        this.currentMap = MAPS[this.currentMapId];
        this.mapTransitionCooldown = 0;
        this.interactableExit = null;
        this.promptText = '';
        // Porta de arena de boss bloqueada até o chefe ser derrotado
        // (Sala do Rei / Núcleo de Marte). Guarda a posição do aviso.
        this.lockedExitPrompt = null;

        // Shop NPC interaction & Floating coin texts
        this.interactableShop = null;
        this.shopPrompt = '';
        this.floatingTexts = [];

        // Itens da missão principal (peças da nave) no mundo
        this.worldItems = [];
        this.interactableMissionItem = null;
        this.interactableMissionShip = false;
        this._shipRepairFade = null;

        // Animação de "quest concluída" do log de missões (risco verde + ✓).
        this._questFlashId = null;
        this._questFlashT = 0;

        // Feedback de uso de item no HUD (mensagem transitória)
        this.hudMessage = '';
        this.hudMessageTimer = 0;

        // Assistência tática do Aliado no Necromancer
        this.allyBossHelpTriggered = false;
        this.bossAssistAlly = null;
        this.bossAssistTimer = 0;
        this.bossAssistShotCooldown = 0;
        this.bossAssistDamageBudget = 0;
        this.bossAssistSpawnPoint = null; // guarda a posição da 1ª aparição
        this._allyHelpArenaTime = 0; // tempo vivo dentro da arena (mínimo 1s)

        // Morte estilo Dark Souls: mensagem central + respawn adiado (não
        // teletransporta de volta na hora) sem resetar chefe/esqueletos.
        this._deathHandled = false;
        this._deathRespawnTimer = 0;
        this._soulsMessage = null; // { text, color, timer } exibido em tela cheia
        this._allyHelpRetry = false; // aliado reaparece após morte do jogador
        this._allyHelpRetryTimer = 0; // espera 0.5s após o respawn para reaparecer
        this._cutsceneActive = false; // flag enquanto uma cutscene de introdução está em reprodução
        this._endingTriggered = false;

        // Input state
        this.input = {
            keys: {},
            mouseX: this.width / 2,
            mouseY: this.height / 2,
            mouseLeft: false,
            mouseMiddle: false,
            mouseRight: false
        };

        // Bound listeners for cleanup
        this._onKeyDown = this._handleKeyDown.bind(this);
        this._onKeyUp = this._handleKeyUp.bind(this);
        this._onMouseMove = this._handleMouseMove.bind(this);
        this._onMouseDown = this._handleMouseDown.bind(this);
        this._onMouseUp = this._handleMouseUp.bind(this);
        this._onContextMenu = (e) => e.preventDefault();
        this._onFullscreenChange = () => {
            if (!this.isRunning) return;
            if (document.fullscreenElement || document.webkitFullscreenElement) return;
            if (window.__noSignalKeepFullscreen) {
                const target = document.documentElement;
                if (target.requestFullscreen) {
                    try { target.requestFullscreen(); } catch (err) { /* ignora */ }
                } else if (target.webkitRequestFullscreen) {
                    try { target.webkitRequestFullscreen(); } catch (err) { /* ignora */ }
                }
            }
        };
        this._onResize = this._handleResize.bind(this);
    }

    init() {
        this.container.innerHTML = '';

        // Viewport Wrapper
        const viewport = document.createElement('div');
        viewport.className = 'game-viewport';
        viewport.style.position = 'relative';
        viewport.style.width = '100%';
        viewport.style.height = '100%';
        viewport.style.display = 'flex';
        viewport.style.justifyContent = 'center';
        viewport.style.alignItems = 'center';
        viewport.style.backgroundColor = '#05050b';
        viewport.style.overflow = 'hidden';

        // Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'game-canvas';
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.canvas.style.display = 'block';
        this.canvas.style.imageRendering = 'pixelated';
        this.canvas.style.cursor = 'crosshair';

        viewport.appendChild(this.canvas);
        this.container.appendChild(viewport);

        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        // Aplica configurações persistidas (ex.: brilho ajustado na tela inicial)
        this._applyStoredSettings();

        // Warm the golem + day/night sprite caches once for the whole session.
        preloadGolemSprites();
        preloadAmongUsSprites();
        preloadSkeletonAxeSprites();
        preloadSkeletonWarriorSprites();
        preloadSkeletonArcherSprites();
        preloadSkeletonSpearmanSprites();
        preloadNecromancerSprites();
        preloadReaperSprites();
        preloadMissionItemSprites();
        this._loadDayNightIcons();
        this._loadUpgradeIcons();

        // Initialize Player with state name
        const astronautName = gameState.playerName || 'ARES-1';
        this.player = new Player(0, 0, astronautName);
        this.player.applyUpgrades(gameState.upgrades || []);
        gameState.activeEngine = this;
        gameState.currentScene = 'GAMEPLAY';

        // Load the starting map (Martian surface)
        this._loadMap(MAP_IDS.MARS_SURFACE, 'mars-start', true);

        // Bind events
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('resize', this._onResize);
        this.canvas.addEventListener('mousemove', this._onMouseMove);
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mouseup', this._onMouseUp);
        this.canvas.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
        this.canvas.addEventListener('contextmenu', this._onContextMenu);
        document.addEventListener('fullscreenchange', this._onFullscreenChange);
        document.addEventListener('webkitfullscreenchange', this._onFullscreenChange);

        this._handleResize();
        this.start();
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTime = performance.now();
        this.animationFrameId = requestAnimationFrame(this._gameLoop.bind(this));
    }

    stop() {
        this.isRunning = false;
        this.paused = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        destroyPauseMenu();
        closeCaveChoiceScreen();
        closeShopScreen();
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('mouseup', this._onMouseUp);
        document.removeEventListener('fullscreenchange', this._onFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', this._onFullscreenChange);
    }

    _loadMap(mapId, spawnId) {
        const map = MAPS[mapId];
        if (!map) return;

        this.currentMapId = mapId;
        this.currentMap = map;
        this.mapRenderer.setMap(map);

        const spawn = map.spawnPoints[spawnId] && map.spawnPoints[spawnId].x !== undefined
            ? map.spawnPoints[spawnId]
            : map.spawn;

        this.player.setPosition(spawn.x, spawn.y);
        this.player.setCollisionResolver(
            this._buildCollisionResolver(map, this.player.colliderHalfW, this.player.colliderHalfH)
        );
        this.player.setWorldBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height });

        this.camera.setBounds(0, 0, map.width, map.height);
        this.camera.follow(this.player.x, this.player.y, true);

        this.bullets.length = 0;
        this.particles.length = 0;
        this.floatingTexts = [];
        this.mapTransitionCooldown = 0.4;
        this.interactableExit = null;
        this.lockedExitPrompt = null;
        this.interactableShop = null;
        this.interactableMissionItem = null;
        this.bossAssistAlly = null;
        this.allyBossHelpTriggered = false;
        this.bossAssistSpawnPoint = null;
        this._allyHelpArenaTime = 0;

        // (Re)create non-player characters for this map
        this._setupCharacterRoles(map);
        this.golems = [];
        this._waveGolemsActive = false;

        // Troca de mapa / nova partida: easter egg some e cronômetro reinicia.
        this.amongUsEasterEgg = null;
        this.amongUsTimer = 0;
        this.skeletons = [];

        // Boss Necromancer: some junto com Reapers/efeitos ao trocar de mapa —
        // nunca vaza para outro mapa e nunca duplica ao voltar.
        this.necromancerBoss = null;
        this.reapers = [];
        this.necromancerEffects = [];
        this._reaperPlacementLog = [];

        // Boss Skeleton_Axe (Núcleo): same — wipe on map change.
        this.skeletonAxeBoss = null;

        // The Catacombs have five fixed Skeleton_Warrior posts, three
        // Skeleton_Archer posts at the wall tips (plus five Skeleton_Spearman
        // standing beside them) in LOCAL map coordinates. They are recreated on
        // every load of the map and wiped together with `actors` the moment the
        // player leaves (see above), so they never leak to the surface/castle
        // and never duplicate. Depois de limpas, ficam limpas até iniciar um
        // jogo novo (gameState.catacombsCleared).
        if (mapId === MAP_IDS.MARS_CATACOMBS && !gameState.catacombsCleared) {
            this._spawnCatacombsWarriors(map);
            this._spawnCatacombsArchers(map);
            this._spawnCatacombsSpearmen(map);
            this._catacombsSkeletonsActive = true;
        } else {
            this._catacombsSkeletonsActive = false;
        }

        // Boss da Sala do Rei: spawn LOCAL (720,443), sem conversão de
        // coordenadas com a superfície/entrada do castelo. Depois de derrotado,
        // não reaparece até iniciar um jogo novo (gameState.necromancerDefeated).
        if (mapId === MAP_IDS.CASTLE_KING_ROOM && !gameState.necromancerDefeated) {
            this._spawnNecromancerBoss(map);
        }

        // Boss Skeleton_Axe do Núcleo de Marte: spawn LOCAL (792,512) caminhável.
        // Depois de derrotado, não reaparece até iniciar um jogo novo.
        if (mapId === MAP_IDS.MARS_CORE && !gameState.skeletonAxeBossDefeated) {
            this._spawnSkeletonAxeBoss(map);
        }

        // Itens da missão principal presentes neste mapa (chefes já derrotados
        // podem ter soltado peças; o meio da nave já nasce na superfície).
        this._respawnMissionWorldItems();

        if (this.player) {
            this.player.applyUpgrades(gameState.upgrades || []);
        }

        // A wave scheduled while the player was away is paid out as soon as
        // they set foot back on the allowed map (never lost, never doubled).
        if (mapId === MAP_IDS.MARS_SURFACE && this._golemWavePendingNight > 0) {
            this._spawnGolemWave(mapId, this._golemWavePendingNight);
        }

        gameState.currentMap = mapId;
    }

    /* ── Day / night cycle ──────────────────────────────── */
    _updateDayNight(dt) {
        const event = this.dayNight.update(dt);

        if (event && event.type === 'night-start') {
            this._nightBannerText = `NOITE ${event.nightCount}`;
            this._nightBannerTimer = 3.0;
            this._nightFlashTimer = 0.45;
            this._startNight();
        }

        if (event && event.type === 'day-start') {
            // A horda de golens só existe durante a própria noite: se o jogador
            // não a eliminou antes do amanhecer, ela some sem recompensa.
            this._despawnGolemWave();
            // Idem para a onda adiada: se a noite que ela pertencia acabou sem
            // ter sido eliminada, ela nunca mais spawna.
            if (this._golemWavePendingNight > 0 && this._golemWavePendingNight === this.dayNight.nightCount) {
                this._golemWavePendingNight = 0;
            }
        }

        if (this._nightBannerTimer > 0) this._nightBannerTimer -= dt;
        if (this._nightFlashTimer > 0) this._nightFlashTimer -= dt;

        const target = this.dayNight.period === DAY_NIGHT_PERIOD.NIGHT ? 1 : 0;
        const step = Math.min(1, dt / 1.2);
        this._nightBlend += (target - this._nightBlend) * step;

        gameState.dayNight = this.dayNight.getHudState();
        gameState.dayNight.waveCount = this._golemWaveCount;

        if (this.dayNight.elapsedTime >= OXYGEN_LIFETIME_SECONDS && !gameState.spaceshipRepaired) {
            this._triggerEnding('final1');
        }
    }

    _triggerEnding(finalId) {
        if (this._endingTriggered) return;
        this._endingTriggered = true;
        this._cutsceneActive = true;
        gameState.activeEnding = finalId;
        gameState.currentScene = 'ENDING';
        this.stop();

        playFinalGameCutscene(this.container, finalId, async () => {
            // Registrar apenas depois que a cutscene do final termina (ou é pulada).
            // Falha de rede não deve impedir o retorno ao menu.
            try {
                await submitRankingResult({
                    nome: gameState.playerName,
                    tempoSegundos: this.dayNight.elapsedTime,
                    mortes: gameState.deaths || 0,
                    moedas: gameState.coins,
                    finalId
                });
            } catch (error) {
                console.error('[Ranking] Não foi possível salvar o resultado:', error);
            }

            this.container.innerHTML = '';
            gameState.activeEngine = null;
            gameState.activeEnding = null;
            gameState.currentScene = 'TITLE';

            const [{ renderTitleScreen }, { initMainMenu }, { startMenuMusic }] = await Promise.all([
                import('../ui/titleScreen.js'),
                import('../ui/screens.js'),
                import('../audio/menuMusic.js')
            ]);
            renderTitleScreen(this.container);
            initMainMenu();
            startMenuMusic();
        });
    }

    _startNight() {
        if (SPAWN_WAVE_EVERY_SECOND_NIGHT && this.dayNight.nightCount % 2 === 0) {
            this._queueGolemWave(this.dayNight.nightCount);
        }
    }

    // Schedule the wave; spawn now if allowed, otherwise remember the night so
    // it is created when the player returns to the surface.
    _queueGolemWave(night) {
        if (night <= this._lastGolemWaveNight) return;
        if (this.currentMapId === MAP_IDS.MARS_SURFACE) {
            this._spawnGolemWave(MAP_IDS.MARS_SURFACE, night);
        } else {
            this._golemWavePendingNight = night;
        }
    }

    _spawnGolemWave(mapId, night) {
        const map = MAPS[mapId];
        if (!map) return 0;

        // Waves on night 4, 8, 12 … are buffed: each 4th night adds one tier
        // (+15% speed / +70% HP / +15% damage per tier, handled by Golem).
        const buffTier = night % 4 === 0 ? night / 4 : 0;

        const positions = [
            ...GOLEM_WAVE_SPAWNS.bottom,
            ...GOLEM_WAVE_SPAWNS.top,
            ...GOLEM_WAVE_SPAWNS.front
        ];

        let spawned = 0;
        for (const pos of positions) {
            const free = this._findFreeGolemSpawn(map, pos.x, pos.y);
            if (!free) continue;

            const golem = new Golem(free.x, free.y, buffTier);
            golem.setCollisionResolver(
                this._buildCollisionResolver(map, golem.colliderHalfW, golem.colliderHalfH)
            );
            golem.setWorldBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height });
            this.actors.push(golem);
            this.golems.push(golem);
            spawned += 1;
        }

        this._lastGolemWaveNight = night;
        this._golemWavePendingNight = 0;
        if (spawned > 0) {
            this._golemWaveCount += 1;
            this._waveGolemsActive = true;
        }
        return spawned;
    }

    // A horda de golens só existe durante a própria noite: se não for eliminada
    // até o amanhecer, ela desaparece sem recompensa.
    _despawnGolemWave() {
        const aliveGolems = this.golems.filter((g) => !g.isDead && !g.shouldRemove);
        if (aliveGolems.length === 0) return;
        for (const g of aliveGolems) {
            g.shouldRemove = true;
        }
        this.golems = [];
        this._waveGolemsActive = false;
        this._nightBannerText = 'A HORDA DESAPARECEU COM O AMANHECER';
        this._nightBannerTimer = 3.0;
    }

    // Returns a free {x,y} for a golem box, nudging outward from the requested
    // spot when it overlaps an obstacle, the player or another actor.
    _findFreeGolemSpawn(map, x, y) {
        const hw = GOLEM_COLLIDER_HALF_W;
        const hh = GOLEM_COLLIDER_HALF_H;

        const isBlocked = (cx, cy) => {
            const rect = { x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 };
            if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > map.width || rect.y + rect.h > map.height) {
                return true;
            }
            for (const o of map.obstacles) {
                if (obstacleCollisionRects(o).some((cr) => rectsOverlap(cr, rect))) return true;
            }
            const p = this.player;
            if (p && !p.isDead) {
                const pr = {
                    x: p.x - p.colliderHalfW,
                    y: p.y - p.colliderHalfH,
                    w: p.colliderHalfW * 2,
                    h: p.colliderHalfH * 2
                };
                if (rectsOverlap(pr, rect)) return true;
            }
            for (const actor of this.actors) {
                const ar = {
                    x: actor.x - actor.colliderHalfW,
                    y: actor.y - actor.colliderHalfH,
                    w: actor.colliderHalfW * 2,
                    h: actor.colliderHalfH * 2
                };
                if (rectsOverlap(ar, rect)) return true;
            }
            return false;
        };

        if (!isBlocked(x, y)) return { x, y };

        const step = 48;
        for (let radius = step; radius <= 480; radius += step) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
                const cx = x + Math.cos(a) * radius;
                const cy = y + Math.sin(a) * radius;
                if (!isBlocked(cx, cy)) return { x: Math.round(cx), y: Math.round(cy) };
            }
        }
        return null;
    }

    /**
     * Spawn the five fixed Skeleton_Axe of the Catacombs. `spawn.x/spawn.y`
     * are LOCAL map coordinates (feet position, bottom-center anchor) — never
     * world/surface coordinates. Every spawn is validated before the entity is
     * created: inside the map bounds, on a walkable mask cell, with a collider
     * free of obstacles/edges/exits/player/other actors. If a spot fails the
     * walkability checks, the closest free floor cell is used instead (small
     * local adjustment, never a silent move to another map).
     */
    _spawnCatacombsWarriors(map) {
        this._spawnCatacombsSkeletonGroup(map, {
            spawns: CATACOMBS_SKELETON_WARRIOR_SPAWNS,
            ctor: SkeletonWarrior,
            hw: WARRIOR_COLLIDER_HALF_W,
            hh: WARRIOR_COLLIDER_HALF_H,
            label: 'Skeleton_Warrior',
        });
    }

    /** Spawn the three Skeleton_Archer, one at each Catacombs wall tip. */
    _spawnCatacombsArchers(map) {
        this._spawnCatacombsSkeletonGroup(map, {
            spawns: CATACOMBS_SKELETON_ARCHER_SPAWNS,
            ctor: SkeletonArcher,
            hw: ARCHER_COLLIDER_HALF_W,
            hh: ARCHER_COLLIDER_HALF_H,
            label: 'Skeleton_Archer',
        });
    }

    /** Spawn the five Skeleton_Spearman, one beside each warrior skeleton. */
    _spawnCatacombsSpearmen(map) {
        this._spawnCatacombsSkeletonGroup(map, {
            spawns: CATACOMBS_SKELETON_SPEARMAN_SPAWNS,
            ctor: SkeletonSpearman,
            hw: SPEARMAN_COLLIDER_HALF_W,
            hh: SPEARMAN_COLLIDER_HALF_H,
            label: 'Skeleton_Spearman',
        });
    }

    /**
     * Respawn instantâneo: remove todos os esqueletos atuais (vivos, mortos ou
     * em remoção) e recria cada um exatamente no posto de origem com vida cheia.
     * Só faz sentido nas Catacumbas; fora delas não há esqueletos para resetar.
     */
    _resetCatacombsSkeletons() {
        const removed = this.skeletons;
        this.skeletons = [];
        this.actors = this.actors.filter((a) => !removed.includes(a));
        if (this.currentMapId === MAP_IDS.MARS_CATACOMBS) {
            this._spawnCatacombsWarriors(this.currentMap);
            this._spawnCatacombsArchers(this.currentMap);
            this._spawnCatacombsSpearmen(this.currentMap);
            this._catacombsSkeletonsActive = true;
        }
    }

    /** Shared spawn/validation/backfill used by both catacombs skeleton types. */
    _spawnCatacombsSkeletonGroup(map, { spawns, ctor, hw, hh, label }) {
        const mask = map.terrainMask;
        const cell = map.maskCell || 32;

        for (const spawn of spawns) {
            // 1) Range check — these are LOCAL catacombs coordinates.
            if (
                spawn.x < 0 ||
                spawn.y < 0 ||
                spawn.x > map.width ||
                spawn.y > map.height
            ) {
                throw new Error(`Spawn inválido: ${spawn.id} (fora dos limites das Catacumbas)`);
            }

            // 2) Feet must sit on a walkable mask cell ('.' = piso caminhável).
            const col = Math.floor(spawn.x / cell);
            const row = Math.floor(spawn.y / cell);
            const walkable =
                mask && mask[row] && mask[row][col] === '.';

            // 3) Collider must be free of obstacles, edges, exits, player and
            //    other actors.
            const feetY = spawn.y; // y dos pés
            const centerY = feetY - hh; // collider centre (feet = base)
            let px = spawn.x;
            let py = centerY;
            if (!walkable || !this._skeletonBoxIsFree(map, mask, cell, px, py, hw, hh)) {
                const adj = this._findNearestFreeSkeletonSpot(map, mask, cell, spawn.x, feetY, hw, hh);
                if (!adj) {
                    console.error(`[Catacombas] spawn ${label} inválido e sem piso livre: ${spawn.id} (${spawn.x},${spawn.y}) — ignorado.`);
                    continue;
                }
                console.warn(
                    `[Catacombas] spawn ${label} ${spawn.id} em ${spawn.x},${spawn.y} não era piso caminhável; ajuste local para ${adj.x},${adj.y}.`
                );
                px = adj.x;
                py = adj.y - hh;
            }

            const skeleton = new ctor(px, py, { id: spawn.id });
            skeleton.setCollisionResolver(
                this._buildCollisionResolver(map, skeleton.colliderHalfW, skeleton.colliderHalfH)
            );
            skeleton.setWorldBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height });
            this.actors.push(skeleton);
            this.skeletons.push(skeleton);
        }
    }

    // True when a skeleton collider centred at (cx, cy) does not touch an
    // obstacle, a map edge, an exit area, the player or any existing actor.
    _skeletonBoxIsFree(map, mask, cell, cx, cy, hw = SKELETON_COLLIDER_HALF_W, hh = SKELETON_COLLIDER_HALF_H) {
        const box = { x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 };

        if (box.x < 0 || box.y < 0 || box.x + box.w > map.width || box.y + box.h > map.height) {
            return false;
        }

        // Every cell covered by the collider must be walkable floor.
        if (mask) {
            const c0 = Math.floor(box.x / cell);
            const c1 = Math.floor((box.x + box.w - 1) / cell);
            const r0 = Math.floor(box.y / cell);
            const r1 = Math.floor((box.y + box.h - 1) / cell);
            for (let r = r0; r <= r1; r++) {
                for (let c = c0; c <= c1; c++) {
                    if (!mask[r] || mask[r][c] !== '.') return false;
                }
            }
        }

        for (const o of map.obstacles) {
            if (obstacleCollisionRects(o).some((cr) => rectsOverlap(cr, box))) return false;
        }

        for (const exit of map.exits || []) {
            const area = exit.area
                ? exit.area
                : { x: exit.x - (exit.radius || 0), y: exit.y - (exit.radius || 0), w: (exit.radius || 0) * 2, h: (exit.radius || 0) * 2 };
            if (rectsOverlap(area, box)) return false;
        }

        const p = this.player;
        if (p && !p.isDead) {
            const pr = { x: p.x - p.colliderHalfW, y: p.y - p.colliderHalfH, w: p.colliderHalfW * 2, h: p.colliderHalfH * 2 };
            if (rectsOverlap(pr, box)) return false;
        }

        for (const actor of this.actors) {
            if (actor.isDead) continue;
            const ar = { x: actor.x - actor.colliderHalfW, y: actor.y - actor.colliderHalfH, w: actor.colliderHalfW * 2, h: actor.colliderHalfH * 2 };
            if (rectsOverlap(ar, box)) return false;
        }

        return true;
    }

    // Ring search (up to 3 cells out) for the closest walkable floor cell
    // around a requested catacombs feet position. Returns the cell centre
    // (feet position) or null when nothing fits.
    _findNearestFreeSkeletonSpot(map, mask, cell, targetX, targetY, hw = SKELETON_COLLIDER_HALF_W, hh = SKELETON_COLLIDER_HALF_H) {
        if (!mask) return null;
        const rows = mask.length;
        const cols = mask[0] && mask[0].length;
        if (!cols) return null;
        const centerCol = Math.floor(targetX / cell);
        const centerRow = Math.floor(targetY / cell);

        let best = null;
        const maxRadius = 3;
        for (let radius = 0; radius <= maxRadius; radius++) {
            for (let dr = -radius; dr <= radius; dr++) {
                for (let dc = -radius; dc <= radius; dc++) {
                    if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
                    const r = centerRow + dr;
                    const c = centerCol + dc;
                    if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
                    if (mask[r][c] !== '.') continue;

                    const feetX = c * cell + cell / 2;
                    const feetY = r * cell + cell / 2;
                    if (!this._skeletonBoxIsFree(map, mask, cell, feetX, feetY - hh, hw, hh)) continue;

                    const dist = Math.hypot(feetX - targetX, feetY - targetY);
                    if (!best || dist < best.dist) best = { x: feetX, y: feetY, dist };
                }
            }
            if (best) break;
        }
        return best;
    }

    /* ── Necromancer boss helpers ──────────────────────── */
    // Cria o boss na Sala do Rei com spawn LOCAL (720,443). A validação de
    // limites é estrita por spec; conflito com obstáculo só vira log.
    _spawnNecromancerBoss(map) {
        if (
            NECROMANCER_SPAWN.x < 0 ||
            NECROMANCER_SPAWN.y < 0 ||
            NECROMANCER_SPAWN.x > map.width ||
            NECROMANCER_SPAWN.y > map.height
        ) {
            throw new Error('Spawn local do Necromancer inválido (fora da Sala do Rei)');
        }

        const boss = new NecromancerBoss(
            NECROMANCER_SPAWN.x,
            NECROMANCER_SPAWN.y - NECROMANCER_COLLIDER_HALF_H,
            { id: 'castle-king-boss' }
        );
        boss.setCollisionResolver(
            this._buildCollisionResolver(map, boss.colliderHalfW, boss.colliderHalfH)
        );
        boss.setWorldBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height });
        this.necromancerBoss = boss;

        if (DEBUG_NECROMANCER_BOSS) {
            const box = {
                x: boss.x - boss.colliderHalfW,
                y: boss.y - boss.colliderHalfH,
                w: boss.colliderHalfW * 2,
                h: boss.colliderHalfH * 2,
            };
            const clash = (map.obstacles || []).some((o) => obstacleCollisionRects(o).some((cr) => rectsOverlap(cr, box)));
            console.info(
                `[Necromancer] spawn local (${NECROMANCER_SPAWN.x},${NECROMANCER_SPAWN.y}) ` +
                `centro (${boss.x},${boss.y}); overlap obstáculo: ${clash}`
            );
        }
    }

    // Boss Skeleton_Axe do Núcleo (2.5x, 500 HP). Spawn LOCAL de pés (792,512)
    // no `mars-core`, validado por limites por spec; conflito com obstáculo só
    // vira log (o spawn é num piso caminhável).
    _spawnSkeletonAxeBoss(map) {
        if (
            NUCLEUS_SKELETON_AXE_BOSS_SPAWN.x < 0 ||
            NUCLEUS_SKELETON_AXE_BOSS_SPAWN.y < 0 ||
            NUCLEUS_SKELETON_AXE_BOSS_SPAWN.x > map.width ||
            NUCLEUS_SKELETON_AXE_BOSS_SPAWN.y > map.height
        ) {
            throw new Error('Spawn local do Skeleton_Axe_Boss inválido (fora do Núcleo)');
        }

        const spawn = NUCLEUS_SKELETON_AXE_BOSS_SPAWN;
        const boss = new SkeletonAxeBoss(
            spawn.x,
            spawn.y - SKELETON_AXE_BOSS_COLLIDER_HALF_H,
            { id: spawn.id }
        );
        boss._engine = this;
        boss.setCollisionResolver(
            this._buildCollisionResolver(map, boss.colliderHalfW, boss.colliderHalfH)
        );
        boss.setWorldBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height });
        this.skeletonAxeBoss = boss;

        if (DEBUG_NECROMANCER_BOSS) {
            const box = {
                x: boss.x - boss.colliderHalfW,
                y: boss.y - boss.colliderHalfH,
                w: boss.colliderHalfW * 2,
                h: boss.colliderHalfH * 2,
            };
            const clash = (map.obstacles || []).some((o) => obstacleCollisionRects(o).some((cr) => rectsOverlap(cr, box)));
            console.info(
                `[SkeletonAxeBoss] spawn local (${spawn.x},${spawn.y}) ` +
                `centro (${boss.x},${boss.y}); overlap obstáculo: ${clash}`
            );
        }
    }

    // Mantém o ponto alvo de uma habilidade dentro da área jogável da Sala do
    // Rei (longe das paredes e do trono/grades).
    clampNecromancerPoint(x, y) {
        const map = this.currentMap;
        const minX = 40;
        const maxX = map.width - 40;
        const minY = 225;
        const maxY = 680;

        let px = Math.max(minX, Math.min(maxX, x));
        let py = Math.max(minY, Math.min(maxY, y));

        for (const o of map.obstacles || []) {
            if (!rectsOverlap(o, { x: px - 14, y: py - 14, w: 28, h: 28 })) continue;
            const below = o.y + o.h + 24;
            if (below <= maxY) {
                py = Math.max(py, below);
            } else {
                const right = o.x + o.w + 24;
                if (right <= maxX) px = Math.max(px, right);
                else py = Math.min(py, Math.max(minY, o.y - 24));
            }
        }
        return { x: Math.round(px), y: Math.round(py) };
    }

    addNecromancerEffect(effect) {
        this.necromancerEffects.push(effect);
        if (DEBUG_NECROMANCER_BOSS) {
            console.info(`[Necromancer] efeito ${effect.kind} em (${effect.x},${effect.y})`);
        }
    }

    // Invoca exatamente 5 Reapers nos offsets definidos (pés do boss). Cada
    // posição é validada (limites, obstáculos, portas, jogador, boss, atores e
    // Reapers); se bloqueada, usa o vão livre mais próximo. Nunca em outra mapa.
    spawnNecromancerReapers(boss) {
        const map = this.currentMap;
        const hw = REAPER_COLLIDER_HALF_W;
        const hh = REAPER_COLLIDER_HALF_H;
        this._reaperPlacementLog = [];
        const bossFeetY = boss.y + boss.colliderHalfH;

        for (let i = 0; i < NECROMANCER_REAPER_OFFSETS.length; i++) {
            const off = NECROMANCER_REAPER_OFFSETS[i];
            const feetX = boss.x + off.x;
            const feetY = bossFeetY + off.y;

            let cx = feetX;
            let cy = feetY - hh;
            let adjusted = !this._reaperRectFree(map, cx, cy, hw, hh);
            if (adjusted) {
                const alt = this._findNearestFreeReaperSpot(map, cx, cy, hw, hh);
                if (!alt) {
                    if (DEBUG_NECROMANCER_BOSS) {
                        console.warn(`[Necromancer] Reaper ${i + 1} sem posição livre — ignorado.`);
                    }
                    continue;
                }
                cx = alt.x;
                cy = alt.y;
            }

            const reaper = new Reaper(cx, cy, { id: `king-reaper-${i + 1}` });
            reaper.setCollisionResolver(
                this._buildCollisionResolver(map, reaper.colliderHalfW, reaper.colliderHalfH)
            );
            reaper.setWorldBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height });
            this.actors.push(reaper);
            this.reapers.push(reaper);

            this._reaperPlacementLog.push({
                index: i + 1,
                requested: { x: Math.round(feetX), y: Math.round(feetY) },
                finalFeet: { x: Math.round(cx), y: Math.round(cy + hh) },
                adjusted,
            });

            if (DEBUG_NECROMANCER_BOSS) {
                console.info(
                    `[Necromancer] Reaper ${i + 1} candidato (${Math.round(feetX)},${Math.round(feetY)}) ` +
                    `-> final (${Math.round(cx)},${Math.round(cy + hh)}) ajustado=${adjusted}`
                );
            }
        }
    }

    _reaperRectFree(map, cx, cy, hw, hh) {
        const box = { x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 };
        if (box.x < 0 || box.y < 0 || box.x + box.w > map.width || box.y + box.h > map.height) return false;

        for (const o of map.obstacles || []) {
            if (obstacleCollisionRects(o).some((cr) => rectsOverlap(cr, box))) return false;
        }
        for (const exit of map.exits || []) {
            const area = exit.area
                ? exit.area
                : { x: exit.x - (exit.radius || 0), y: exit.y - (exit.radius || 0), w: (exit.radius || 0) * 2, h: (exit.radius || 0) * 2 };
            if (rectsOverlap(area, box)) return false;
        }

        const p = this.player;
        if (p && !p.isDead) {
            const pr = { x: p.x - p.colliderHalfW, y: p.y - p.colliderHalfH, w: p.colliderHalfW * 2, h: p.colliderHalfH * 2 };
            if (rectsOverlap(pr, box)) return false;
        }

        const b = this.necromancerBoss;
        if (b && !b.isDead) {
            const br = { x: b.x - b.colliderHalfW, y: b.y - b.colliderHalfH, w: b.colliderHalfW * 2, h: b.colliderHalfH * 2 };
            if (rectsOverlap(br, box)) return false;
        }

        for (const actor of this.actors) {
            if (actor.isDead) continue;
            const ar = { x: actor.x - actor.colliderHalfW, y: actor.y - actor.colliderHalfH, w: actor.colliderHalfW * 2, h: actor.colliderHalfH * 2 };
            if (rectsOverlap(ar, box)) return false;
        }

        for (const r of this.reapers) {
            if (r.isDead) continue;
            const rr = { x: r.x - r.colliderHalfW, y: r.y - r.colliderHalfH, w: r.colliderHalfW * 2, h: r.colliderHalfH * 2 };
            if (rectsOverlap(rr, box)) return false;
        }

        return true;
    }

    _findNearestFreeReaperSpot(map, cx, cy, hw, hh) {
        const step = 32;
        for (let radius = step; radius <= 320; radius += step) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
                const nx = cx + Math.cos(a) * radius;
                const ny = cy + Math.sin(a) * radius;
                if (this._reaperRectFree(map, nx, ny, hw, hh)) {
                    return { x: Math.round(nx), y: Math.round(ny) };
                }
            }
        }
        return null;
    }

    // Boss morto: limpa efeitos, dissolve os Reapers restantes e solta uma
    // explosão de partículas. O boss continua visível (morte) até a última
    // frame e então some. A derrota é permanente: só volta em novo jogo.
    onNecromancerDefeated(boss) {
        gameState.necromancerDefeated = true;
        this._showSoulsMessage('SINAL REIVINDICADO', '#f5d28a');
        this.necromancerEffects.length = 0;
        if (!boss._coinAwarded) {
            boss._coinAwarded = true;
            this._awardEnemyCoins(boss.x, boss.y, 30);
        }
        // A ponta da nave cai no chão da Sala do Rei, saltitante (não é
        // apanhada na hora — o jogador precisa apertar E para coletar).
        this._dropBossMissionItem('ponta', boss);
        for (const r of this.reapers) {
            if (r.isDead || r.shouldRemove) continue;
            r.takeDamage(r.maxHp + 9999, boss.x, boss.y);
        }
        for (let i = 0; i < 26; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 140;
            this.particles.push({
                x: boss.x,
                y: boss.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5 + Math.random() * 0.4,
                color: Math.random() > 0.5 ? '#8f1821' : '#3a1a2a',
                size: Math.random() > 0.5 ? 4 : 3,
            });
        }
    }

    // Boss Skeleton_Axe do Núcleo derrotado: mesma oportunidade única do
    // Necromancer — 'SINAL REIVINDICADO' em tela cheia, moedas e explosão de
    // partículas. A derrota é permanente até iniciar um jogo novo.
    onSkeletonAxeBossDefeated(boss) {
        gameState.skeletonAxeBossDefeated = true;
        this._showSoulsMessage('SINAL REIVINDICADO', '#f6c885');
        if (!boss._coinAwarded) {
            boss._coinAwarded = true;
            this._awardEnemyCoins(boss.x, boss.y, 30);
        }
        // O motor da nave cai no chão do Núcleo, saltitante (mesma regra da
        // ponta: só é coletado quando o jogador aperta E perto dele).
        this._dropBossMissionItem('motor', boss);
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 150;
            this.particles.push({
                x: boss.x,
                y: boss.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.5 + Math.random() * 0.45,
                color: Math.random() > 0.5 ? '#f6c885' : '#c84b1c',
                size: Math.random() > 0.5 ? 4 : 3,
            });
        }
    }

    /* ── Assistência do Aliado no Boss Necromancer ─────────── */
    _triggerAllyBossHelp(boss) {
        const selectedId = CHARACTERS[gameState.selectedCharacter]
            ? gameState.selectedCharacter
            : DEFAULT_CHARACTER_ID;
        const roles = resolveCharacterRoles(selectedId);
        const allyId = roles.ally || DEFAULT_CHARACTER_ID;

        // Posição fixa do aliado: à direita e no meio da arena. A primeira
        // aparição define o ponto (fora da porta), e as aparições seguintes
        // (pós-morte) repetem o MESMO lugar em vez de renascer na porta.
        if (!this.bossAssistSpawnPoint) {
            this.bossAssistSpawnPoint = {
                x: Math.round(this.currentMap.width * 0.75),
                y: Math.round(this.currentMap.height * 0.5),
            };
        }
        const spawnX = this.bossAssistSpawnPoint.x;
        const spawnY = this.bossAssistSpawnPoint.y;

        this._spawnTeleportFx(spawnX, spawnY);
        this._nightBannerText = 'ALIADO: "FOGO DE COBERTURA! SEGURA AÍ!"';
        this._nightBannerTimer = 3.2;

        const ally = new CharacterActor({
            x: spawnX,
            y: spawnY,
            characterId: allyId,
            team: 'player',
            role: ActorRole.ALLY
        });
        ally.setCollisionResolver(this._buildCollisionResolver(this.currentMap, ally.colliderHalfW, ally.colliderHalfH));
        ally.setWorldBounds({ minX: 0, minY: 0, maxX: this.currentMap.width, maxY: this.currentMap.height });

        this.actors.push(ally);
        this.bossAssistAlly = ally;
        this.bossAssistTimer = 4.0;
        this.bossAssistShotCooldown = 0.15;
        this.bossAssistDamageBudget = 400; // Dano total máximo do aliado neste assist
    }

    _spawnTeleportFx(x, y) {
        for (let i = 0; i < 28; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 110;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.45 + Math.random() * 0.35,
                color: Math.random() > 0.5 ? '#c084fc' : '#60a5fa',
                size: Math.random() > 0.5 ? 4 : 2
            });
        }
    }

    /* ── Economia: Recompensas e Partículas de Moedas ────── */
    _awardEnemyCoins(x, y, amount) {
        gameState.addCoins(amount);
        this._spawnCoinParticles(x, y, amount);
    }

    _spawnCoinParticles(x, y, amount) {
        for (let i = 0; i < 10; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 30 + Math.random() * 80;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 15,
                life: 0.45 + Math.random() * 0.35,
                color: Math.random() > 0.4 ? '#ffd440' : '#fff275',
                size: Math.random() > 0.5 ? 3 : 2
            });
        }
        this.floatingTexts.push({
            x,
            y: y - 12,
            text: `+${amount} 🪙`,
            life: 1.2,
            maxLife: 1.2,
            vy: -35
        });
    }

    /* ── Missão principal: itens da nave ───────────────────── */
    // Solta a peça de um chefe derrotado no chão do mapa atual. A peça NÃO é
    // apanhada na hora: vira um DroppedItem saltitante que só é coletado com E.
    _dropBossMissionItem(itemId, boss) {
        const def = SPACESHIP_ITEM_DEFS[itemId];
        if (!def) return;
        if (gameState.hasMissionItem(itemId)) return;
        if (!boss) return;

        const feetX = Math.round(boss.x);
        const feetY = Math.round(boss.y + (boss.colliderHalfH || 0));
        gameState.missionDrops[itemId] = { mapId: this.currentMapId, x: feetX, y: feetY };
        this.worldItems.push(new DroppedItem(itemId, feetX, feetY, this.currentMapId));
    }

    // (Re)cria no mapa atual todos os itens de missão que devem estar nele:
    //  - o meio da nave já nasce na superfície nas coordenadas X00942/Y02103;
    //  - as peças soltas pelos chefes aparecem no mapa em que foram dropadas.
    _respawnMissionWorldItems() {
        this.worldItems = [];
        const mapId = this.currentMapId;

        // Meio da nave: item do mundo fixo (não vem de chefe).
        const meio = SPACESHIP_ITEM_DEFS.meio;
        if (meio && mapId === meio.mapId && !gameState.hasMissionItem('meio')) {
            if (!gameState.missionDrops.meio) {
                gameState.missionDrops.meio = { mapId, x: meio.x, y: meio.y };
            }
            const drop = gameState.missionDrops.meio;
            this.worldItems.push(new DroppedItem('meio', drop.x, drop.y, mapId));
        }

        // Peças dropadas pelos chefes (motor no Núcleo, ponta na Sala do Rei).
        // O meio da nave é um item fixo do mundo e já foi tratado acima — por isso
        // é pulado aqui (senão spawmava DUPLICADO na superfície).
        for (const itemId of MISSION_ITEM_ORDER) {
            if (itemId === 'meio') continue;
            if (gameState.hasMissionItem(itemId)) continue;
            const drop = gameState.missionDrops[itemId];
            if (drop && drop.mapId === mapId) {
                this.worldItems.push(new DroppedItem(itemId, drop.x, drop.y, mapId));
            }
        }
    }

    // Coleta uma peça da nave: marca no estado, remove do mundo, dá feedback
    // e — com as 3 peças — dispara o fim da missão (nave consertada).
    _collectMissionItem(item) {
        if (!item || item.collected) return;
        item.collected = true;
        gameState.addMissionItem(item.id);

        this.worldItems = this.worldItems.filter((wi) => wi !== item);
        this.interactableMissionItem = null;

        // Anima o "risco verde + ✓" do log de missões antes de liberar a próxima quest.
        this._questFlashId = item.id;
        this._questFlashT = QUEST_FLASH_DURATION;

        playClickButtonSound();
        const name = item.def ? item.def.name.toUpperCase() : 'PEÇA DA NAVE';
        this.hudMessage = `PEÇA COLETADA: ${name}`;
        this.hudMessageTimer = 2.2;
        this.floatingTexts.push({
            x: item.x,
            y: item.y - 34,
            text: `${name} OBTIDO!`,
            life: 1.5,
            maxLife: 1.5,
            vy: -30,
        });

        if (gameState.isMissionComplete() && !gameState.spaceshipRepaired) {
            this._showSoulsMessage('MISSÃO CONCLUÍDA', '#7fe0a0');
            this._nightBannerText = 'MISSÃO CONCLUÍDA! TODAS AS PEÇAS FORAM REUNIDAS';
            this._nightBannerTimer = 4.0;
        }
    }

    // Quebra um texto em linhas que cabem em maxWidth (usado nos pop-ups e no
    // indicador de missão, que usam fontes pixeladas grandes).
    _wrapHudText(ctx, text, maxWidth) {
        const words = String(text).split(' ');
        const lines = [];
        let cur = '';
        for (const w of words) {
            const test = cur ? `${cur} ${w}` : w;
            if (ctx.measureText(test).width <= maxWidth || !cur) {
                cur = test;
            } else {
                lines.push(cur);
                cur = w;
            }
        }
        if (cur) lines.push(cur);
        return lines;
    }

    // Mensagem central em tela cheia estilo Dark Souls (VOCÊ MORREU, vitórias).
    _showSoulsMessage(text, color = '#e62424') {
        this._soulsMessage = { text, color, timer: 3.0 };
    }

    // Morte estilo Dark Souls: trava a cena com "VOCÊ MORREU" e, após um tempo,
    // respawna o jogador no spawn do mapa. O boss volta NA HORA ao estado
    // inicial da luta (HP cheio no seu posto) e o aliado comprado na loja fica
    // rearmado para reaparecer e continuar ajudando.
    _handlePlayerDeath(dt) {
        if (!this.player.isDead) {
            // Respawn (automático, tecla R ou troca de mapa) encerra o aviso
            // de morte para ele não ficar na tela.
            if (this._deathHandled && this._soulsMessage && this._soulsMessage.text === 'SINAL PERDIDO') {
                this._soulsMessage = null;
            }
            this._deathHandled = false;
            return;
        }

        if (!this._deathHandled) {
            this._deathHandled = true;
            this._deathRespawnTimer = 3.2;
            this._showSoulsMessage('SINAL PERDIDO', '#e62424');
            this._resetBossOnDeath();
        }

        if (this._deathRespawnTimer > 0) this._deathRespawnTimer -= dt;
        if (this._deathRespawnTimer > 0) return;

        // Respawn após morrer: na Sala do Rei (boss Necromancer) o jogador
        // respawna na Sala Principal do castelo — não dentro da sala do boss.
        // No Núcleo de Marte (guardião da duna), o jogador volta para a FRENTE
        // da caverna (superfície) e escolhe se reentra para matar o boss de
        // novo ou se segue outro caminho.
        let respawnPoint = null;
        if (this.currentMapId === MAP_IDS.CASTLE_KING_ROOM) {
            this.changeMap(MAP_IDS.CASTLE_PRINCIPAL_ROOM, 'castle-principal-entry');
        } else if (this.currentMapId === MAP_IDS.MARS_CORE) {
            this.changeMap(MAP_IDS.MARS_SURFACE, 'cave-return');
            respawnPoint = this.currentMap.spawnPoints['cave-return'] || null;
        }

        const spawn = respawnPoint || this.currentMap.spawn || { x: 0, y: 0 };
        this.player.respawn(spawn.x, spawn.y);
        this.player.applyUpgrades(gameState.upgrades || []);
        this.camera.follow(spawn.x, spawn.y, true);
        this._spawnTeleportFx(spawn.x, spawn.y);
        // O aliado só volta a aparecer 0.5s DEPOIS do respawn — nunca na tela
        // de morte ("VOCÊ MORREU").
        this._allyHelpRetryTimer = 0.5;
    }

    // RESET INSTANTÂNEO na morte: o boss (ainda não derrotado) volta ao início,
    // os Reapers invocados se dissolvem e a ajuda do aliado fica rearmada para,
    // ao respawnar, ele continuar apoiando a luta.
    _resetBossOnDeath() {
        const boss = this.necromancerBoss;
        if (boss && !boss.isDead && !gameState.necromancerDefeated) {
            boss.resetForRetry();
            for (const r of this.reapers) {
                if (r.isDead || r.shouldRemove) continue;
                r.takeDamage(r.maxHp + 9999, boss.x, boss.y);
            }
            this.necromancerEffects.length = 0;
        }

        // Boss Skeleton_Axe do Núcleo: volta NA HORA ao estado inicial da luta
        // (vida cheia no posto) quando o jogador morre; derrota só vale se o
        // jogador matar o boss.
        const axeBoss = this.skeletonAxeBoss;
        if (axeBoss && !axeBoss.isDead && !gameState.skeletonAxeBossDefeated) {
            axeBoss.resetForRetry();
        }

        // Recua o aliado que estava em campo: ele reaparece só depois do
        // respawn (0.5s), para não surgir por cima da tela "VOCÊ MORREU".
        if (this.bossAssistAlly) {
            this._spawnTeleportFx(this.bossAssistAlly.x, this.bossAssistAlly.y);
            this.actors = this.actors.filter((a) => a !== this.bossAssistAlly);
            this.bossAssistAlly = null;
        }
        this.bossAssistTimer = 0;
        this.bossAssistShotCooldown = 0;
        this.bossAssistDamageBudget = 0;
        this._allyHelpRetry = false;
        this.allyBossHelpTriggered = false;
        this._allyHelpArenaTime = 0; // após morrer, exige 1s de novo em arena
    }

    _updateNecromancer(dt) {
        const boss = this.necromancerBoss;

        // Conta o tempo vivo dentro da arena: o aliado só pode entrar após o
        // personagem ficar pelo menos 1 segundo em campo (não conta durante a cutscene,
        // nem na tela de morte ou no respawn).
        if (boss && !boss.isDead && !boss._cutscenePlaying && this.player && !this.player.isDead) {
            this._allyHelpArenaTime += dt;
        }

        // Disparo da ajuda do aliado comprado na loja (compra única permanente)
        // Nunca na tela de morte, somente 0.5s após respawn e após o fim da cutscene.
        if (gameState.allyBossHelpPurchased && !this.allyBossHelpTriggered && boss && !boss.isDead && !boss._cutscenePlaying &&
            !this.player.isDead && this._allyHelpRetryTimer <= 0 && this._allyHelpArenaTime >= 1) {
            const distToBoss = Math.hypot(this.player.x - boss.x, this.player.y - boss.y);
            if (distToBoss <= 520 || boss.hp < boss.maxHp || this._allyHelpRetry) {
                this.allyBossHelpTriggered = true;
                this._allyHelpRetry = false;
                this._triggerAllyBossHelp(boss);
            }
        }

        // Simulação ativa da aparição rápida do aliado no boss
        if (this.bossAssistAlly) {
            const ally = this.bossAssistAlly;
            this.bossAssistTimer -= dt;
            this.bossAssistShotCooldown -= dt;

            if (boss && !boss.isDead) {
                const dx = boss.x - ally.x;
                const dy = boss.y - ally.y;
                const aimAngle = Math.atan2(dy, dx);
                ally.updateDirectionFromAngle(aimAngle);

                if (this.bossAssistShotCooldown <= 0 && this.bossAssistDamageBudget > 0) {
                    const shotDamage = Math.min(40, this.bossAssistDamageBudget);
                    this.bossAssistShotCooldown = 0.3; // rajada rápida
                    this.bossAssistDamageBudget -= shotDamage;
                    ally.setState(PlayerState.SHOOTING, true);

                    // Dano garantido: cada disparo do aliado acerta o boss sem
                    // depender de trajetória — nenhum tiro se perde em obstáculo
                    // ou desvio (total de 400 ao fim do assist).
                    boss.takeDamage(shotDamage, ally.x, ally.y, 'ally');
                    this._spawnHitSparks(boss.x, boss.y);

                    // Projétil apenas visual (dano 0 para não dobrar o dano).
                    const spawnDist = 24;
                    const spawnX = ally.x + Math.cos(aimAngle) * spawnDist;
                    const spawnY = ally.y - 18 + Math.sin(aimAngle) * 8;
                    const bulletOpts = {
                        team: 'player',
                        owner: ally,
                        damage: 0
                    };
                    const bullet = new Bullet(spawnX, spawnY, aimAngle, 680, ally.weapon, bulletOpts);
                    this.bullets.push(bullet);
                }
            }

            // Sai quando o timer acaba, o boss morre OU o orçamento de dano esgotou
            if (this.bossAssistTimer <= 0 || (boss && boss.isDead) || this.bossAssistDamageBudget <= 0) {
                this._nightBannerText = 'ALIADO: "BATERIA ESGOTADA! O RESTO É COM VOCÊ!"';
                this._nightBannerTimer = 2.6;
                this._spawnTeleportFx(ally.x, ally.y);
                this.actors = this.actors.filter((a) => a !== ally);
                this.bossAssistAlly = null;
            }
        }

        if (boss) {
            if (!boss.isDead) boss.updateAi(dt, this);
            boss.update(dt);
            if (boss.shouldRemove) {
                this.necromancerBoss = null;
            }
        }
        this._updateNecromancerEffects(dt);
    }

    // Boss Skeleton_Axe do Núcleo: IA + animação próprios (mesma estrutura do
    // Necromancer). Ao final da animação de morte o boss some do mapa.
    _updateSkeletonAxeBoss(dt) {
        const boss = this.skeletonAxeBoss;
        if (!boss) return;

        if (!boss.isDead) boss.updateAi(dt, this);
        boss.update(dt);
        if (boss.shouldRemove) {
            this.skeletonAxeBoss = null;
        }
    }

    _updateNecromancerEffects(dt) {
        for (let i = this.necromancerEffects.length - 1; i >= 0; i--) {
            const e = this.necromancerEffects[i];
            e.t += dt;

            if (e.kind === 'explosion') {
                if (!e.damaged) {
                    e.damaged = true;
                    this._applyNecromancerDamage(e);
                }
                if (e.t >= e.blastDur) {
                    this.necromancerEffects.splice(i, 1);
                }
            } else if (e.kind === 'lightning') {
                if (!e.damaged) {
                    e.damaged = true;
                    this._applyNecromancerDamage(e);
                }
                if (e.t >= e.strikeDur) {
                    this.necromancerEffects.splice(i, 1);
                }
            } else if (e.kind === 'unholy') {
                // Só dá dano enquanto a animação mostra a poça CRESCIDA (frames
                // 11..34). Nas fases de crescimento/redução a poça é pequena no
                // visual — hitbox fora dessa janela deixaria o ataque "invisível".
                const aimgs = getSkillImages('unholy');
                const aFrame = aimgs ? Math.floor(e.t / UNHOLY_FRAME_HZ) % aimgs.length : -1;
                const aGrown = aFrame >= UNHOLY_GROWN_FRAME_INDEX[0] && aFrame <= UNHOLY_GROWN_FRAME_INDEX[1];
                e.tickCd -= dt;
                if (aGrown && e.tickCd <= 0) {
                    e.tickCd = e.tickEvery;
                    this._applyNecromancerDamage(e);
                }
                if (e.t >= e.dur) {
                    this.necromancerEffects.splice(i, 1);
                }
            }
        }
    }

    _applyNecromancerDamage(e) {
        const p = this.player;
        if (!p || p.isDead) return;
        const pr = {
            x: p.x - p.colliderHalfW,
            y: p.y - p.colliderHalfH,
            w: p.colliderHalfW * 2,
            h: p.colliderHalfH * 2,
        };

        const rect = getNecroSkillHitRect(e);
        const hit = rect ? rectsOverlap(pr, rect) : false;
        if (hit) p.takeDamage(e.dmg, e.x, e.y);
    }

    /* ── Boss rendering ────────────────────────────────── */
    _renderNecromancerEffects(ctx) {
        if (this.necromancerEffects.length === 0) return;
        const off = this.camera.getRenderOffset();

        for (const e of this.necromancerEffects) {
            if (e.kind === 'explosion') {
                const imgs = getSkillImages('explosion');
                if (!imgs) continue;
                const sx = Math.round(e.x + off.x);
                const sy = Math.round(e.y + off.y);
                const frame = Math.min(Math.floor(e.t / 0.1), imgs.length - 1);
                const drawW = 64 * 4;
                const drawH = 55 * 4;
                ctx.save();
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(imgs[frame], sx - Math.round(drawW / 2), sy - Math.round(drawH / 2), drawW, drawH);
                ctx.restore();
            } else if (e.kind === 'lightning') {
                const imgs = getSkillImages('lightning', e.variant);
                if (!imgs) continue;
                const sx = Math.round(e.x + off.x);
                const sy = Math.round(e.y + off.y);
                const frame = Math.min(Math.floor(e.t / (e.strikeDur / imgs.length)), imgs.length - 1);
                const drawW = 100 * 3;
                const drawH = 208 * 3;
                ctx.save();
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(imgs[frame], sx - Math.round(drawW / 2), sy - drawH, drawW, drawH);
                ctx.restore();
            } else if (e.kind === 'unholy') {
                const imgs = getSkillImages('unholy');
                if (!imgs) continue;
                const scale = e.scale || 2;
                const drawW = 300 * scale;
                const drawH = 256 * scale;
                const frame = Math.floor(e.t / UNHOLY_FRAME_HZ) % imgs.length;
                const sx = Math.round(e.x + off.x);
                const sy = Math.round(e.y + off.y);
                ctx.save();
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(imgs[frame], sx - Math.round(drawW / 2), sy - drawH, drawW, drawH);
                ctx.restore();
            }
        }
    }

    _renderBossBar(ctx) {
        const boss = this.necromancerBoss || this.skeletonAxeBoss;
        if (!boss) return;

        const isAxeBoss = this.skeletonAxeBoss === boss;
        const label = (boss.name || (isAxeBoss ? 'SKELETON AXE' : 'NECROMANCER')).replace(/_/g, ' ');
        const accent = isAxeBoss ? '#f6c885' : '#d7a45d';
        const fill = isAxeBoss ? '#c84b1c' : '#8f1821';
        const numeric = isAxeBoss ? '#f6c885' : '#f6c885';

        const barW = Math.min(this.width - 120, 760);
        const barH = 18;
        const barX = Math.round((this.width - barW) / 2);
        const barY = this.height - 92;

        ctx.save();

        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = accent;
        ctx.fillText(label, this.width / 2, barY - 8);

        ctx.fillStyle = '#160b0d';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

        const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp));
        const fillW = Math.round((barW - 4) * ratio);
        if (fillW > 0) {
            ctx.fillStyle = fill;
            ctx.fillRect(barX + 2, barY + 2, fillW, barH - 4);
        }

        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillStyle = numeric;
        ctx.fillText(`${Math.round(boss.hp)} / ${boss.maxHp}`, this.width / 2, barY + barH + 25);

        ctx.restore();
    }

    _renderNecromancerDebug(ctx) {
        if (!DEBUG_NECROMANCER_BOSS) return;
        if (this.currentMapId !== MAP_IDS.CASTLE_KING_ROOM) return;

        const off = this.camera.getRenderOffset();
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';

        const spx = Math.round(NECROMANCER_SPAWN.x + off.x);
        const spy = Math.round(NECROMANCER_SPAWN.y + off.y);
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(spx - 6, spy - 2, 12, 4);
        ctx.fillRect(spx - 2, spy - 6, 4, 12);
        ctx.fillText('SPAWN', spx, spy + 22);
        ctx.fillStyle = '#ff88ff';
        ctx.fillText(`${NECROMANCER_SPAWN.x}, ${NECROMANCER_SPAWN.y}`, spx, spy + 34);

        const boss = this.necromancerBoss;
        if (boss) {
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                Math.round(boss.x - boss.colliderHalfW + off.x) + 0.5,
                Math.round(boss.y - boss.colliderHalfH + off.y) + 0.5,
                boss.colliderHalfW * 2,
                boss.colliderHalfH * 2
            );
            const bx = Math.round(boss.x + off.x);
            const by = Math.round(boss.y + off.y);
            ctx.fillStyle = '#ff00ff';
            ctx.fillText(`HP ${Math.round(boss.hp)}/${boss.maxHp}`, bx, by + 30);
            ctx.fillText(`ESTADO ${boss.state}`, bx, by + 44);
            ctx.fillStyle = '#ff66ff';
            ctx.fillText(`ATK ${boss.attackCooldown.toFixed(2)} SKILL ${boss.skillCooldown.toFixed(2)}`, bx, by + 58);
            ctx.fillText(`FASE2 ${boss.hasSummonedReapers ? 'sim' : 'nao'} SUMMON ${boss.summonTimer.toFixed(2)}`, bx, by + 72);
        }

        for (const e of this.necromancerEffects) {
            const rect = getNecroSkillHitRect(e);
            if (!rect) continue;
            const color = e.kind === 'explosion' ? '#ff8888' : e.kind === 'lightning' ? '#88aaff' : '#aa55aa';
            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.strokeRect(
                Math.round(rect.x + off.x) + 0.5,
                Math.round(rect.y + off.y) + 0.5,
                Math.round(rect.w),
                Math.round(rect.h)
            );
        }

        for (const entry of this._reaperPlacementLog) {
            const reqx = Math.round(entry.requested.x + off.x);
            const reqy = Math.round(entry.requested.y + off.y);
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(reqx - 1, reqy - 1, 2, 2);
            ctx.fillStyle = entry.adjusted ? '#ffcc44' : '#44ff44';
            ctx.fillRect(reqx - 2, reqy - 2, 4, 4);
            ctx.fillText(`${entry.index}`, reqx, reqy + 14);
        }
    }

    _loadDayNightIcons() {
        if (this._dayNightIcons.requested || typeof Image === 'undefined') return;
        this._dayNightIcons.requested = true;
        for (const period of Object.keys(DAY_NIGHT_ICON_PATH)) {
            const img = new Image();
            img.src = DAY_NIGHT_ICON_PATH[period];
            this._dayNightIcons.cached.set(period, img);
        }
    }

    _loadUpgradeIcons() {
        if (this._upgradeIconsRequested || typeof Image === 'undefined') return;
        this._upgradeIconsRequested = true;
        const iconPaths = {
            'damage_up': './src/assets/sprites/Upgrades/damage_up.png',
            'life_up': './src/assets/sprites/Upgrades/life_up.png',
            'movespeed_up': './src/assets/sprites/Upgrades/movespeed_up.png'
        };
        for (const [id, path] of Object.entries(iconPaths)) {
            const img = new Image();
            img.src = path;
            this._upgradeIcons.set(id, img);
        }
    }

    // Ícones estáticos e os 8 quadros da animação de quebra de cada item
    // consumível. Carregamento preguiçoso igual ao dos ícones de upgrade.
    _loadItemSprites() {
        if (this._itemSpritesRequested || typeof Image === 'undefined') return;
        this._itemSpritesRequested = true;
        const ITEM_IDS = ['cura_alienigena', 'energia_duna', 'cadencia_frenetica', 'necro_ally_help'];
        for (const id of ITEM_IDS) {
            const iconPath = getItemIconPath(id);
            if (iconPath) {
                const icon = new Image();
                icon.src = iconPath;
                this._itemFxIcons.set(id, icon);
            }
            const framePaths = getItemFramePaths(id);
            if (framePaths) {
                this._itemFxFrames.set(id, framePaths.map((p) => {
                    const img = new Image();
                    img.src = p;
                    return img;
                }));
            }
        }
    }

    // Dispara a animação do frasco "se quebrando" flutuando fixa logo ACIMA da
    // cabeça do personagem, com um brilho na cor do item (verde/vermelho/amarelo).
    // A âncora é recalculada a cada frame, então a animação acompanha o jogador.
    spawnItemBreakFx(itemId) {
        if (!this._itemFxFrames.get(itemId)) return;
        this._itemFx.push({
            itemId,
            elapsed: 0,
            duration: 0.55,
            size: 120
        });
    }

    // Prefixo do gradiente radial do brilho, por item consumível.
    _itemFxGlowColor(itemId) {
        if (itemId === 'cura_alienigena') return 'rgba(34, 197, 94,';   // verde
        if (itemId === 'energia_duna') return 'rgba(239, 68, 68,';       // vermelho
        if (itemId === 'cadencia_frenetica') return 'rgba(234, 179, 8,'; // amarelo
        return 'rgba(255, 255, 255,';
    }

    _renderItemFx(ctx) {
        for (const fx of this._itemFx) {
            const frames = this._itemFxFrames.get(fx.itemId);
            if (!frames || !frames.length) continue;
            const total = frames.length;
            const idx = Math.min(total - 1, Math.floor((fx.elapsed / fx.duration) * total));
            const img = frames[idx];
            if (!img || !img.complete || img.naturalWidth <= 0) continue;

            const ratio = img.naturalWidth / img.naturalHeight;
            let iw = fx.size;
            let ih = fx.size;
            if (ratio > 1) ih = Math.round(fx.size / ratio);
            else iw = Math.round(fx.size * ratio);

            // Âncora: centro horizontal do personagem, logo acima da cabeça.
            const screen = this.camera.worldToScreen(this.player.x, this.player.y);
            const headY = screen.y - (this.player.renderSize || 64) / 2;
            const cx = Math.round(screen.x);
            const cy = Math.round(headY - 18 - ih / 2);

            ctx.save();

            // Brilho leve ao redor, na cor do item
            const glow = this._itemFxGlowColor(fx.itemId);
            const gg = ctx.createRadialGradient(cx, cy, ih * 0.15, cx, cy, ih * 0.9);
            gg.addColorStop(0, glow + '0.7)');
            gg.addColorStop(1, glow + '0)');
            ctx.fillStyle = gg;
            ctx.beginPath();
            ctx.arc(cx, cy, ih * 0.9, 0, Math.PI * 2);
            ctx.fill();

            // Frasco quebrando (pixelado, sem suavizar)
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, cx - Math.round(iw / 2), cy - Math.round(ih / 2), iw, ih);

            ctx.restore();
        }
    }

    unlockUpgrade(upgradeId) {
        if (!gameState.addUpgrade(upgradeId)) return;

        // Apply stats immediately to player
        this.player.applyUpgrades(gameState.upgrades);
        gameState.playerHp = this.player.hp;
        gameState.maxPlayerHp = this.player.maxHp;

        const titles = {
            'damage_up': 'UPGRADE: DANO +20%!',
            'life_up': 'UPGRADE: VIDA MÁXIMA +25!',
            'movespeed_up': 'UPGRADE: VELOCIDADE +10% | ENERGIA +30!'
        };
        this._nightBannerText = titles[upgradeId] || `UPGRADE: ${upgradeId.toUpperCase()}`;
        this._nightBannerTimer = 4.0;
        console.log(`[Upgrades] Desbloqueado: ${upgradeId}. Upgrades ativos:`, gameState.upgrades);
    }

    _buildCollisionResolver(map, halfW, halfH) {
        const obstacles = buildCollisionObstacles(map, halfW, halfH);
        return (px, py, dx, dy) => resolveSlide(
            px, py, halfW, halfH, dx, dy, obstacles,
            { minX: 0, minY: 0, maxX: map.width, maxY: map.height }
        );
    }

    /**
     * Derive the ally/enemy characters from the selection and (re)spawn them.
     * The ally only appears on the surface; the enemy only spawns once a
     * position is configured in CHARACTER_ENEMY_SPAWNS.
     */
    _setupCharacterRoles(map) {
        this.actors = [];

        const selectedId = CHARACTERS[gameState.selectedCharacter]
            ? gameState.selectedCharacter
            : DEFAULT_CHARACTER_ID;
        const roles = resolveCharacterRoles(selectedId);
        this.characterRoles = roles;
        gameState.characterRoles = roles;

        if (map.id === MAP_IDS.MARS_SURFACE && roles.ally) {
            const ally = new CharacterActor({
                x: CHARACTER_ALLY_SHOP_POSITION.x,
                y: CHARACTER_ALLY_SHOP_POSITION.y,
                characterId: roles.ally,
                team: 'ally',
                role: ActorRole.ALLY
            });
            ally.setCollisionResolver(this._buildCollisionResolver(map, ally.colliderHalfW, ally.colliderHalfH));
            ally.setWorldBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height });
            this.actors.push(ally);
        }

        this._enemyNpcActor = null;
        if (map.id === MAP_IDS.MARS_SURFACE && roles.enemy) {
            const spawn = CHARACTER_ENEMY_SPAWNS[roles.enemy];
            if (spawn) {
                const enemy = new CharacterActor({
                    x: spawn.x,
                    y: spawn.y,
                    characterId: roles.enemy,
                    team: 'enemy',
                    role: ActorRole.ENEMY
                });
                enemy.isEnemyNpc = true;
                enemy._dialoguePending = true;
                enemy._dialogueStarted = false;
                enemy.setCollisionResolver(this._buildCollisionResolver(map, enemy.colliderHalfW, enemy.colliderHalfH));
                enemy.setWorldBounds({ minX: 0, minY: 0, maxX: map.width, maxY: map.height });
                this.actors.push(enemy);
                this._enemyNpcActor = enemy;
            }
        }
    }

    async changeMap(targetMapId, spawnId) {
        let cutsceneSrc = null;
        let isNecroIntro = false;
        let isAxeIntro = false;

        // Cutscene do Necromancer (Sala do Rei): toca na primeira entrada da partida
        // (não repete após morte/retry do jogador).
        if (targetMapId === MAP_IDS.CASTLE_KING_ROOM && !gameState.necroIntroDone && !gameState.necromancerDefeated) {
            cutsceneSrc = './src/assets/cutscenes/necro/cutscene_necro.mp4';
            isNecroIntro = true;
        } else if (targetMapId === MAP_IDS.MARS_CORE && !gameState.axeBossIntroDone && !gameState.skeletonAxeBossDefeated) {
            // Cutscene do Old Guardian (Núcleo de Marte): toca na primeira entrada da partida
            cutsceneSrc = './src/assets/cutscenes/oldguardian/cutscene_old_guardian.mp4';
            isAxeIntro = true;
        }

        this._loadMap(targetMapId, spawnId);

        if (cutsceneSrc) {
            this._cutsceneActive = true;
            if (this.input) this.input.keys = {};

            const boss = isNecroIntro ? this.necromancerBoss : this.skeletonAxeBoss;
            if (boss) {
                boss._cutscenePlaying = true;
            }
            if (isNecroIntro) gameState.necroIntroDone = true;
            if (isAxeIntro) gameState.axeBossIntroDone = true;

            // Zera o tempo vivo na arena para o aliado não entrar antes da hora
            this._allyHelpArenaTime = 0;
            this.allyBossHelpTriggered = false;

            try {
                await playBossCutscene(this.container, cutsceneSrc);
            } catch (err) {
                console.error('[Cutscene] Erro ao reproduzir vídeo:', err);
            } finally {
                this._cutsceneActive = false;
                if (this.input) this.input.keys = {};
                const activeBoss = isNecroIntro ? this.necromancerBoss : this.skeletonAxeBoss;
                if (activeBoss) {
                    activeBoss._cutscenePlaying = false;
                }
                this._allyHelpArenaTime = 0;
                this.mapTransitionCooldown = 0.5;
            }
        }
    }

    // A saída de uma arena de boss fica bloqueada enquanto o chefe ainda não
    // foi derrotado: na Sala do Rei (Necromancer) e no Núcleo de Marte
    // (Skeleton_Axe) o jogador não pode sair da sala até matar o boss.
    shouldLockBossRoomExit() {
        if (this.currentMapId === MAP_IDS.CASTLE_KING_ROOM) {
            return !gameState.necromancerDefeated;
        }
        if (this.currentMapId === MAP_IDS.MARS_CORE) {
            return !gameState.skeletonAxeBossDefeated;
        }
        return false;
    }

    /* ── Among Us easter egg ─────────────────────────────── */
    _updateAmongUs(dt) {
        // Uma instância por vez: anima e descarta quando o loop acaba.
        if (this.amongUsEasterEgg) {
            this.amongUsEasterEgg.update(dt);
            if (this.amongUsEasterEgg.shouldRemove) {
                this.amongUsEasterEgg = null;
            }
        }

        // O cronômetro só conta em gameplay, dentro de um mapa elegível.
        if (!AMONG_US_ELIGIBLE_MAPS.has(this.currentMapId)) return;
        if (this.player.isDead) return;

        this.amongUsTimer += dt;
        const interval = DEBUG_AMONG_US_EASTER_EGG ? 5 : AMONG_US_INTERVAL_SECONDS;
        if (this.amongUsEasterEgg || this.amongUsTimer < interval) return;

        this.amongUsTimer = 0;
        this._spawnAmongUs();
    }

    _spawnAmongUs() {
        const spot = this._findAmongUsSpot(this.currentMap);
        if (!spot) {
            if (DEBUG_AMONG_US_EASTER_EGG) {
                console.warn(`[AmongUs] nenhuma posição válida em ${this.currentMapId}`);
            }
            return;
        }
        this._placeAmongUs(spot);
    }

    // Spawn secreto (Ctrl+Shift+1+F): faz o impostor surgir pouquíssimos passos
    // à frente do jogador, na direção que ele está olhando.
    _spawnAmongUsInFront() {
        const dist = 96;
        const v = this._facingOffset();
        const spot = this._nudgeAmongUsSpot(
            this.currentMap,
            this.player.x + v.x * dist,
            this.player.y + v.y * dist
        );
        if (!spot) {
            if (DEBUG_AMONG_US_EASTER_EGG) {
                console.warn('[AmongUs] sem posição válida na frente do jogador');
            }
            return;
        }
        this.amongUsTimer = 0;
        this._placeAmongUs(spot);
        if (DEBUG_AMONG_US_EASTER_EGG) {
            console.info(`[AmongUs] spawn secreto na frente em (${spot.x}, ${spot.y})`);
        }
    }

    _placeAmongUs(spot) {
        this.amongUsEasterEgg = new AmongUsEasterEgg(spot.x, spot.y, this.currentMapId);
        if (DEBUG_AMONG_US_EASTER_EGG) {
            console.info(`[AmongUs] easter egg na posição (${spot.x}, ${spot.y}) de ${this.currentMapId}`);
        }
    }

    // Vetor unitário da direção do jogador (direções de 8 pontos do Player).
    _facingOffset() {
        const vectors = {
            south: { x: 0, y: 1 },
            'south-east': { x: 0.7071, y: 0.7071 },
            east: { x: 1, y: 0 },
            'north-east': { x: 0.7071, y: -0.7071 },
            north: { x: 0, y: -1 },
            'north-west': { x: -0.7071, y: -0.7071 },
            west: { x: -1, y: 0 },
            'south-west': { x: -0.7071, y: 0.7071 }
        };
        return vectors[this.player.direction] || { x: 0, y: 1 };
    }

    // Uma posição está livre quando a caixa de teste (TEST_HALF_W/H) não encosta
    // em nada: fora dos limites, obstáculos, área preta/máscara, portas, jogador
    // ou qualquer ator do mapa.
    _amongUsIsBlocked(map, cx, cy) {
        const hw = AMONG_US_TEST_HALF_W;
        const hh = AMONG_US_TEST_HALF_H;
        const rect = { x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 };
        if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > map.width || rect.y + rect.h > map.height) {
            return true;
        }
        for (const o of map.obstacles) {
            if (obstacleCollisionRects(o).some((cr) => rectsOverlap(cr, rect))) return true;
        }
        for (const exit of map.exits || []) {
            if (exit.area && rectsOverlap(exit.area, rect)) return true;
            if (!exit.area && exit.x !== undefined) {
                const r = exit.radius ?? 48;
                const dx = cx - exit.x;
                const dy = cy - exit.y;
                if (dx * dx + dy * dy <= (r + hw) * (r + hw)) return true;
            }
        }
        const p = this.player;
        if (p && !p.isDead) {
            const pr = {
                x: p.x - p.colliderHalfW,
                y: p.y - p.colliderHalfH,
                w: p.colliderHalfW * 2,
                h: p.colliderHalfH * 2
            };
            if (rectsOverlap(pr, rect)) return true;
        }
        for (const actor of this.actors) {
            const ar = {
                x: actor.x - actor.colliderHalfW,
                y: actor.y - actor.colliderHalfH,
                w: actor.colliderHalfW * 2,
                h: actor.colliderHalfH * 2
            };
            if (rectsOverlap(ar, rect)) return true;
        }
        return false;
    }

    // Procurou uma posição aleatória válida no mapa: livre de obstáculos,
    // área preta (via obstacles/terrainMask), portas, do jogador e dos atores.
    _findAmongUsSpot(map) {
        const hw = AMONG_US_TEST_HALF_W;
        const hh = AMONG_US_TEST_HALF_H;
        const mask = map.terrainMask;
        const cell = map.maskCell;
        for (let attempt = 0; attempt < AMONG_US_MAX_ATTEMPTS; attempt++) {
            let cx, cy;
            if (mask && mask.length) {
                // Cavernas por sprite: a âncora cai no centro de uma célula '.' do chão.
                const cols = mask[0].length;
                const r = Math.floor(Math.random() * mask.length);
                const c = Math.floor(Math.random() * cols);
                if (mask[r][c] !== '.') continue;
                cx = c * cell + cell / 2;
                cy = r * cell + cell / 2;
            } else {
                cx = hw + Math.random() * (map.width - hw * 2);
                cy = hh + Math.random() * (map.height - hh * 2);
            }
            if (this._amongUsIsBlocked(map, cx, cy)) continue;
            return { x: Math.round(cx), y: Math.round(cy) };
        }
        return null;
    }

    // Espiral ao redor de um ponto preferido até achar uma posição livre.
    _nudgeAmongUsSpot(map, baseX, baseY) {
        if (!this._amongUsIsBlocked(map, baseX, baseY)) {
            return { x: Math.round(baseX), y: Math.round(baseY) };
        }
        const step = 40;
        for (let radius = step; radius <= 240; radius += step) {
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
                const cx = baseX + Math.cos(a) * radius;
                const cy = baseY + Math.sin(a) * radius;
                if (this._amongUsIsBlocked(map, cx, cy)) continue;
                return { x: Math.round(cx), y: Math.round(cy) };
            }
        }
        return null;
    }

    _handleResize() {
        if (!this.canvas) return;
        const aspect = this.width / this.height;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let renderW = windowWidth;
        let renderH = windowWidth / aspect;

        if (renderH > windowHeight) {
            renderH = windowHeight;
            renderW = windowHeight * aspect;
        }

        this.canvas.style.width = `${Math.floor(renderW)}px`;
        this.canvas.style.height = `${Math.floor(renderH)}px`;
    }

    /**
     * Aplica as configurações persistidas (tela inicial/pausa) ao game loop.
     * O brilho ajusta o CONTÊINER RAIZ (#app) — que engloba o canvas do jogo
     * e os overlays do menu — e não apenas o canvas, para escurecer a tela
     * inteira (aplicado de novo ao iniciar a partida para refizer o estado).
     */
    _applyStoredSettings() {
        const settings = loadSettings();
        const root = this.container || document.getElementById('app');
        if (root) {
            root.style.filter = brightnessFilter(settings.brightness);
        }
    }

    _handleKeyDown(e) {
        // Enquanto uma cutscene estiver ativa, não processa comandos de jogo
        if (this._cutsceneActive) return;

        // Ignore key events while the user is typing in a form field
        const target = e.target;
        if (target instanceof HTMLElement && (
            target.matches('input, textarea, select') ||
            target.isContentEditable
        )) {
            return;
        }

        // ESC toggles the pause menu
        if (e.code === 'Escape') {
            e.preventDefault();
            // Impede que o navegador saia da tela cheia ao apertar ESC
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                window.__noSignalKeepFullscreen = true;
                e.preventDefault();
            }
            // Cave choice screen intercepts its own ESC while focused, but this
            // branch is a safety net (e.g. focus outside the overlay).
            if (isCaveChoiceOpen()) {
                closeCaveChoiceScreen();
                this.paused = false;
                return;
            }
            if (isShopOpen()) {
                closeShopScreen();
                this.paused = false;
                return;
            }
            if (isPauseMenuOpen()) {
                closePauseMenu();
                this.paused = false;
            } else {
                this.input.keys = {};
                this.paused = true;
                openPauseMenu(this.container, this);
            }
            return;
        }

        this.input.keys[e.code] = true;

        // While paused, gameplay/debug actions must not execute
        if (this.paused) return;

        // Dash ([Q]).
        if (e.code === 'KeyQ' && !e.repeat && this.player && !this.player.isDead && !this._cutsceneActive) {
            if (this.player.dash(this.input, this.camera)) {
                this._spawnDashFx(this.player);
            }
            return;
        }

        // Interação com a loja do NPC Aliado ([E] perto do aliado)
        if (e.code === 'KeyE' && this.interactableShop && !isShopOpen() && this.mapTransitionCooldown <= 0) {
            playClickButtonSound();
            openShopScreen(this.container, this);
            return;
        }

        // Coleta de peça da nave ([E] perto de um item da missão principal)
        if (e.code === 'KeyE' && this.interactableMissionItem && !this.player.isDead && this.mapTransitionCooldown <= 0) {
            this._collectMissionItem(this.interactableMissionItem);
            return;
        }

        if (e.code === 'KeyE' && this.interactableMissionShip && !this.player.isDead && !this._shipRepairFade) {
            playClickButtonSound();
            if (!gameState.spaceshipRepaired) {
                this._shipRepairFade = { elapsed: 0, duration: 2.4, repaired: false };
            } else if (!gameState.missionConcluded) {
                gameState.missionConcluded = true;
                this._triggerEnding('final1');
            }
            return;
        }

        // Map transition interaction ([E] on a doorway/portal)
        if (e.code === 'KeyE' && this.interactableExit && this.mapTransitionCooldown <= 0) {
            const exit = this.interactableExit;
            // Som de confirmação: toca SOMENTE quando E realmente ativa a
            // interação (porta/portal) — nunca ao entrar na área do prompt.
            playClickButtonSound();
            // The cave entrance opens the cave CHOICE screen instead of
            // transitioning directly; the map change happens only after the
            // player picks "Núcleo de Marte" or "Catacumbas Marcianas".
            if (exit.id === 'cave-entrance') {
                openCaveChoiceScreen(this.container, this, exit);
                return;
            }
            this.changeMap(exit.targetMap, exit.targetSpawn);
            return;
        }


        // Easter egg secreto: Ctrl+Shift+1+F faz o Among Us surgir na frente.
        // (Ctrl+1 puro é roubado pelo navegador, por isso o Shift.)
        const secretAmongUs = e.ctrlKey && e.shiftKey && (
            (e.code === 'Digit1' && this.input.keys['KeyF']) ||
            (e.code === 'KeyF' && this.input.keys['Digit1'])
        );
        if (secretAmongUs) {
            e.preventDefault();
            this._spawnAmongUsInFront();
            return;
        }

        // State-testing hotkeys
        // (Ctrl+F é 'buscar' do navegador; com Ctrl segurado o F não troca de estado)
        if (e.code === 'KeyF' && !e.ctrlKey) {
            if (this.player.state === PlayerState.FLOATING) {
                this.player.setState(PlayerState.IDLE, true);
            } else {
                this.player.setState(PlayerState.FLOATING, true);
            }
        } else if (e.code === 'KeyP') {
            if (this.player.state === PlayerState.PUSH_PULL) {
                this.player.setState(PlayerState.IDLE, true);
            } else {
                this.player.setState(PlayerState.PUSH_PULL, true);
            }
        }

        // Itens consumíveis do inventário (estilo Dark Souls): teclas 1/2/3
        // consomem o item do slot correspondente quando está no inventário.
        const slotMap = { Digit1: 1, Digit2: 2, Digit3: 3 };
        const itemSlot = slotMap[e.code];
        if (itemSlot) {
            if (!this.player.isDead) {
                const result = consumeInventorySlot(itemSlot, this.player);
                if (result.message) {
                    if (result.used) {
                        playClickButtonSound();
                        const usedItem = getSlotItem(itemSlot);
                        if (usedItem) this.spawnItemBreakFx(usedItem.id);
                    }
                    this.hudMessage = result.message;
                    this.hudMessageTimer = 1.8;
                }
            }
            return;
        }
    }

    _handleKeyUp(e) {
        this.input.keys[e.code] = false;
    }

    _handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.width / rect.width;
        const scaleY = this.height / rect.height;

        this.input.mouseX = (e.clientX - rect.left) * scaleX;
        this.input.mouseY = (e.clientY - rect.top) * scaleY;
    }

    _handleMouseDown(e) {
        if (e.button === 0) {
            this.input.mouseLeft = true;
        } else if (e.button === 1) {
            e.preventDefault();
            this.input.mouseMiddle = true;
        } else if (e.button === 2) {
            this.input.mouseRight = true;
        }
    }

    _handleMouseUp(e) {
        if (e.button === 0) {
            this.input.mouseLeft = false;
        } else if (e.button === 1) {
            this.input.mouseMiddle = false;
        } else if (e.button === 2) {
            this.input.mouseRight = false;
        }
    }

    addBullet(bullet) {
        this.bullets.push(bullet);
    }

    // Dano melee do soco do jogador: varre todos os inimigos dentro do alcance
    // e aplica dano a cada um que estiver no cone frontal do soco.
    applyPlayerMeleeAttack(player, aimAngle, damage) {
        const meleeRange = 55;
        const meleeConeHalf = Math.PI / 3; // ±60° do ângulo de mira

        const targets = [
            ...this.actors.filter(a => a.team === 'enemy' && !a.isDead),
            ...this.golems.filter(g => !g.isDead),
            ...this.reapers.filter(r => !r.isDead),
            ...(this.skeletons || []).filter(s => !s.isDead)
        ];
        if (this.necromancerBoss && !this.necromancerBoss.isDead) targets.push(this.necromancerBoss);
        if (this.skeletonAxeBoss && !this.skeletonAxeBoss.isDead) targets.push(this.skeletonAxeBoss);

        for (const target of targets) {
            const dx = target.x - player.x;
            const dy = target.y - player.y;
            const dist = Math.hypot(dx, dy);
            if (dist > meleeRange) continue;

            const angleToTarget = Math.atan2(dy, dx);
            let angleDiff = angleToTarget - aimAngle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            if (Math.abs(angleDiff) > meleeConeHalf) continue;

            target.takeDamage(damage, player.x, player.y);
            this._spawnHitSparks(target.x, target.y);

            if (target.isDead && !target._coinAwarded && target.team === 'enemy') {
                target._coinAwarded = true;
                const reward = target.name === 'GOLEM' ? 5 : (target.name?.includes('SPEARMAN') ? 4 : 3);
                this._awardEnemyCoins(target.x, target.y, reward);
            }
        }
    }

    // Team damage rules:
    //  - player bullets hit enemies only
    //  - enemy bullets hit the player only (the ally is immune)
    //  - ally bullets hit enemies only
    //  - an entity is never damaged by its own projectile
    _bulletCanDamage(bullet, targetTeam, target) {
        if (target === bullet.owner) return false;
        const attackerTeam = bullet.team || 'player';
        if (targetTeam === attackerTeam) return false;
        if (attackerTeam === 'player') return targetTeam === 'enemy';
        if (attackerTeam === 'enemy') return targetTeam === 'player';
        if (attackerTeam === 'ally') return targetTeam === 'enemy';
        return false;
    }

    _spawnHitSparks(x, y) {
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 120;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 0.35 + Math.random() * 0.25,
                color: Math.random() > 0.5 ? '#ff4d15' : '#f6c885',
                size: Math.random() > 0.5 ? 3 : 2
            });
        }
    }

    // Brilhozinho do dash: explosão de partículas ciano/brancas soltas para
    // trás do personagem no instante em que começa o impulso.
    _spawnDashFx(player) {
        const backX = player.x - player.dashDirX * 20;
        const backY = player.y - player.dashDirY * 20;
        for (let i = 0; i < 16; i++) {
            const angle = Math.atan2(player.dashDirY, player.dashDirX) + (Math.random() - 0.5) * 2.4;
            const speed = 90 + Math.random() * 170;
            this.particles.push({
                x: backX + (Math.random() - 0.5) * 14,
                y: backY + (Math.random() - 0.5) * 14,
                vx: Math.cos(angle) * speed - player.dashDirX * 150,
                vy: Math.sin(angle) * speed - player.dashDirY * 150,
                life: 0.25 + Math.random() * 0.25,
                color: Math.random() > 0.45 ? '#7fe7ff' : '#ffffff',
                size: Math.random() > 0.5 ? 3 : 2
            });
        }
    }

    _gameLoop(timestamp) {
        if (!this.isRunning) return;

        // If the pause menu was closed by clicking the backdrop, resume.
        if (this.paused && !isPauseMenuOpen() && !isCaveChoiceOpen() && !isShopOpen()) {
            this.paused = false;
        }

        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Cap dt to prevent frame skipping glitch
        if (dt > 0.1) dt = 0.1;

        // Paused: freeze gameplay, keep the last rendered frame on screen
        if (this.paused) {
            this.animationFrameId = requestAnimationFrame(this._gameLoop.bind(this));
            return;
        }

        try {
            this.update(dt);
            this.render();
        } catch (err) {
            // A single bad frame must never freeze the game for good: log the
            // error and keep the loop alive instead of dropping the rAF.
            console.error('[GameEngine] erro no frame:', err);
        }

        this.animationFrameId = requestAnimationFrame(this._gameLoop.bind(this));
    }

    update(dt) {
        // Durante a exibição da cutscene, congela o mundo, IA e entidades
        if (this._cutsceneActive) return;

        // Advance the day/night clock first so a wave spawned on a night
        // transition is simulated in the same frame.
        this._updateDayNight(dt);
        if (this._endingTriggered) return;

        if (this._shipRepairFade) {
            this._shipRepairFade.elapsed += dt;
            const half = this._shipRepairFade.duration / 2;
            if (!this._shipRepairFade.repaired && this._shipRepairFade.elapsed >= half) {
                gameState.spaceshipRepaired = true;
                this._shipRepairFade.repaired = true;
                this._showSoulsMessage('NAVE CONSERTADA!', '#7fe0a0');
            }
            if (this._shipRepairFade.elapsed >= this._shipRepairFade.duration) this._shipRepairFade = null;
        }

        // Among Us easter egg: só anima/spawna em gameplay, dentro de mapas elegíveis.
        this._updateAmongUs(dt);

        // Update player input and logic
        this.player.handleInput(this.input, this.camera, this);
        this.player.update(dt);
        this._handlePlayerDeath(dt);

        // Fagulhas contínuas do dash (rastro branco/brilhante atrás do personagem).
        if (this.player.state === PlayerState.DASHING && this.player.dashTimer > 0) {
            for (let i = 0; i < 2; i++) {
                this.particles.push({
                    x: this.player.x - this.player.dashDirX * 18 + (Math.random() - 0.5) * 16,
                    y: this.player.y - this.player.dashDirY * 18 + (Math.random() - 0.5) * 16,
                    vx: -this.player.dashDirX * 45 + (Math.random() - 0.5) * 30,
                    vy: -this.player.dashDirY * 45 + (Math.random() - 0.5) * 30,
                    life: 0.12 + Math.random() * 0.16,
                    color: Math.random() > 0.35 ? '#ffffff' : '#fef08a',
                    size: Math.random() > 0.5 ? 3 : 2
                });
            }
        }

        // Timer do feedback de item consumido no HUD
        if (this.hudMessageTimer > 0) {
            this.hudMessageTimer -= dt;
            if (this.hudMessageTimer <= 0) this.hudMessage = '';
        }

        // Animações de item "se quebrando" ao lado da HUD de upgrades
        for (let i = this._itemFx.length - 1; i >= 0; i--) {
            this._itemFx[i].elapsed += dt;
            if (this._itemFx[i].elapsed >= this._itemFx[i].duration) {
                this._itemFx.splice(i, 1);
            }
        }

        // Recarga (cooldown de 15s) dos itens consumíveis
        gameState.tickItemCooldowns(dt);

        // Conta o tempo das mensagens em tela cheia (VOCÊ MORREU / vitórias).
        if (this._soulsMessage) {
            this._soulsMessage.timer -= dt;
            if (this._soulsMessage.timer <= 0) this._soulsMessage = null;
        }

        // Após o respawn, espera 0.5s e só então libera o aliado para reaparecer.
        if (this._allyHelpRetryTimer > 0) {
            this._allyHelpRetryTimer -= dt;
            if (this._allyHelpRetryTimer <= 0) {
                this._allyHelpRetryTimer = 0;
                this._allyHelpRetry = true;
            }
        }

        // Update non-player characters (allies idle, enemies pursue & fire,
        // golems pursue & melee)
        for (const actor of this.actors) {
            if (actor === this._enemyNpcActor && actor._dialoguePending && !actor._dialogueStarted &&
                this.player && Math.hypot(this.player.x - actor.x, this.player.y - actor.y) <= 180) {
                actor._dialogueStarted = true;
                this._cutsceneActive = true;
                if (this.input) this.input.keys = {};
                const selectedId = CHARACTERS[gameState.selectedCharacter] ? gameState.selectedCharacter : DEFAULT_CHARACTER_ID;
                playNpcDialogue(this.container, selectedId, actor.characterId)
                    .catch((error) => console.error('[Dialogue] Falha ao exibir diálogo:', error))
                    .finally(() => {
                        actor._dialoguePending = false;
                        this._cutsceneActive = false;
                        if (this.input) this.input.keys = {};
                    });
                return;
            }
            actor.updateAi(dt, this);
            actor.update(dt);
            if (actor.isDead) {
                if (!actor._coinAwarded && actor.team === 'enemy') {
                    actor._coinAwarded = true;
                    const reward = actor.name === 'GOLEM' ? 5 : (actor.name?.includes('SPEARMAN') ? 4 : 3);
                    this._awardEnemyCoins(actor.x, actor.y, reward);
                }

                // Upgrade: movespeed_up (ao derrotar o NPC inimigo Space Lizard / Ocstronaut)
                if (!gameState.hasUpgrade('movespeed_up') &&
                    (actor.isEnemyNpc || actor === this._enemyNpcActor || (actor instanceof CharacterActor && (actor.role === ActorRole.ENEMY || actor.team === 'enemy')))) {
                    this.unlockUpgrade('movespeed_up');
                }
            }
        }
        for (const r of this.reapers) {
            if (r.isDead && !r._coinAwarded) {
                r._coinAwarded = true;
                this._awardEnemyCoins(r.x, r.y, 2);
            }
        }
        // Verifica se a horda de golems foi completamente derrotada
        if (this._waveGolemsActive) {
            const aliveGolems = this.golems.filter((g) => !g.isDead && !g.shouldRemove);
            if (aliveGolems.length === 0) {
                this._waveGolemsActive = false;
                this._awardEnemyCoins(this.player.x, this.player.y - 30, 40);
                this._nightBannerText = 'HORDA DERROTADA! +40 🪙';
                this._nightBannerTimer = 3.5;

                // Upgrade: life_up (ao derrotar a primeira horda de golems)
                if (!gameState.hasUpgrade('life_up')) {
                    this.unlockUpgrade('life_up');
                }
            }
        }

        // Upgrade: damage_up (ao derrotar todos os esqueletos nas Catacumbas)
        // — a limpeza é permanente até iniciar um jogo novo.
        if (this.currentMapId === MAP_IDS.MARS_CATACOMBS && this._catacombsSkeletonsActive && !gameState.hasUpgrade('damage_up')) {
            const aliveSkeletons = this.skeletons.filter((s) => !s.isDead && !s.shouldRemove);
            if (aliveSkeletons.length === 0) {
                this._catacombsSkeletonsActive = false;
                gameState.catacombsCleared = true;
                this.unlockUpgrade('damage_up');
            }
        }

        // Upgrade: movespeed_up (verificação direta do NPC inimigo)
        if (!gameState.hasUpgrade('movespeed_up') && this._enemyNpcActor && (this._enemyNpcActor.isDead || this._enemyNpcActor.hp <= 0)) {
            this.unlockUpgrade('movespeed_up');
        }

        if (this.actors.some((a) => a.shouldRemove)) {
            this.actors = this.actors.filter((a) => !a.shouldRemove);
            this.golems = this.golems.filter((g) => !g.shouldRemove);
            this.skeletons = this.skeletons.filter((s) => !s.shouldRemove);
            this.reapers = this.reapers.filter((r) => !r.shouldRemove);
        }

        // Boss Necromancer: IA, animação, fase de invocação e efeitos ativos.
        this._updateNecromancer(dt);

        // Boss Skeleton_Axe do Núcleo: IA + animação próprios.
        this._updateSkeletonAxeBoss(dt);

        // Shop interaction detection (Ally NPC on Mars Surface)
        this.interactableShop = null;
        this.shopPrompt = '';
        if (this.currentMapId === MAP_IDS.MARS_SURFACE && !this.player.isDead) {
            const ally = this.actors.find((a) => (a.role === 'ally' || a.team === 'ally') && a !== this.bossAssistAlly);
            if (ally) {
                const distToAlly = Math.hypot(this.player.x - ally.x, this.player.y - ally.y);
                if (distToAlly <= 95) {
                    this.interactableShop = ally;
                    this.shopPrompt = 'LOJA DO ALIADO';
                }
            }
        }

        // Map transition interaction detection
        this.mapTransitionCooldown = Math.max(0, this.mapTransitionCooldown - dt);
        this.interactableExit = null;
        this.lockedExitPrompt = null;
        this.promptText = '';
        const playerRect = {
            x: this.player.x - this.player.colliderHalfW,
            y: this.player.y - this.player.colliderHalfH,
            w: this.player.colliderHalfW * 2,
            h: this.player.colliderHalfH * 2,
        };
        for (const exit of this.currentMap.exits || []) {
            const triggered = exit.area
                ? rectsOverlap(playerRect, exit.area)
                : pointInCircle(this.player.x, this.player.y, exit);
            if (triggered) {
                // Arena de boss: a porta fica "trancada" (sem prompt [E] e sem
                // troca de mapa) até o chefe ser derrotado.
                if (this.shouldLockBossRoomExit()) {
                    this.lockedExitPrompt = {
                        x: exit.promptX !== undefined ? exit.promptX : (exit.area ? exit.area.x + exit.area.w / 2 : exit.x),
                        y: exit.promptY !== undefined ? exit.promptY : (exit.area ? exit.area.y + exit.area.h / 2 + 10 : exit.y - 70),
                    };
                    this.interactableExit = null;
                    break;
                }
                this.interactableExit = exit;
                this.promptText = exit.label;
                break;
            }
        }

        // Update dos itens de missão no mundo + detecção de coleta ([E]).
        for (const wi of this.worldItems) {
            wi.update(dt);
        }
        if (this._questFlashT > 0) {
            this._questFlashT -= dt;
            if (this._questFlashT <= 0) {
                this._questFlashT = 0;
                this._questFlashId = null;
            }
        }
        this.interactableMissionItem = null;
        if (!this.player.isDead) {
            for (const wi of this.worldItems) {
                if (wi.collected) continue;
                if (wi.isPlayerNear(this.player)) {
                    this.interactableMissionItem = wi;
                    break;
                }
            }
        }

        this.interactableMissionShip = false;
        if (this.currentMapId === MAP_IDS.MARS_SURFACE && gameState.isMissionComplete() && !this.player.isDead) {
            const ship = this.currentMap.obstacles.find((obstacle) => obstacle.id === 'mission-spaceship');
            if (ship) {
                this.interactableMissionShip = Math.hypot(
                    this.player.x - (ship.x + ship.w / 2),
                    this.player.y - (ship.y + ship.h)
                ) <= 150;
            }
        }

        // Update Floating coin texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y += ft.vy * dt;
            ft.life -= dt;
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }

        // Update Camera
        this.camera.follow(this.player.x, this.player.y);
        this.camera.update();

        // Update Map & Dust
        this.mapRenderer.update(dt);

        // Update Bullets
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.update(dt);
            if (!bullet.isAlive) {
                this._spawnHitSparks(bullet.x, bullet.y);
                this.bullets.splice(i, 1);
                continue;
            }

            const hr = bullet.hitRadius ?? 4;
            const bRect = { x: bullet.x - hr, y: bullet.y - hr, w: hr * 2, h: hr * 2 };
            let consumed = false;

            // Bullets stop against solid obstacles (walls, rocks, towers)
            for (const o of this.currentMap.obstacles) {
                if (obstacleCollisionRects(o).some((cr) => rectsOverlap(cr, bRect))) {
                    consumed = true;
                    break;
                }
            }

            // Bullets damage valid targets based on team alignment
            if (!consumed) {
                for (const actor of this.actors) {
                    if (actor.isDead) continue;
                    const aRect = {
                        x: actor.x - actor.colliderHalfW,
                        y: actor.y - actor.colliderHalfH,
                        w: actor.colliderHalfW * 2,
                        h: actor.colliderHalfH * 2
                    };
                    if (rectsOverlap(aRect, bRect)) {
                        // Projétil ignora a própria hitbox (sem consumir a bala)
                        if (actor === bullet.owner) continue;
                        if (this._bulletCanDamage(bullet, actor.team, actor)) {
                            actor.takeDamage(bullet.damage, bullet.x, bullet.y);
                            if (actor.isDead) {
                                if (!actor._coinAwarded && actor.team === 'enemy') {
                                    actor._coinAwarded = true;
                                    const reward = actor.name === 'GOLEM' ? 5 : (actor.name?.includes('SPEARMAN') ? 4 : 3);
                                    this._awardEnemyCoins(actor.x, actor.y, reward);
                                }

                                // Upgrade: movespeed_up (ao derrotar o NPC inimigo Space Lizard / Ocstronaut)
                                if (!gameState.hasUpgrade('movespeed_up') &&
                                    (actor.isEnemyNpc || actor === this._enemyNpcActor || (actor instanceof CharacterActor && (actor.role === ActorRole.ENEMY || actor.team === 'enemy')))) {
                                    this.unlockUpgrade('movespeed_up');
                                }
                            }
                        }
                        consumed = true;
                        break;
                    }
                }
            }

            // Boss Necromancer também é alvo válido das balas do jogador.
            if (!consumed && this.necromancerBoss) {
                const b = this.necromancerBoss;
                if (!b.isDead) {
                    const bRectBoss = {
                        x: b.x - b.colliderHalfW,
                        y: b.y - b.colliderHalfH,
                        w: b.colliderHalfW * 2,
                        h: b.colliderHalfH * 2
                    };
                    if (rectsOverlap(bRectBoss, bRect)) {
                        if (b !== bullet.owner) {
                            if (this._bulletCanDamage(bullet, 'enemy', b)) {
                                b.takeDamage(bullet.damage, bullet.x, bullet.y);
                                if (b.isDead && !b._coinAwarded) {
                                    b._coinAwarded = true;
                                    this._awardEnemyCoins(b.x, b.y, 30);
                                }
                            }
                            consumed = true;
                        }
                    }
                }
            }

            // Boss Skeleton_Axe do Núcleo também é alvo válido das balas.
            if (!consumed && this.skeletonAxeBoss) {
                const ab = this.skeletonAxeBoss;
                if (!ab.isDead) {
                    // Usa a hitHalfW (largura de acerto) quando definida — o
                    // corpo do guardião é maior que o collider de movimento.
                    const abHalfW = ab.hitHalfW || ab.colliderHalfW;
                    const abRectBoss = {
                        x: ab.x - abHalfW,
                        y: ab.y - ab.colliderHalfH,
                        w: abHalfW * 2,
                        h: ab.colliderHalfH * 2
                    };
                    if (rectsOverlap(abRectBoss, bRect)) {
                        if (ab !== bullet.owner) {
                            if (this._bulletCanDamage(bullet, 'enemy', ab)) {
                                ab.takeDamage(bullet.damage, bullet.x, bullet.y);
                                if (ab.isDead && !ab._coinAwarded) {
                                    ab._coinAwarded = true;
                                    this._awardEnemyCoins(ab.x, ab.y, 30);
                                }
                            }
                            consumed = true;
                        }
                    }
                }
            }

            if (!consumed && !this.player.isDead) {
                const p = this.player;
                const pRect = {
                    x: p.x - p.colliderHalfW,
                    y: p.y - p.colliderHalfH,
                    w: p.colliderHalfW * 2,
                    h: p.colliderHalfH * 2
                };
                if (rectsOverlap(pRect, bRect)) {
                    // Projétil do próprio jogador não colide e não é consumido
                    // pela própria hitbox (tiro para sul sai limpo).
                    if (bullet.owner !== p) {
                        if (this._bulletCanDamage(bullet, 'player', p)) {
                            p.takeDamage(bullet.damage, bullet.x, bullet.y);
                        }
                        consumed = true;
                    }
                }
            }

            if (consumed) {
                this._spawnHitSparks(bullet.x, bullet.y);
                this.bullets.splice(i, 1);
            }
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    render() {
        const ctx = this.ctx;
        ctx.imageSmoothingEnabled = false;

        // Clear canvas
        ctx.fillStyle = '#05050b';
        ctx.fillRect(0, 0, this.width, this.height);

        // 1. Render Martian Map and Terrain
        this.mapRenderer.render(ctx, this.camera);

        // 1.5 Castle collision debug overlay (red/blue/green/yellow, see above)
        this._renderCollisionDebug(ctx);

        // 1.6 Efeitos de chão do boss (unholy ground, raio/explosão) abaixo dos NPCs
        this._renderNecromancerEffects(ctx);

        // 1.7 Among Us easter egg (após mapa/deco, antes dos NPCs)
        if (this.amongUsEasterEgg) {
            this.amongUsEasterEgg.render(ctx, this.camera);
        }

        // 2. Render non-player characters (NPCs / enemies / skeletons / reapers)
        for (const actor of this.actors) {
            actor.render(ctx, this.camera);
        }

        // 2.5 Catacomb skeleton spawn debug overlay (ponto + collider + ids)
        this._renderSkeletonAxeDebug(ctx);
        this._renderNecromancerDebug(ctx);

        // 2.8 Boss Necromancer por cima de Reapers/atores, antes dos projéteis
        if (this.necromancerBoss) {
            this.necromancerBoss.render(ctx, this.camera);
        }

        // 2.9 Boss Skeleton_Axe do Núcleo (mesma camada do Necromancer)
        if (this.skeletonAxeBoss) {
            this.skeletonAxeBoss.render(ctx, this.camera);
        }

        // 3. Render Bullets
        for (const bullet of this.bullets) {
            bullet.render(ctx, this.camera);
        }

        // 5. Render Player
        this.player.render(ctx, this.camera);

        // 5.5 Render Particles (por cima do jogador)
        for (const p of this.particles) {
            const screen = this.camera.worldToScreen(p.x, p.y);
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(screen.x), Math.round(screen.y), p.size, p.size);
        }

        // 5.55 Itens de missão no mundo (peças da nave saltitando)
        for (const wi of this.worldItems) {
            if (wi.collected) continue;
            wi.render(ctx, this.camera);
        }

        // 5.6 Render Floating coin texts (+🪙)
        for (const ft of this.floatingTexts) {
            const screen = this.camera.worldToScreen(ft.x, ft.y);
            const alpha = Math.min(1, ft.life / 0.35);
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
            ctx.font = '9px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffd440';
            ctx.shadowColor = '#000000';
            ctx.shadowBlur = 4;
            ctx.fillText(ft.text, screen.x, screen.y);
            ctx.restore();
        }

        // 6. Render Martian Dust Weather
        this.mapRenderer.renderAtmosphericDust(ctx, this.width, this.height);

        // 6.5 Night tint + transition flash (below the HUD so it stays readable)
        this._renderDayNightOverlay(ctx);

        // 7. Render Sci-Fi HUD
        this._renderHUD(ctx);

        // 7.2 Barra do boss Necromancer (Dark Souls no rodapé, acima dos controles)
        this._renderBossBar(ctx);

        // 7.5 Temporary "NOITE N" banner on top of everything
        this._renderNightBanner(ctx);

        // 8. Render Aim Crosshair
        this._renderCrosshair(ctx);

        // 9. Mensagens centrais estilo Dark Souls (VOCÊ MORREU / vitórias)
        if (this._soulsMessage) {
            this._renderSoulsMessage(ctx);
        }

        // 10. Render Map Transition Prompt ([E]) when near a doorway
        if (this.interactableExit && this.mapTransitionCooldown <= 0) {
            this._renderExitPrompt(ctx, this.interactableExit);
        }

        // 10.1. Aviso de porta bloqueada por boss (Sala do Rei / Núcleo) —
        // sem o [E] de interação até o chefe ser derrotado.
        if (this.lockedExitPrompt && this.mapTransitionCooldown <= 0) {
            this._renderLockedExitPrompt(ctx, this.lockedExitPrompt);
        }

        // 10.5. Render Shop Prompt ([E]) when near the Ally NPC on surface
        if (this.interactableShop && !isShopOpen() && this.mapTransitionCooldown <= 0) {
            this._renderShopPrompt(ctx, this.interactableShop);
        }

        // 10.6. Render pop-up de coleta do item de missão ([E] + nome + descrição)
        if (this.interactableMissionItem && !this.player.isDead && this.mapTransitionCooldown <= 0) {
            this._renderMissionItemPrompt(ctx, this.interactableMissionItem);
        }
        if (this.interactableMissionShip && !this.player.isDead && this.mapTransitionCooldown <= 0) {
            this._renderMissionShipPrompt(ctx);
        }
        if (this._shipRepairFade) {
            const half = this._shipRepairFade.duration / 2;
            const progress = this._shipRepairFade.elapsed;
            const alpha = progress < half ? progress / half : 1 - (progress - half) / half;
            ctx.save();
            ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, Math.min(1, alpha))})`;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.restore();
        }
    }

    _renderMissionShipPrompt(ctx) {
        const ship = this.currentMap.obstacles.find((obstacle) => obstacle.id === 'mission-spaceship');
        if (!ship) return;
        const screen = this.camera.worldToScreen(ship.x + ship.w / 2, ship.y - 8);
        const text = gameState.spaceshipRepaired ? '[E] CONCLUA A MISSÃO' : '[E] CONSERTE A NAVE';
        ctx.save();
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        const textW = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(5, 5, 11, 0.92)';
        ctx.fillRect(screen.x - textW / 2 - 8, screen.y - 10, textW + 16, 20);
        ctx.strokeStyle = '#7fe0a0';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(screen.x - textW / 2 - 8, screen.y - 10, textW + 16, 20);
        ctx.fillStyle = '#7fe0a0';
        ctx.fillText(text, screen.x, screen.y + 3);
        ctx.restore();
    }

    _renderShopPrompt(ctx, ally) {
        const screen = this.camera.worldToScreen(ally.x, ally.y - (ally.renderSize || 64) / 2 - 14);
        const text = '[E] ABRIR LOJA';

        ctx.save();
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        const textW = ctx.measureText(text).width;

        ctx.fillStyle = 'rgba(5, 5, 11, 0.9)';
        ctx.fillRect(screen.x - textW / 2 - 8, screen.y - 8, textW + 16, 18);
        ctx.strokeStyle = '#ffd440';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(screen.x - textW / 2 - 8, screen.y - 8, textW + 16, 18);

        ctx.fillStyle = '#ffd440';
        ctx.fillText(text, screen.x, screen.y + 4);
        ctx.restore();
    }

    // Pop-up próximo ao item de missão quando o jogador está ao alcance:
    // mostra "[E] COLETAR", o NOME e a DESCRIÇÃO da peça.
    _renderMissionItemPrompt(ctx, item) {
        const def = item.def;
        if (!def) return;
        const screen = this.camera.worldToScreen(item.x, item.y);

        ctx.save();
        ctx.textAlign = 'center';

        ctx.font = '8px "Press Start 2P", monospace';
        const promptW = ctx.measureText('[E] COLETAR').width;

        ctx.font = '8px "Press Start 2P", monospace';
        const descLines = this._wrapHudText(ctx, def.description.toUpperCase(), 250);
        const descW = Math.max(...descLines.map((l) => ctx.measureText(l).width));
        const nameW = ctx.measureText(def.name.toUpperCase()).width;

        const boxW = Math.max(promptW, nameW, descW) + 24;
        const boxH = 14 + 16 + descLines.length * 13 + 4;
        const bx = Math.round(screen.x - boxW / 2);
        const by = Math.round(screen.y - 74 - descLines.length * 12);

        // Painel
        ctx.fillStyle = 'rgba(5, 5, 11, 0.92)';
        ctx.fillRect(bx, by, boxW, boxH);
        ctx.strokeStyle = '#ffd440';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);

        // Linha 1 — ação
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffd440';
        ctx.fillText('[E] COLETAR', bx + boxW / 2, by + 14);

        // Linha 2 — nome
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        ctx.fillText(def.name.toUpperCase(), bx + boxW / 2, by + 33);

        // Linhas 3+ — descrição (quebrada)
        ctx.fillStyle = '#c5975b';
        descLines.forEach((line, i) => {
            ctx.fillText(line, bx + boxW / 2, by + 46 + i * 13);
        });

        ctx.restore();
    }

    _renderExitPrompt(ctx, exit) {
        // When the exit defines a rectangular trigger area, anchor the prompt
        // text at the center of that area (shifted slightly down) so it appears
        // right over the interaction zone — closer to the actual door. Exits
        // without an area keep the legacy position (centered above the exit).
        const promptX = exit.promptX !== undefined ? exit.promptX : (exit.area ? exit.area.x + exit.area.w / 2 : exit.x);
        const promptY = exit.promptY !== undefined ? exit.promptY : (exit.area ? exit.area.y + exit.area.h / 2 + 10 : exit.y - 70);
        const screen = this.camera.worldToScreen(promptX, promptY);
        const label = exit.label || 'ENTRAR';

        ctx.save();
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        const text = `[E] ${label}`;
        const textW = ctx.measureText(text).width;

        ctx.fillStyle = 'rgba(5, 5, 11, 0.85)';
        ctx.fillRect(screen.x - textW / 2 - 8, screen.y - 8, textW + 16, 16);
        ctx.strokeStyle = '#e07228';
        ctx.lineWidth = 1;
        ctx.strokeRect(screen.x - textW / 2 - 8, screen.y - 8, textW + 16, 16);

        ctx.fillStyle = '#f6c885';
        ctx.fillText(text, screen.x, screen.y + 3);
        ctx.restore();
    }

    // Aviso da porta travada numa arena de boss: mostra "SAÍDA BLOQUEADA"
    // + dica sem disponibilizar a interação [E] de troca de mapa.
    _renderLockedExitPrompt(ctx, prompt) {
        const screen = this.camera.worldToScreen(prompt.x, prompt.y);
        const text = 'SAIDA BLOQUEADA';
        const hint = 'DERROTE O CHEFE!';

        ctx.save();
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        const textW = ctx.measureText(text).width;
        const hintW = ctx.measureText(hint).width;
        const boxW = Math.max(textW, hintW) + 16;
        const boxH = 30;

        const bx = Math.round(screen.x - boxW / 2);
        const by = Math.round(screen.y - 8);

        ctx.fillStyle = 'rgba(5, 5, 11, 0.9)';
        ctx.fillRect(bx, by, boxW, boxH);
        ctx.strokeStyle = '#e62424';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, boxH - 1);

        ctx.fillStyle = '#e62424';
        ctx.fillText(text, screen.x, by + 12);
        ctx.fillStyle = '#f6c885';
        ctx.fillText(hint, screen.x, by + 26);
        ctx.restore();
    }

    // Paints the collision geometry of the current map over the art, so the
    // sprite-castle rooms can be reviewed precisely against their drawing.
    _renderCollisionDebug(ctx) {
        if (!SHOW_CASTLE_COLLISION_DEBUG) return;
        if (!this.currentMap) return;
        const off = this.camera.getRenderOffset();

        // Solid obstacles (walls, pillars, blocked background) — red. Naves com
        // `collisionBoxes` mostram cada caixa do contorno (não o rect de desenho).
        ctx.fillStyle = 'rgba(255, 60, 60, 0.55)';
        for (const o of this.currentMap.obstacles || []) {
            for (const cr of obstacleCollisionRects(o)) {
                ctx.fillRect(
                    Math.round(cr.x + off.x),
                    Math.round(cr.y + off.y),
                    Math.round(cr.w),
                    Math.round(cr.h)
                );
            }
        }

        // Door / interaction areas — blue.
        ctx.fillStyle = 'rgba(60, 130, 255, 0.55)';
        for (const exit of this.currentMap.exits || []) {
            if (!exit.area) continue;
            ctx.fillRect(
                Math.round(exit.area.x + off.x),
                Math.round(exit.area.y + off.y),
                Math.round(exit.area.w),
                Math.round(exit.area.h)
            );
        }

        // Spawn points — bright green squares.
        ctx.fillStyle = '#00ff00';
        for (const s of Object.values(this.currentMap.spawnPoints || {})) {
            ctx.fillRect(Math.round(s.x + off.x - 6), Math.round(s.y + off.y - 6), 12, 12);
        }

        // Player collider box — yellow outline.
        const p = this.player;
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            Math.round(p.x - p.colliderHalfW + off.x) + 0.5,
            Math.round(p.y - p.colliderHalfH + off.y) + 0.5,
            p.colliderHalfW * 2,
            p.colliderHalfH * 2
        );
    }

    // Debug overlay for the Catacombs Skeleton_Axe (see DEBUG_CATACOMBS_SKELETONS).
    // Paints each spawn point (axe in green, spearman in cyan) with its id,
    // local coordinates and current map, plus the collider box of every live
    // skeleton.
    _renderSkeletonAxeDebug(ctx) {
        if (!DEBUG_CATACOMBS_SKELETONS) return;
        if (this.currentMapId !== MAP_IDS.MARS_CATACOMBS) return;

        const off = this.camera.getRenderOffset();

        ctx.font = '8px "Press Start 2P", monospace';

        CATACOMBS_SKELETON_WARRIOR_SPAWNS.forEach((spawn, i) => {
            const sx = Math.round(spawn.x + off.x);
            const sy = Math.round(spawn.y + off.y);

            // Spawn marker — bright green cross on the feet position.
            ctx.fillStyle = '#00ff66';
            ctx.fillRect(sx - 5, sy - 1, 10, 2);
            ctx.fillRect(sx - 1, sy - 5, 2, 10);

            // Text block — id, current map and LOCAL coordinates.
            ctx.textAlign = 'center';
            ctx.fillStyle = '#00ff66';
            ctx.fillText(`Skeleton_Warrior_${i + 1}`, sx, sy - 12);
            ctx.fillText(`MAP: ${this.currentMapId}`, sx, sy + 18);
            ctx.fillText(`LOCAL: ${spawn.x}, ${spawn.y}`, sx, sy + 28);
        });

        CATACOMBS_SKELETON_ARCHER_SPAWNS.forEach((spawn, i) => {
            const sx = Math.round(spawn.x + off.x);
            const sy = Math.round(spawn.y + off.y);

            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(sx - 5, sy - 1, 10, 2);
            ctx.fillRect(sx - 1, sy - 5, 2, 10);

            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffcc00';
            ctx.fillText(`Skeleton_Archer_${i + 1}`, sx, sy - 12);
            ctx.fillText(`MAP: ${this.currentMapId}`, sx, sy + 18);
            ctx.fillText(`LOCAL: ${spawn.x}, ${spawn.y}`, sx, sy + 28);
        });

        CATACOMBS_SKELETON_SPEARMAN_SPAWNS.forEach((spawn, i) => {
            const sx = Math.round(spawn.x + off.x);
            const sy = Math.round(spawn.y + off.y);

            ctx.fillStyle = '#00ccff';
            ctx.fillRect(sx - 5, sy - 1, 10, 2);
            ctx.fillRect(sx - 1, sy - 5, 2, 10);

            ctx.textAlign = 'center';
            ctx.fillStyle = '#00ccff';
            ctx.fillText(`Skeleton_Spearman_${i + 1}`, sx, sy - 12);
            ctx.fillText(`MAP: ${this.currentMapId}`, sx, sy + 18);
            ctx.fillText(`LOCAL: ${spawn.x}, ${spawn.y}`, sx, sy + 28);
        });

        // Collider box of every live skeleton — yellow outline.
        for (const s of this.skeletons) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                Math.round(s.x - s.colliderHalfW + off.x) + 0.5,
                Math.round(s.y - s.colliderHalfH + off.y) + 0.5,
                s.colliderHalfW * 2,
                s.colliderHalfH * 2
            );
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(
                Math.round(s.x + off.x - 2),
                Math.round(s.y + off.y - 2),
                4,
                4
            );
        }
    }

    _renderHUD(ctx) {
        ctx.save();

        // TOP-LEFT: Astronaut Vital Telemetry Panel
        const hudX = 24;
        const hudY = 24;
        const panelW = 340;
        const panelH = 150;

        // Frame backing
        ctx.fillStyle = 'rgba(10, 8, 14, 0.85)';
        ctx.fillRect(hudX, hudY, panelW, panelH);
        ctx.strokeStyle = '#e07228';
        ctx.lineWidth = 2;
        ctx.strokeRect(hudX + 0.5, hudY + 0.5, panelW - 1, panelH - 1);

        // HUD Bevel Accent
        ctx.fillStyle = '#e07228';
        ctx.fillRect(hudX, hudY, 12, 4);
        ctx.fillRect(hudX + panelW - 12, hudY, 12, 4);

        // Name & Mission Title
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        ctx.textAlign = 'left';
        ctx.fillText(`OPERADOR: ${this.player.name}`, hudX + 16, hudY + 26);

        // VITALIDADE Label (above the bar)
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#e07228';
        ctx.fillText('VITALIDADE', hudX + 16, hudY + 46);

        // HP Bar
        const barX = hudX + 16;
        const barY = hudY + 56;
        const barW = 200;
        const barH = 18;

        ctx.fillStyle = '#1f0d0b';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.strokeStyle = '#8f3419';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        // HP Bar Fill
        const hpPercent = Math.max(0, this.player.hp / this.player.maxHp);
        const fillW = Math.round((barW - 4) * hpPercent);
        if (fillW > 0) {
            ctx.fillStyle = hpPercent > 0.3 ? '#d85a22' : '#e62424';
            ctx.fillRect(barX + 2, barY + 2, fillW, barH - 4);
        }

        // HP Text — positioned to the right of bar, vertically centered
        ctx.fillStyle = '#f6c885';
        ctx.fillText(`${Math.round(this.player.hp)} / ${this.player.maxHp}`, barX + barW + 12, barY + 13);

        // ENERGIA Label (munição dos tiros) — logo abaixo da vitalidade
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#e07228';
        ctx.fillText('ENERGIA', hudX + 16, hudY + 88);

        // Energy Bar — mais fina que a vitalidade, verde clara
        const eBarW = barW;
        const eBarH = 7;
        const eBarX = barX;
        const eBarY = hudY + 97;

        ctx.fillStyle = '#0b1a10';
        ctx.fillRect(eBarX, eBarY, eBarW, eBarH);
        ctx.strokeStyle = '#1f7a34';
        ctx.lineWidth = 1;
        ctx.strokeRect(eBarX, eBarY, eBarW, eBarH);

        const energyPercent = Math.max(0, this.player.energy / this.player.maxEnergy);
        const eFillW = Math.round((eBarW - 4) * energyPercent);
        if (eFillW > 0) {
            ctx.fillStyle = '#3ee76b';
            ctx.fillRect(eBarX + 2, eBarY + 2, eFillW, eBarH - 4);
        }

        // Energy Text — to the right of the thin bar
        ctx.fillStyle = '#a9f3bc';
        ctx.fillText(`${Math.round(this.player.energy)} / ${this.player.maxEnergy}`, eBarX + eBarW + 12, eBarY + 6);

        // Telemetry Subtext
        ctx.fillStyle = '#c5975b';
        const areaText = `AREA: ${MAP_LABELS[this.currentMapId] || this.currentMapId.toUpperCase()}`;
        const stateText = `ESTADO: ${this.player.state} | DIR: ${this.player.direction.toUpperCase()}`;
        ctx.fillText(areaText, hudX + 16, hudY + 122);
        ctx.fillText(stateText, hudX + 16, hudY + 139);

        // DAY / NIGHT INDICATOR — directly below the vitals panel so it never
        // covers the health bar
        this._renderDayNightIndicator(ctx, hudX, hudY + panelH + 10);
        this._renderUpgradeIndicators(ctx, hudX + 168 + 8, hudY + panelH + 10);

        // Animação de item consumido "se quebrando" ao lado da HUD de upgrades
        this._renderItemFx(ctx);

        // TOP-RIGHT: Coordinates & Moedas (mesma largura da HUD da missão)
        const coordsW = 244;
        const coordsH = 48;
        const trX = this.width - 24 - coordsW;
        const trY = 24;
        ctx.fillStyle = 'rgba(10, 8, 14, 0.85)';
        ctx.fillRect(trX, trY, coordsW, coordsH);
        ctx.strokeStyle = '#e07228';
        ctx.lineWidth = 2;
        ctx.strokeRect(trX + 0.5, trY + 0.5, coordsW - 1, coordsH - 1);

        const posX = Math.round(this.player.x);
        const posY = Math.round(this.player.y);
        const xLabel = `X: ${posX.toString().padStart(5, '0')}`;
        const yLabel = `Y: ${posY.toString().padStart(5, '0')}`;

        // X e Y lado a lado (mesma linha), número colado no rótulo; o grupo Y
        // fica alinhado à direita para nunca sobrepor o X.
        ctx.textAlign = 'left';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#ffab5e';
        ctx.fillText(xLabel, trX + 14, trY + 17);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText(yLabel, trX + coordsW - 14, trY + 17);
        ctx.textAlign = 'left';

        ctx.fillStyle = '#ffd440';
        ctx.fillText(`MOEDAS:  🪙 ${gameState.coins ?? 0}`, trX + 14, trY + 38);

        // Indicador da missão principal — logo abaixo da HUD de coordenadas
        this._renderMissionHUD(ctx, trX, trY + coordsH + 10);

        // BOTTOM: Sci-Fi Controls Reference Bar
        const barBottomY = this.height - 38;
        ctx.fillStyle = 'rgba(5, 5, 11, 0.85)';
        ctx.fillRect(0, barBottomY, this.width, 38);
        ctx.strokeStyle = '#4d1d15';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, barBottomY, this.width, 1);

        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        ctx.textAlign = 'center';
        ctx.fillText(
            '[WASD] Mover  [SHIFT] Correr  [Q] DASH  [L-CLICK] Atirar  [R-CLICK] Socar  [ESPAÇO] Pular  [F e P] EMOTES  [1/2/3] Itens  [ESC] Menu',
            this.width / 2,
            barBottomY + 23
        );

        // Mensagem transitória ao consumir item (estilo Dark Souls)
        if (this.hudMessageTimer > 0 && this.hudMessage) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, this.hudMessageTimer);
            ctx.font = '8px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#f6c885';
            ctx.fillText(this.hudMessage, this.width / 2, barBottomY - 86);
            ctx.restore();
        }

        // HOTBAR DE ITENS (Dark Souls) — canto inferior esquerdo
        this._renderItemHotbar(ctx, barBottomY);

        ctx.restore();
    }

    /* ── Missão principal: "Conserte a nave e saia de Duna" ──
     * Log de quests NO canto superior direito, logo abaixo do painel de
     * coordenadas. Mostra UMA quest por vez (desbloqueio sequencial):
     * Motor da Nave → Combustível → Estabilizadores → CONSERTE A NAVE.
     * Ao coletar a peça, um "risco verde + ✓" cruza o cartão compacto e a
     * próxima quest assume o lugar. "PECAS" maior, colado à direita.      */
    _renderMissionHUD(ctx, x, y) {
        const collected = Array.isArray(gameState.missionCollected) ? gameState.missionCollected : [];
        const hasAll = gameState.isMissionComplete();

        // ── Sistema de desbloqueio: qual quest está ativa agora? ──
        // Enquanto o flash dura, mostramos a quest que acabou de ser coletada
        // (risco verde + ✓); ao terminar, a próxima quest (ou a final) assume.
        const flashDef = this._questFlashId ? SPACESHIP_ITEM_DEFS[this._questFlashId] : null;
        const nextId = hasAll ? null : MISSION_ITEM_ORDER.find((id) => !collected.includes(id));
        const activeDef = flashDef || (nextId ? SPACESHIP_ITEM_DEFS[nextId] : null);
        const finalQuest = !flashDef && !nextId;

        // ── Geometria compacta do painel (borda direita = da HUD de coordenadas) ──
        const rightEdge = x + 244;
        const panelW = 244;
        const panelX = rightEdge - panelW;
        const headerH = 40;
        const bodyH = 120;
        const panelH = headerH + bodyH;

        // Título de cada quest ganha uma cor própria (mais fácil de ler).
        const questColors = {
            motor: '#ffab5e',
            meio: '#7dd3fc',
            ponta: '#c4b5fd',
        };

        const flashOn = Boolean(this._questFlashId);
        const flashProgress = flashOn ? 1 - Math.max(0, this._questFlashT / QUEST_FLASH_DURATION) : 0;

        ctx.save();

        // ── Frame (borda verde pulsante durante o flash) ──
        ctx.fillStyle = 'rgba(10, 8, 14, 0.92)';
        ctx.fillRect(panelX, y, panelW, panelH);
        ctx.strokeStyle = flashOn ? `rgba(74, 222, 128, ${0.5 + 0.5 * flashProgress})` : '#e07228';
        ctx.lineWidth = flashOn ? 2.5 : 2;
        ctx.strokeRect(panelX + 0.5, y + 0.5, panelW - 1, panelH - 1);
        ctx.fillStyle = flashOn ? '#4ade80' : '#e07228';
        ctx.fillRect(panelX, y, 12, 4);
        ctx.fillRect(panelX + panelW - 12, y, 12, 4);

        // ── Cabeçalho: título + subtítulo (sem o ícone principal_mission) ──
        const hiY = y + 6;
        const hx = panelX + 10;
        ctx.textAlign = 'left';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        ctx.fillText('CONSERTE A NAVE', hx, hiY + 11);
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillStyle = '#9a7ea8';
        ctx.fillText('E SAIA DE DUNA', hx, hiY + 24);

        // "PECAS", encostado na margem direita
        ctx.textAlign = 'right';
        ctx.font = '9px "Press Start 2P", monospace';
        ctx.fillStyle = hasAll ? '#4ade80' : '#e07228';
        ctx.fillText('PECAS', rightEdge - 6, hiY + 11);
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        ctx.fillText(`${collected.length}/3`, rightEdge - 6, hiY + 26);
        ctx.textAlign = 'left';

        // Divisor
        ctx.strokeStyle = '#4d1d15';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(panelX + 6, y + headerH - 2);
        ctx.lineTo(rightEdge - 6, y + headerH - 2);
        ctx.stroke();

        // ── Corpo: cartão da quest ativa ──
        const bodyTop = y + headerH;
        if (finalQuest) {
            this._renderFinalQuestCard(ctx, panelX, bodyTop, panelW, bodyH);
        } else if (activeDef) {
            this._renderQuestCard(ctx, panelX, bodyTop, panelW, bodyH, activeDef, {
                collected: flashOn,
                flashProgress: flashOn ? flashProgress : 1,
                accent: questColors[activeDef.id] || '#f6c885',
            });
        }

        ctx.restore();
    }

    // Cartão compacto de uma quest (sprite, título e descrição ampliados).
    // Quando `collected`, cruza um "risco verde" animado sobre o título e
    // desenha um certinho (✓) sobre o sprite antes do cartão sair.
    _renderQuestCard(ctx, px, py, panelW, panelH, def, opts) {
        const imgH = 62;
        const img = getMissionItemImage(def.id);
        const imgX = px + 10;
        const imgY = py + 10;

        ctx.save();
        ctx.textAlign = 'left';

        let imgW = 62;
        if (img && img.complete) {
            const ratio = img.naturalWidth / img.naturalHeight;
            imgW = Math.max(52, Math.min(62, Math.round(imgH * ratio)));
            ctx.globalAlpha = opts.collected ? 0.5 : 1;
            ctx.drawImage(img, imgX, imgY, imgW, imgH);
            ctx.globalAlpha = 1;
        } else {
            ctx.fillStyle = opts.collected ? '#4f7a5e' : '#e07228';
            ctx.fillRect(imgX, imgY, imgW, imgH);
        }

        const textX = imgX + imgW + 10;
        const textW = Math.max(80, (px + panelW - 10) - textX);

        // Título grande (cor própria da quest)
        ctx.font = '10px "Press Start 2P", monospace';
        ctx.fillStyle = opts.collected ? '#7fe0a0' : opts.accent;
        const title = def.name.toUpperCase();
        ctx.fillText(title, textX, py + 18);

        // Risco verde animado sobre o título (sweep esquerda → direita)
        if (opts.collected) {
            const titleW = ctx.measureText(title).width;
            const reach = opts.flashProgress < 1 ? opts.flashProgress : 1;
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(textX, py + 16);
            ctx.lineTo(textX + titleW * reach, py + 16);
            ctx.stroke();
        }

        // Descrição (até 4 linhas)
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = opts.collected ? '#7fd4a6' : '#c8a165';
        const descLines = this._wrapHudText(ctx, def.description.toUpperCase(), textW);
        descLines.slice(0, 4).forEach((line, i) => ctx.fillText(line, textX, py + 34 + i * 12));

        // Certinho (✓) com pop sobre o canto do sprite
        if (opts.collected) {
            const t = opts.flashProgress;
            const badge = 22;
            const bx = imgX + imgW - 10;
            const by = imgY - 6;
            const scale = 0.6 + 0.5 * t;
            ctx.save();
            ctx.translate(bx + badge / 2, by + badge / 2);
            ctx.scale(scale, scale);
            ctx.fillStyle = '#4ade80';
            ctx.fillRect(-badge / 2, -badge / 2, badge, badge);
            ctx.strokeStyle = '#052e16';
            ctx.lineWidth = 2;
            ctx.strokeRect(-badge / 2, -badge / 2, badge, badge);
            ctx.fillStyle = '#04210e';
            ctx.font = '14px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('✓', 0, 5);
            ctx.restore();
        }

        // Objetivo / dica de localização (rodapé em LARGURA TOTAL — nunca corta
        // coordenadas como "Y02103" da quest Meio da Nave)
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillStyle = opts.collected ? '#7fd4a6' : '#e07228';
        const hintLines = this._wrapHudText(ctx, `>> ${def.hint.toUpperCase()}`, panelW - 20);
        hintLines.slice(0, 2).forEach((line, i) => ctx.fillText(line, px + 10, py + 92 + i * 11));

        ctx.restore();
    }

    // Cartão final do log: depois das 3 peças aparece "CONSERTE A NAVE"
    // (layout só com texto — sem o ícone principal_mission).
    _renderFinalQuestCard(ctx, px, py, panelW, panelH) {
        const cx = px + panelW / 2;
        const textW = panelW - 24;

        ctx.save();
        ctx.textAlign = 'center';

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        ctx.fillText('CONSERTE', cx, py + 20);
        ctx.fillText('A NAVE', cx, py + 36);

        // Divisor decorativo
        ctx.strokeStyle = '#e07228';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 30, py + 44);
        ctx.lineTo(cx + 30, py + 44);
        ctx.stroke();

        ctx.font = '8px "Press Start 2P", monospace';
        ctx.fillStyle = '#c8a165';
        const lines = this._wrapHudText(
            ctx,
            'TODAS AS PEÇAS REUNIDAS. VÁ ATÉ A NAVE EM DUNA E INSTALE OS COMPONENTES.',
            textW
        );
        lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, cx, py + 58 + i * 12));

        if (gameState.spaceshipRepaired) {
            ctx.font = '9px "Press Start 2P", monospace';
            ctx.fillStyle = '#4ade80';
            ctx.fillText('✓ NAVE CONSERTADA!', cx, py + 106);
        }

        ctx.restore();
    }

    _renderItemHotbar(ctx, barBottomY) {
        const slotSize = 46;
        const slotGap = 8;
        const startX = 24;
        const startY = barBottomY - slotSize - 16;
        const paletteByItem = {
            'cura_alienigena': { border: '#22c55e', glyph: '#86efac' },
            'energia_duna': { border: '#ef4444', glyph: '#fca5a5' },
            'cadencia_frenetica': { border: '#eab308', glyph: '#f9a8d4' },
            'necro_ally_help': { border: '#4dd2ff', glyph: '#d6f4ff' }
        };

        for (let slot = 1; slot <= 3; slot++) {
            const bx = startX + (slot - 1) * (slotSize + slotGap);
            const item = getSlotItem(slot);
            const owned = !!item;
            const palette = (item && paletteByItem[item.id]) || { border: '#888', glyph: '#999' };
            const cooldown = owned ? gameState.getItemCooldown(item.id) : 0;
            const onCooldown = cooldown > 0;

            ctx.save();

            // Socket vazio/fundo
            ctx.fillStyle = 'rgba(10, 8, 14, 0.85)';
            ctx.fillRect(bx, startY, slotSize, slotSize);
            ctx.strokeStyle = owned ? palette.border : '#4d1d15';
            ctx.lineWidth = owned ? 1.5 : 1;
            ctx.strokeRect(bx + 0.5, startY + 0.5, slotSize - 1, slotSize - 1);

            // Número da tecla (canto superior)
            ctx.font = '7px "Press Start 2P", monospace';
            ctx.textAlign = 'left';
            ctx.fillStyle = owned && !onCooldown ? '#f6c885' : '#6b5a44';
            ctx.fillText(String(slot), bx + 6, startY + 14);

            if (owned && item) {
                // Durante a recarga o item fica apagado e mostra o tempo restante
                if (onCooldown) ctx.globalAlpha = 0.35;
                this._drawItemGlyph(ctx, bx, startY, slotSize, item, palette.glyph);

                ctx.globalAlpha = 1;

                if (onCooldown) {
                    ctx.fillStyle = 'rgba(10, 8, 14, 0.65)';
                    ctx.fillRect(bx + 2, startY + 2, slotSize - 4, slotSize - 4);
                    ctx.font = '8px "Press Start 2P", monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#f6c885';
                    ctx.fillText(`${Math.ceil(cooldown)}s`, bx + slotSize / 2, startY + slotSize / 2);
                }
            }

            ctx.restore();

            // Estoque de doses (compras): X/3 abaixo do socket, centralizado (cor branca)
            const ownedStacks = owned ? gameState.getItemPurchases(item.id) : 0;
            if (ownedStacks > 0) {
                ctx.font = '6px "Press Start 2P", monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'alphabetic';
                ctx.fillStyle = '#ffffff';
                ctx.fillText(`${ownedStacks}/3`, bx + slotSize / 2, startY + slotSize + 10);
            }
        }
    }

    // Desenha o ícone do item dentro do socket: usa o asset de sprite do item
    // (ícone estático) e, enquanto ele ainda não carrega, cai no desenho
    // vetorial/glifo de fallback.
    _drawItemGlyph(ctx, bx, by, size, item, color) {
        const icon = item ? this._itemFxIcons?.get(item.id) : null;
        if (icon && icon.complete && icon.naturalWidth > 0 && icon.naturalHeight > 0) {
            const pad = item.id === 'necro_ally_help' ? 10 : 3;
            const inner = size - pad * 2;
            const ratio = icon.naturalWidth / icon.naturalHeight;
            let iw = inner;
            let ih = inner;
            if (ratio > 1) ih = Math.round(inner / ratio);
            else iw = Math.round(inner * ratio);
            const ix = bx + Math.round((size - iw) / 2);
            const iy = by + Math.round((size - ih) / 2);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(icon, ix, iy, iw, ih);
            return;
        }

        const glyph = (item && item.sprite) || '?';
        const cx = bx + size / 2;
        const cy = by + size / 2 - 2;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        if (glyph === '✚') {
            const r = 11;
            ctx.fillRect(cx - 2, cy - r, 4, r * 2);
            ctx.fillRect(cx - r, cy - 2, r * 2, 4);
        } else if (glyph === '⚡') {
            ctx.beginPath();
            ctx.moveTo(cx + 2, cy - 10);
            ctx.lineTo(cx - 6, cy + 1);
            ctx.lineTo(cx - 1, cy + 1);
            ctx.lineTo(cx - 2, cy + 10);
            ctx.lineTo(cx + 6, cy - 3);
            ctx.lineTo(cx + 1, cy - 3);
            ctx.closePath();
            ctx.fill();
        } else {
            ctx.font = '13px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(glyph || '?', cx, cy + 1);
            ctx.textBaseline = 'alphabetic';
        }
    }

    _renderDayNightIndicator(ctx, x, y) {
        const w = 168;
        const h = 40;
        const isNight = this.dayNight.period === DAY_NIGHT_PERIOD.NIGHT;

        // Frame
        ctx.save();
        ctx.fillStyle = 'rgba(10, 8, 14, 0.85)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = isNight ? '#5f7fd8' : '#e07228';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

        // Icon (sun / moon), kept at its natural aspect ratio and pixelated
        const icon = this._dayNightIcons.cached.get(this.dayNight.period);
        const box = 26;
        const iconX = x + 12;
        const iconY = y + (h - box) / 2;
        if (icon && icon.complete && icon.naturalWidth > 0) {
            const ratio = icon.naturalWidth / icon.naturalHeight;
            const iw = Math.round(box * ratio);
            const ih = box;
            ctx.drawImage(icon, iconX + Math.round((box - iw) / 2), iconY, iw, ih);
        } else {
            ctx.fillStyle = isNight ? '#cdd6ff' : '#ffd46b';
            ctx.beginPath();
            ctx.arc(iconX + box / 2, iconY + box / 2, box / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Label + countdown MM:SS
        ctx.textAlign = 'left';
        ctx.font = '7px "Press Start 2P", monospace';
        ctx.fillStyle = isNight ? '#9fb4ff' : '#e07228';
        ctx.fillText(isNight ? `NOITE ${this.dayNight.nightCount}` : `DIA ${this.dayNight.dayCount}`, x + 48, y + 16);

        ctx.font = '12px "Press Start 2P", monospace';
        ctx.fillStyle = '#f6c885';
        ctx.fillText(formatDayNightTime(this.dayNight.getRemainingSeconds()), x + 48, y + 33);
        ctx.restore();
    }

    _renderUpgradeIndicators(ctx, startX, y) {
        const boxSize = 40;
        const gap = 8;
        const totalSlots = 3;
        const upgrades = gameState.upgrades || [];

        let hoveredTooltip = null;

        for (let i = 0; i < totalSlots; i++) {
            const bx = startX + i * (boxSize + gap);
            const by = y;
            const upgradeId = upgrades[i];

            ctx.save();

            // Background socket matching the sci-fi HUD aesthetic
            ctx.fillStyle = 'rgba(10, 8, 14, 0.85)';
            ctx.fillRect(bx, by, boxSize, boxSize);

            if (upgradeId) {
                // Active slot with upgrade
                let borderColor = '#e07228';
                let desc = '';
                if (upgradeId === 'damage_up') {
                    borderColor = '#ef4444';
                    desc = 'DANO: +20%';
                } else if (upgradeId === 'life_up') {
                    borderColor = '#22c55e';
                    desc = 'VIDA MÁX: +25 (130)';
                } else if (upgradeId === 'movespeed_up') {
                    borderColor = '#38bdf8';
                    desc = 'VELOCIDADE: +10% | ENERGIA: +30';
                }

                ctx.strokeStyle = borderColor;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(bx + 0.5, by + 0.5, boxSize - 1, boxSize - 1);

                // Draw upgrade icon image
                const icon = this._upgradeIcons?.get(upgradeId);
                if (icon && icon.complete && icon.naturalWidth > 0) {
                    const pad = 5;
                    const inner = boxSize - pad * 2;
                    const ratio = icon.naturalWidth / icon.naturalHeight;
                    let iw = inner;
                    let ih = inner;
                    if (ratio > 1) {
                        ih = Math.round(inner / ratio);
                    } else {
                        iw = Math.round(inner * ratio);
                    }
                    const ix = bx + Math.round((boxSize - iw) / 2);
                    const iy = by + Math.round((boxSize - ih) / 2);
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(icon, ix, iy, iw, ih);
                } else {
                    // Fallback visual icon while loading
                    ctx.fillStyle = borderColor;
                    ctx.font = '10px "Press Start 2P", monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const symbol = upgradeId === 'damage_up' ? '⚔' : (upgradeId === 'life_up' ? '❤' : '⚡');
                    ctx.fillText(symbol, bx + boxSize / 2, by + boxSize / 2);
                }

                // Check mouse hover for tooltip
                if (this.input) {
                    const mx = this.input.mouseX;
                    const my = this.input.mouseY;
                    if (mx >= bx && mx <= bx + boxSize && my >= by && my <= by + boxSize) {
                        hoveredTooltip = { x: bx + boxSize / 2, y: by - 8, text: desc, color: borderColor };
                    }
                }
            } else {
                // Empty placeholder slot
                ctx.strokeStyle = 'rgba(143, 52, 25, 0.35)';
                ctx.lineWidth = 1;
                ctx.strokeRect(bx + 0.5, by + 0.5, boxSize - 1, boxSize - 1);

                // Dim '+' socket indicator
                ctx.fillStyle = 'rgba(143, 52, 25, 0.25)';
                ctx.font = '10px "Press Start 2P", monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('+', bx + boxSize / 2, by + boxSize / 2);
            }

            ctx.restore();
        }

        // Render hover tooltip if hovering over an unlocked upgrade
        if (hoveredTooltip) {
            ctx.save();
            ctx.font = '7px "Press Start 2P", monospace';
            const tw = ctx.measureText(hoveredTooltip.text).width + 14;
            const th = 18;
            const tx = Math.max(10, hoveredTooltip.x - tw / 2);
            const ty = hoveredTooltip.y - th;

            ctx.fillStyle = 'rgba(10, 8, 14, 0.95)';
            ctx.fillRect(tx, ty, tw, th);
            ctx.strokeStyle = hoveredTooltip.color;
            ctx.lineWidth = 1;
            ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);

            ctx.fillStyle = '#f6c885';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(hoveredTooltip.text, tx + tw / 2, ty + th / 2);
            ctx.restore();
        }
    }

    _renderDayNightOverlay(ctx) {
        const alpha = 0.32 * this._nightBlend;
        if (alpha > 0.002) {
            ctx.save();
            ctx.fillStyle = `rgba(12, 16, 48, ${alpha.toFixed(3)})`;
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.restore();
        }

        if (this._nightFlashTimer > 0) {
            const a = 0.20 * (this._nightFlashTimer / 0.45);
            ctx.save();
            ctx.fillStyle = `rgba(200, 220, 255, ${a.toFixed(3)})`;
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.restore();
        }
    }

    _renderNightBanner(ctx) {
        if (this._nightBannerTimer <= 0) return;

        const t = this._nightBannerTimer;
        const alpha = Math.min(1, (3.0 - t) / 0.3, t / 0.6);
        if (alpha <= 0) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.textAlign = 'center';

        const text = this._nightBannerText;
        const isAllySpeech = text.startsWith('ALIADO:');
        const isNightStart = /^NOITE \d+$/.test(text);
        const isBottomMessage = isAllySpeech || isNightStart;
        const fontSize = isAllySpeech ? 10 : 20;
        const boxHeight = isAllySpeech ? 30 : 40;
        const boxY = isBottomMessage ? this.height - boxHeight - 48 : this.height / 2 - 70;
        const textY = boxY + boxHeight / 2 + fontSize * 0.35;

        ctx.font = `${fontSize}px "Press Start 2P", monospace`;
        const textW = ctx.measureText(text).width;

        ctx.fillStyle = 'rgba(5, 5, 18, 0.88)';
        ctx.fillRect(this.width / 2 - textW / 2 - 20, boxY, textW + 40, boxHeight);
        ctx.strokeStyle = isAllySpeech ? '#f6c885' : '#5f7fd8';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.width / 2 - textW / 2 - 20, boxY, textW + 40, boxHeight);

        ctx.fillStyle = isAllySpeech ? '#f6c885' : '#cdd6ff';
        ctx.fillText(text, this.width / 2, textY);
        ctx.restore();
    }

    _renderCrosshair(ctx) {
        const mx = this.input.mouseX;
        const my = this.input.mouseY;

        ctx.save();
        ctx.strokeStyle = '#e07228';
        ctx.lineWidth = 1.5;

        // Crosshair Circle
        ctx.beginPath();
        ctx.arc(mx, my, 7, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshair ticks
        ctx.beginPath();
        ctx.moveTo(mx - 12, my);
        ctx.lineTo(mx - 3, my);
        ctx.moveTo(mx + 3, my);
        ctx.lineTo(mx + 12, my);
        ctx.moveTo(mx, my - 12);
        ctx.lineTo(mx, my - 3);
        ctx.moveTo(mx, my + 3);
        ctx.lineTo(mx, my + 12);
        ctx.stroke();

        ctx.restore();
    }

    _renderSoulsMessage(ctx) {
        const msg = this._soulsMessage;
        if (!msg || msg.timer <= 0) return;

        // Fade-in estilo Dark Souls: escurece a tela e revela o texto.
        const total = 3.0;
        const t = Math.max(0, total - msg.timer);
        const alpha = Math.min(1, t / 0.9);
        const scale = Math.max(1, 1.35 - 0.35 * Math.min(1, t / 0.9));

        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${0.62 * alpha})`;
        ctx.fillRect(0, 0, this.width, this.height);

        ctx.globalAlpha = alpha;
        ctx.font = `${Math.round(26 * scale)}px "Press Start 2P", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = msg.color;
        ctx.shadowColor = msg.color;
        ctx.shadowBlur = 18;
        ctx.fillText(msg.text, this.width / 2, this.height / 2);
        ctx.restore();
    }
}
