/**
 * NecromancerBoss.js
 * Boss residente na Sala do Rei (CASTLE_KING_ROOM), spawn local (720,443).
 *
 * Usa a mesma interface de ator do motor (updateAi / update / render /
 * takeDamage / isDead / shouldRemove) e as frames já recortadas de
 * necromancer_sprites. A invocação dos Reapers usa apenas as frames 04-11 de
 * Unidentified_row5 (gesto de levantar o cajado), nunca frames de Idle/Run/
 * ataques. Todas as coordenadas são LOCAIS da Sala do Rei — nunca somadas à
 * superfície/entrada do castelo.
 */

/* ── Combate ─────────────────────────────────────────────── */
export const NECROMANCER_MAX_HP = 1000;
export const NECROMANCER_PLAYER_DAMAGE_MULTIPLIER = 0.5;
export const NECROMANCER_PLAYER_DAMAGE_WITH_ALLY_MULTIPLIER = 0.25;
export const NECROMANCER_ATTACK_DAMAGE = 20;
export const NECROMANCER_ATTACK_COOLDOWN = 1.2;
export const NECROMANCER_MELEE_RANGE = 100;
export const NECROMANCER_ENGAGE_RANGE = 920;
export const NECROMANCER_SKILL_COOLDOWN = 2.0;
export const NECROMANCER_HURT_COOLDOWN = 0.45;
export const NECROMANCER_SPEED = 64;
export const NECROMANCER_HOME_TOLERANCE = 12;
export const NECROMANCER_HIT_FRAME = 6;
export const NECROMANCER_SUMMON_DURATION = 2.6;
// Invocação única assim que o boss chega a 500 de vida (50% dos 1000 de HP).
export const NECROMANCER_SUMMON_AT_HP = 500;

// Frames da poça unholy em que ela já está CRESCIDA (índices 0-base no array
// de frames; arquivos 11..34 = poça crescida). Fora dessa janela a poça ainda
// está reduzida na animação e NÃO dá dano — o hitbox só ativa com o visual.
export const UNHOLY_GROWN_FRAME_INDEX = [10, 33];
export const UNHOLY_FRAME_HZ = 0.09;

/* ── Hitbox & render ─────────────────────────────────────── */
export const NECROMANCER_COLLIDER_HALF_W = 28;
export const NECROMANCER_COLLIDER_HALF_H = 20;
// Hitbox de acerto das balas: cobre a arte visível (do topo da cabeça aos pés,
// ~186px). O collider de movimento continua pequeno — as balas não podem passar
// "por cima" quando o tiro acerta a cabeça do boss.
export const NECROMANCER_HIT_HEIGHT = 190;
export const NECROMANCER_RENDER_SCALE = 3;
export const NECROMANCER_ONESHOT_FPS = 0.055;

// Os frames 160x128 têm a arte visível entre as linhas ~54 e ~116. O rodapé de
// 12 linhas é transparente; este deslocamento alinha o chão da arte ao piso.
export const NECROMANCER_ART_BOTTOM_ROW = 116;

// Spawn LOCAL da Sala do Rei (1790x879) — bottom-center dos pés do boss.
// Posição ajustada para y=470 para não colidir com o obstáculo do trono acima.
export const NECROMANCER_SPAWN = { x: 720, y: 470 };

// Posições relativas dos 5 Reapers a partir dos pés do boss (eixo local).
export const NECROMANCER_REAPER_OFFSETS = [
    { x: -120, y: -30 },
    { x: 120, y: -30 },
    { x: -150, y: 70 },
    { x: 150, y: 70 },
    { x: 0, y: 120 },
];

export const NECROMANCER_STATES = {
    IDLE: 'idle',
    WALK: 'walk',
    ATTACK: 'attack',
    CAST: 'cast',
    SUMMON: 'summon',
    HURT: 'hurt',
    DEATH: 'death',
};

/* ── Animações ───────────────────────────────────────────── */
const SPRITE_BASE = './src/assets/sprites/Enemies/Bosses/Necromancer/necromancer_sprites/';
const SKILL_BASE = './src/assets/sprites/Enemies/Bosses/Necromancer/necromancer_skills_sprites/';

const ANIM_CONFIG = {
    [NECROMANCER_STATES.IDLE]:   { dir: 'Idle',            frames: 8,  loop: true },
    [NECROMANCER_STATES.WALK]:   { dir: 'Run',             frames: 8,  loop: true },
    [NECROMANCER_STATES.ATTACK]: { dir: 'Attack_Nr1',      frames: 13, loop: false },
    [NECROMANCER_STATES.CAST]:   { dir: 'Attack_Nr2',      frames: 13, loop: false },
    [NECROMANCER_STATES.HURT]:   { dir: 'Hurt',            frames: 5,  loop: false },
    [NECROMANCER_STATES.DEATH]:  { dir: 'Death',           frames: 10, loop: false },
    [NECROMANCER_STATES.SUMMON]: {
        dir: 'Unidentified_row5',
        frames: 17,
        loop: true,
        frameIndices: [3, 4, 5, 6, 7, 8, 9, 10],
    },
};

export const SKILL_ANIM_CONFIG = {
    explosion: { dir: 'explosion_simple', frames: 6, scale: 4 },
    lightning: { dir: 'lightning_variant01', frames: 3, scale: 3 },
    fireball:  { dir: 'skull_fireball_red', frames: 8, scale: 2 },
    unholy:    { dir: 'unholy_ground_size_reduction', frames: 45, scale: 2 },
};

/* skill -> HTMLImageElement[] */
const imageCache = new Map();

function loadFrames(base, dir, files, frameSuffix = '_') {
    const list = [];
    for (let i = 1; i <= files; i++) {
        const img = new Image();
        const suffix = frameSuffix === 'frame'
            ? `_frame${String(i).padStart(2, '0')}`
            : `_${String(i).padStart(2, '0')}`;
        img.src = `${base}${dir}/${dir}${suffix}.png`;
        list.push(img);
    }
    return list;
}

/** Warm every boss frame and every skill frame once at startup. */
export function preloadNecromancerSprites() {
    if (typeof Image === 'undefined') return;
    for (const state of Object.keys(ANIM_CONFIG)) {
        if (imageCache.has(`boss:${state}`)) continue;
        const cfg = ANIM_CONFIG[state];
        imageCache.set(`boss:${state}`, loadFrames(SPRITE_BASE, cfg.dir, cfg.frames));
    }

    for (const kind of Object.keys(SKILL_ANIM_CONFIG)) {
        const key = `skill:${kind}`;
        if (imageCache.has(key)) continue;
        const cfg = SKILL_ANIM_CONFIG[kind];
        if (kind === 'lightning') {
            for (let v = 1; v <= 9; v++) {
                const dir = `lightning_variant${String(v).padStart(2, '0')}`;
                imageCache.set(`skill:lightning:${v}`, loadFrames(SKILL_BASE, dir, cfg.frames, 'frame'));
            }
        } else {
            imageCache.set(key, loadFrames(SKILL_BASE, cfg.dir, cfg.frames));
        }
    }
}

function ready(imgs) {
    return imgs && imgs.length > 0 && imgs[0].complete && imgs[0].naturalWidth > 0;
}

export function getBossImages(state) {
    return ready(imageCache.get(`boss:${state}`)) ? imageCache.get(`boss:${state}`) : null;
}

export function getSkillImages(kind, variant = null) {
    if (kind === 'lightning') {
        return ready(imageCache.get(`skill:lightning:${variant}`))
            ? imageCache.get(`skill:lightning:${variant}`)
            : null;
    }
    return ready(imageCache.get(`skill:${kind}`)) ? imageCache.get(`skill:${kind}`) : null;
}

/* ── Projétil (Skull Fireball) ───────────────────────────── */
import { Bullet } from './Bullet.js';
import { gameState } from '../state/gameState.js';

export const NECRO_FIREBALL_SPEED = 360;
export const NECRO_FIREBALL_DAMAGE = 25;

// Dano das skills do Necromancer conforme o suporte do NPC:
// - SEM ajuda (allyBossHelpPurchased false): lightning/fireball/explosion
//   alinhados no mesmo dano (~15) e unholy em 15 por tick (até 4 ticks por
//   poça = ~60 de zona de negação, equilibrado com o melee de 25).
// - COM ajuda comprada na loja: mantém o dano original da luta.
const NECRO_SKILL_DMG_SOLO = { fireball: 15, lightning: 15, explosion: 15, unholy: 15 };
const NECRO_SKILL_DMG_ASSISTED = { fireball: NECRO_FIREBALL_DAMAGE, lightning: 35, explosion: 30, unholy: 12 };

export function getNecroSkillDamage(kind) {
    const table = gameState.allyBossHelpPurchased ? NECRO_SKILL_DMG_ASSISTED : NECRO_SKILL_DMG_SOLO;
    return table[kind];
}

/* ── Hitboxes das skills desenhadas a partir dos sprites ──
 * A explosion usa bbox [l, t, r, b] NORMALIZADO (0..1) sobre o frame do sprite,
 * medida da área não-transparente real, com os MESMOS transforms do render
 * (64x55 x4, centrada em e.x/e.y).
 * Já lightning e unholy têm hitbox fixa de 1/3 do asset:
 *   - lightning: coluna 100x208 x3 âncora-bottom; o raio CAI de cima e a zona
 *     de perigo é só o terço inferior (dar um pulo por cima não deve acertar).
 *   - unholy: poça 300x256 x2 âncora-bottom; hitbox só no terço central-inferior,
 *     onde a poça visivelmente pica, sem pegar quem passa na borda/longe.
 */
const SKILL_SPRITE_LAYOUT = {
    explosion: { w: 64, h: 55, scale: 4, anchor: 'center' },
    lightning: { w: 100, h: 208, scale: 3, anchor: 'bottom' },
    unholy:    { w: 300, h: 256, scale: 2, anchor: 'bottom' },
};

// União dos 6 frames de explosion_simple.
const EXPLOSION_BBOX = [0.0000, 0.0000, 0.9688, 1.0000];

/**
 * Retorna o retângulo de colisão em coordenadas de MUNDO que reproduz a área
 * de perigo de cada skill (mesmo anchor+scale do render). null para ataques
 * sem área própria (fireball é projétil).
 */
export function getNecroSkillHitRect(e) {
    const layout = SKILL_SPRITE_LAYOUT[e.kind];
    if (!layout) return null;
    const { w, h, scale: cfgScale, anchor } = layout;
    const scale = e.kind === 'unholy' ? (e.scale || cfgScale) : cfgScale;
    const drawW = w * scale;
    const drawH = h * scale;

    if (e.kind === 'lightning' || e.kind === 'unholy') {
        // Terço inferior central: raio acerta na base e a poça no núcleo.
        return {
            x: e.x - drawW / 6,
            y: e.y - drawH / 3,
            w: drawW / 3,
            h: drawH / 3,
        };
    }

    const bb = EXPLOSION_BBOX;
    const left = e.x - drawW / 2;
    const top = anchor === 'center' ? e.y - drawH / 2 : e.y - drawH;
    return {
        x: left + bb[0] * drawW,
        y: top + bb[1] * drawH,
        w: (bb[2] - bb[0]) * drawW,
        h: (bb[3] - bb[1]) * drawH,
    };
}

export class NecromancerProjectile extends Bullet {
    constructor(x, y, angle, owner, damage = NECRO_FIREBALL_DAMAGE) {
        super(x, y, angle, NECRO_FIREBALL_SPEED, null, { team: 'enemy', owner, damage });
        this.life = 6;
        this.maxLife = 6;
        this.hitRadius = 26;
        this.animTime = 0;
        this.frame = 0;
    }

    update(dt) {
        super.update(dt);
        this.animTime += dt;
        while (this.animTime >= 0.08) {
            this.animTime -= 0.08;
            this.frame = (this.frame + 1) % 8;
        }
    }

    render(ctx, camera) {
        const imgs = getSkillImages('fireball');
        const screen = camera.worldToScreen(this.x, this.y);
        const cfg = SKILL_ANIM_CONFIG.fireball;
        const drawW = 64 * cfg.scale;
        const drawH = 64 * cfg.scale;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (imgs) {
            // A caveira aponta para a direita por padrão: rotaciona o sprite para
            // acompanhar a direção de voo (direita = 0, esquerda = PI, cima =
            // -PI/2, baixo = PI/2...).
            ctx.translate(Math.round(screen.x), Math.round(screen.y));
            ctx.rotate(this.angle);
            ctx.drawImage(
                imgs[Math.min(this.frame, imgs.length - 1)],
                -Math.round(drawW / 2),
                -Math.round(drawH / 2),
                drawW,
                drawH
            );
        } else {
            ctx.fillStyle = '#c02828';
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 12, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

/* ── Boss ────────────────────────────────────────────────── */
export class NecromancerBoss {
    /**
     * @param {number} x  centro x do collider (posição local da Sala do Rei)
     * @param {number} y  centro y do collider (pés = y + colliderHalfH)
     * @param {object} options
     */
    constructor(x = NECROMANCER_SPAWN.x, y = NECROMANCER_SPAWN.y - NECROMANCER_COLLIDER_HALF_H, { id = null } = {}) {
        this.id = id;

        // Posição LOCAL da Sala do Rei (bottom-center dos pés).
        this.x = x;
        this.y = y;
        this.homeX = x; // posto fixo: o boss volta para cá se o jogador fugir
        this.homeY = y;

        this.team = 'enemy';
        this.role = 'boss';
        this.name = 'Necro, King of Duna';

        this.maxHp = NECROMANCER_MAX_HP;
        this.hp = this.maxHp;
        this.isDead = false;
        this.shouldRemove = false;

        this.colliderHalfW = NECROMANCER_COLLIDER_HALF_W;
        this.colliderHalfH = NECROMANCER_COLLIDER_HALF_H;
        this.hitHeight = NECROMANCER_HIT_HEIGHT;
        this.collisionResolver = null;
        this.worldBounds = null;

        this.state = NECROMANCER_STATES.IDLE;
        this.currentFrame = 0;
        this.animTime = 0;

        this.attackDamage = NECROMANCER_ATTACK_DAMAGE;
        this.attackCooldown = 0.5;
        this.skillCooldown = 1.2;
        this.hurtCooldown = 0;
        this.attackHitApplied = false;
        this._attackTarget = null;
        this._playerNear = false;

        this._facing = 1;
        this._hpBarTimer = 0;
        this._moving = false;
        this._engine = null;

        this.hasSummonedReapers = false;
        this.summonTimer = 0;

        this._pendingSkill = null;
        this._castOnComplete = null;

        // Congelamento durante a cutscene de introdução: enquanto true, o boss
        // permanece no estado IDLE e não executa nenhuma ação de IA.
        this._cutscenePlaying = false;
    }

    /* Quando o jogador morre, o boss volta ao estado inicial da luta: HP cheio,
       de volta ao posto, sem invocação de Reapers e cooldowns zerados. A
       derrota só acontece de verdade (permanente) quando o boss morre. */
    resetForRetry() {
        this.x = this.homeX;
        this.y = this.homeY;
        this.hp = this.maxHp;
        this.isDead = false;
        this.shouldRemove = false;

        this.state = NECROMANCER_STATES.IDLE;
        this.currentFrame = 0;
        this.animTime = 0;

        this.attackCooldown = 0.5;
        this.skillCooldown = 1.2;
        this.hurtCooldown = 0;
        this.attackHitApplied = false;
        this._attackTarget = null;
        this._playerNear = false;

        this._facing = 1;
        this._hpBarTimer = 0;
        this._moving = false;

        this.hasSummonedReapers = false;
        this.summonTimer = 0;

        this._pendingSkill = null;
        this._castOnComplete = null;

        this.vx = 0;
        this.vy = 0;
        // _cutscenePlaying não é resetada no retry: a cutscene já foi exibida
        // na entrada e não volta a tocar até reiniciar a partida.
    }

    setCollisionResolver(resolver) {
        this.collisionResolver = resolver;
    }

    setWorldBounds(bounds) {
        this.worldBounds = bounds;
    }

    /* ── IA ──────────────────────────────────────────────── */
    updateAi(dt, engine) {
        // Congelado durante a cutscene de introdução: boss permanece parado.
        if (this._cutscenePlaying) return;

        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.skillCooldown > 0) this.skillCooldown -= dt;
        if (this.hurtCooldown > 0) this.hurtCooldown -= dt;

        this._engine = engine;

        const player = engine ? engine.player : null;
        if (!player || player.isDead) {
            this._stopAndIdle();
            return;
        }

        if (this.isDead || this.state === NECROMANCER_STATES.DEATH) return;
        if (this.state === NECROMANCER_STATES.HURT) return;
        if (this.state === NECROMANCER_STATES.SUMMON) return;
        if (this.state === NECROMANCER_STATES.ATTACK || this.state === NECROMANCER_STATES.CAST) return;

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        this._facing = dx < 0 ? -1 : 1;
        this._playerNear = dist <= 300;

        // Fase 2 única: dispara a invocação assim que o HP cai a 250.
        if (!this.hasSummonedReapers && this.hp <= NECROMANCER_SUMMON_AT_HP) {
            this._startSummon(player);
            return;
        }

        // Habilidade à distância quando o cooldown libera.
        if (this.skillCooldown <= 0 && dist > NECROMANCER_MELEE_RANGE && dist <= NECROMANCER_ENGAGE_RANGE) {
            this._startSkillCast(player);
            return;
        }

        // Ataque corpo a corpo.
        if (dist <= NECROMANCER_MELEE_RANGE) {
            this._stopAndIdle();
            if (this.attackCooldown <= 0) {
                this._startMeleeAttack(player);
            }
            return;
        }

        // Movimentação intensa: persegue o jogador pelo alcance de combate sem
        // voltar para o posto (batalha móvel).
        if (dist <= NECROMANCER_ENGAGE_RANGE) {
            this._moveToward(player, dt);
            return;
        }

        this._stopAndIdle();
    }

    _moveToward(player, dt) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        this.vx = (dx / d) * NECROMANCER_SPEED;
        this.vy = (dy / d) * NECROMANCER_SPEED;
        this._facing = dx < 0 ? -1 : 1;
        this._moving = true;
        this._setState(NECROMANCER_STATES.WALK);
    }

    _stopAndIdle() {
        this.vx = 0;
        this.vy = 0;
        this._moving = false;
        this._setState(NECROMANCER_STATES.IDLE);
    }

    _startMeleeAttack(player) {
        this._attackTarget = player;
        this.attackHitApplied = false;
        this.attackCooldown = NECROMANCER_ATTACK_COOLDOWN;
        this.vx = 0;
        this.vy = 0;
        this._moving = false;
        this._setState(NECROMANCER_STATES.ATTACK, true);
    }

    _startSkillCast(player) {
        // Raios pretos (lightning) são o ataque favorito do boss — metade das
        // habilidades é de raio; o resto alterna explosão, bola de fogo e unholy.
        const roll = Math.random();
        const kind = roll < 0.5 ? 'lightning' : roll < 0.7 ? 'explosion' : roll < 0.85 ? 'fireball' : 'unholy';

        const tx = player.x;
        const ty = player.y;
        const point = this._engine ? this._engine.clampNecromancerPoint(tx, ty) : { x: tx, y: ty };

        this._pendingSkill = {
            kind,
            vx: tx - this.x,
            vy: ty - this.y,
            dist: Math.hypot(tx - this.x, ty - this.y) || 1,
            x: point.x,
            y: point.y,
            variant: 1 + Math.floor(Math.random() * 9),
        };

        this.skillCooldown = NECROMANCER_SKILL_COOLDOWN;
        this.vx = 0;
        this.vy = 0;
        this._moving = false;

        this._castOnComplete = () => this._releaseSkill(this._pendingSkill);
        this._setState(NECROMANCER_STATES.CAST, true);
    }

    _releaseSkill(skill) {
        if (!skill || this.isDead) return;
        const engine = this._engine;
        if (!engine) return;

        if (skill.kind === 'fireball') {
            // skill.vx/vy já são os deltas até o jogador (tx - this.x / ty - this.y);
            // o ângulo aponta direto no alvo para a bola de fogo ser desviável.
            const angle = Math.atan2(skill.vy, skill.vx);
            // A bola nasce um pouco à frente do corpo; se o ponto cair dentro de um
            // obstáculo ela seria engolida no primeiro frame (ataque invisível), então
            // varremos o raio até achar o primeiro ponto livre antes de spawnar.
            const obstacles = engine.currentMap ? engine.currentMap.obstacles || [] : [];
            let dist = this.colliderHalfW + 26 + 4;
            const step = 10;
            for (let i = 0; i < 8 && obstacles.length > 0; i++) {
                const cx = this.x + Math.cos(angle) * dist;
                const cy = this.y + Math.sin(angle) * dist;
                const box = { x: cx - 10, y: cy - 10, w: 20, h: 20 };
                if (!this._overlapsAnyObstacle(box, obstacles)) break;
                dist += step;
            }
            const spawnX = this.x + Math.cos(angle) * dist;
            const spawnY = this.y + Math.sin(angle) * dist;
            const proj = new NecromancerProjectile(spawnX, spawnY, angle, this, getNecroSkillDamage('fireball'));
            engine.addBullet(proj);
            return;
        }

        if (skill.kind === 'lightning') {
            engine.addNecromancerEffect({
                kind: 'lightning',
                x: skill.x,
                y: skill.y,
                variant: skill.variant,
                t: 0,
                strikeDur: 0.34,
                dmg: getNecroSkillDamage('lightning'),
            });
            return;
        }

        if (skill.kind === 'explosion') {
            engine.addNecromancerEffect({
                kind: 'explosion',
                x: skill.x,
                y: skill.y,
                t: 0,
                blastDur: 0.6,
                dmg: getNecroSkillDamage('explosion'),
            });
            return;
        }

        if (skill.kind === 'unholy') {
            engine.addNecromancerEffect({
                kind: 'unholy',
                x: skill.x,
                y: skill.y,
                t: 0,
                dur: 4.2,
                tickEvery: 0.6,
                tickCd: 0,
                dmg: getNecroSkillDamage('unholy'),
                scale: 2,
            });
        }
    }

    _overlapsAnyObstacle(box, obstacles) {
        for (const o of obstacles) {
            if (o.x < box.x + box.w && o.x + o.w > box.x && o.y < box.y + box.h && o.y + o.h > box.y) {
                return true;
            }
        }
        return false;
    }

    _hasLineOfSight(target) {
        const map = this._engine ? this._engine.currentMap : null;
        const obstacles = map ? map.obstacles || [] : [];
        if (obstacles.length === 0) return true;
        const sx = this.x;
        const sy = this.y - this.colliderHalfH;
        const ex = target.x;
        const ey = target.y - (target.colliderHalfH || 0);
        const dx = ex - sx;
        const dy = ey - sy;
        const dist = Math.hypot(dx, dy) || 1;
        const steps = Math.max(1, Math.ceil(dist / 24));
        for (let i = 1; i < steps; i++) {
            const px = sx + (dx * i) / steps;
            const py = sy + (dy * i) / steps;
            const box = { x: px - 8, y: py - 8, w: 16, h: 16 };
            if (this._overlapsAnyObstacle(box, obstacles)) return false;
        }
        return true;
    }

    _startSummon(player) {
        this.summonTimer = NECROMANCER_SUMMON_DURATION;
        this.vx = 0;
        this.vy = 0;
        this._moving = false;
        this._facing = player.x < this.x ? -1 : 1;
        this._setState(NECROMANCER_STATES.SUMMON, true);
    }

    _setState(state, force = false) {
        if (this.state === NECROMANCER_STATES.DEATH && !force) return;
        if (this.state === state) return;
        this.state = state;
        this.currentFrame = 0;
        this.animTime = 0;
    }

    /* ── Dano ────────────────────────────────────────────── */
    takeDamage(amount = 20, fromX = null, fromY = null, source = 'player') {
        if (this.isDead || this.state === NECROMANCER_STATES.DEATH) return;

        const allyIsAssisting = Boolean(this._engine && this._engine.bossAssistAlly && !this._engine.bossAssistAlly.isDead);
        const damageMultiplier = source === 'ally'
            ? 1
            : allyIsAssisting
                ? NECROMANCER_PLAYER_DAMAGE_WITH_ALLY_MULTIPLIER
                : NECROMANCER_PLAYER_DAMAGE_MULTIPLIER;
        this.hp = Math.max(0, this.hp - Math.round(amount * damageMultiplier));
        this._hpBarTimer = 6;

        // Sem knockback: o boss permanece firme no posto de spawn.

        if (this.hp <= 0) {
            this.isDead = true;
            this.summonTimer = 0;
            this._castOnComplete = null;
            this.vx = 0;
            this.vy = 0;
            this._moving = false;
            if (this._engine) this._engine.onNecromancerDefeated(this);
            this._setState(NECROMANCER_STATES.DEATH, true);
        } else if (
            this.state !== NECROMANCER_STATES.ATTACK &&
            this.state !== NECROMANCER_STATES.CAST &&
            this.state !== NECROMANCER_STATES.SUMMON
        ) {
            this._setState(NECROMANCER_STATES.HURT, true);
        }
    }

    /* ── Simulação ───────────────────────────────────────── */
    update(dt) {
        if (this._hpBarTimer > 0) this._hpBarTimer -= dt;

        this._advanceAnimation(dt);

        if (this.state === NECROMANCER_STATES.HURT) {
            const decay = Math.max(0, 1 - dt * 5);
            this.vx *= decay;
            this.vy *= decay;
        }

        if (
            this.state === NECROMANCER_STATES.ATTACK &&
            !this.attackHitApplied &&
            this.currentFrame >= NECROMANCER_HIT_FRAME
        ) {
            this.attackHitApplied = true;
            const target = this._attackTarget;
            if (target && !target.isDead && typeof target.takeDamage === 'function') {
                const reach = NECROMANCER_MELEE_RANGE + 20;
                if (Math.hypot(target.x - this.x, target.y - this.y) <= reach && this._hasLineOfSight(target)) {
                    target.takeDamage(this.attackDamage, this.x, this.y);
                }
            }
        }

        if (this.state === NECROMANCER_STATES.SUMMON) {
            this.vx = 0;
            this.vy = 0;
            this.summonTimer -= dt;
            if (this.summonTimer <= 0 && this._engine) {
                this._engine.spawnNecromancerReapers(this);
                this.hasSummonedReapers = true;
                this._setState(NECROMANCER_STATES.IDLE, true);
            }
            return;
        }

        if (this.state === NECROMANCER_STATES.DEATH) return;
        if (this.state === NECROMANCER_STATES.ATTACK || this.state === NECROMANCER_STATES.CAST) {
            this.vx = 0;
            this.vy = 0;
            return;
        }

        if (!this._moving && this.state !== NECROMANCER_STATES.HURT) return;

        const dx = this.vx * dt;
        const dy = this.vy * dt;
        if (dx === 0 && dy === 0) return;

        if (this.collisionResolver) {
            const resolved = this.collisionResolver(this.x, this.y, dx, dy);
            this.x = resolved.x;
            this.y = resolved.y;
        } else if (this.worldBounds) {
            this.x = Math.max(this.worldBounds.minX + this.colliderHalfW, Math.min(this.worldBounds.maxX - this.colliderHalfW, this.x + dx));
            this.y = Math.max(this.worldBounds.minY + this.colliderHalfH, Math.min(this.worldBounds.maxY - this.colliderHalfH, this.y + dy));
        } else {
            this.x += dx;
            this.y += dy;
        }
    }

    _advanceAnimation(dt) {
        const cfg = ANIM_CONFIG[this.state];
        if (!cfg) return;

        this.animTime += dt;
        while (this.animTime >= NECROMANCER_ONESHOT_FPS) {
            this.animTime -= NECROMANCER_ONESHOT_FPS;

            if (this.currentFrame < cfg.frames - 1) {
                this.currentFrame += 1;
                continue;
            }

            if (cfg.loop) {
                this.currentFrame = 0;
                continue;
            }

            if (this.state === NECROMANCER_STATES.DEATH) {
                this.currentFrame = cfg.frames - 1;
                this.shouldRemove = true;
            } else {
                const onComplete = this._castOnComplete;
                if (this.state === NECROMANCER_STATES.CAST && onComplete) {
                    this._castOnComplete = null;
                    onComplete();
                }
                this._setState(NECROMANCER_STATES.IDLE, true);
            }
            break;
        }
    }

    /* ── Render ──────────────────────────────────────────── */
    render(ctx, camera) {
        const screen = camera.worldToScreen(this.x, this.y);
        const cfg = ANIM_CONFIG[this.state];
        const imgs = getBossImages(this.state);

        const drawW = 160 * NECROMANCER_RENDER_SCALE;
        const drawH = 128 * NECROMANCER_RENDER_SCALE;
        const feetY = screen.y + this.colliderHalfH;
        const drawY = Math.round(feetY - drawH + (128 - NECROMANCER_ART_BOTTOM_ROW) * NECROMANCER_RENDER_SCALE);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(screen.x, 0);
        if (this._facing < 0) ctx.scale(-1, 1);

        if (imgs) {
            const srcIndex = cfg.frameIndices
                ? cfg.frameIndices[Math.min(this.currentFrame, cfg.frameIndices.length - 1)]
                : Math.min(this.currentFrame, cfg.frames - 1);
            ctx.drawImage(
                imgs[Math.min(srcIndex, imgs.length - 1)],
                Math.round(-drawW / 2),
                drawY,
                drawW,
                drawH
            );
        } else {
            ctx.fillStyle = '#3a1a2a';
            ctx.fillRect(Math.round(-drawW / 2), drawY, drawW, drawH);
        }
        ctx.restore();
    }

    _renderHealthBar(ctx, centerX, topY) {
        if (this.hp >= this.maxHp && this._hpBarTimer <= 0 && !this._playerNear) return;

        const barW = 64;
        const barH = 6;
        const x = Math.round(centerX - barW / 2);
        const y = Math.round(topY + 2);

        ctx.save();
        ctx.fillStyle = 'rgba(5, 5, 11, 0.8)';
        ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);
        ctx.fillStyle = '#3a0808';
        ctx.fillRect(x, y, barW, barH);

        const pct = Math.max(0, this.hp / this.maxHp);
        if (pct > 0) {
            ctx.fillStyle = '#8f1821';
            ctx.fillRect(x, y, Math.round(barW * pct), barH);
        }
        ctx.restore();
    }
}
