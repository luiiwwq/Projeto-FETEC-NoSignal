/**
 * SkeletonArcher.js
 * Undead archer guarding the Martian Catacombs. Three of them hold posts at
 * the tips of the bottom, top and right walls and fire arrows at the player —
 * the ranged layer of the Catacombs combat.
 *
 * Implements the same enemy interface the engine drives for the other
 * skeletons (team / role / colliderHalfW,H / updateAi / update / render /
 * takeDamage / isDead / shouldRemove), so the archers join the shared
 * `actors` array with zero changes to the enemy loop. The arrow is added via
 * engine.addBullet as an enemy projectile (team 'enemy'), so it only damages
 * the player and stops on the map obstacles like every other bullet.
 *
 * Animation frames come from the Skeleton_Archer sheets (Craftpix): every
 * file is a single 128×128 frame named <State>_<NN>.png. The artwork is
 * bottom-anchored (feet reach the frame bottom), so the feet are pinned to
 * the bottom of the hitbox when rendering.
 *
 *   Idle 7f · Walk 8f · Shot_1 (bow release) 15f · Evasion (react) 6f ·
 *   Hurt 2f · Dead 5f
 */

/* ── Combat tuning ───────────────────────────────────────── */
export const ARCHER_MAX_HP = 90;
export const ARCHER_ATTACK_DAMAGE = 18;       // dano de cada flecha
export const ARCHER_ATTACK_COOLDOWN = 3.5;    // seconds between shots (disparo lento)
export const ARCHER_ATTACK_RANGE = 620;       // atira dentro deste raio
export const ARCHER_MIN_RANGE = 130;          // recua se o jogador chegar perto
export const ARCHER_ENGAGE_RANGE = 720;       // começa a reagir dentro deste raio
export const ARCHER_SPEED = 60;               // px/sec (recuo)

/* ── Hitbox & rendering (1.5x em relação ao 128px base) ─── */
export const ARCHER_COLLIDER_HALF_W = 18;
export const ARCHER_COLLIDER_HALF_H = 21;
export const ARCHER_RENDER_SCALE = 1.5;       // 128px frames -> 192px, corpo ~120px
export const ARCHER_ARROW_SPEED = 400;
export const ARCHER_ARROW_HIT_RADIUS = 8;

/* ── Local spawn layout (CATACOMBS coordinate space) ───────
 * Os 3 postos ficam nas PONTAS das paredes, em coordenadas LOCAIS do
 * `mars-catacombs` (1254×1254):
 *   - um na ponta da parede SUPERIOR (topo da câmara, norte);
 *   - um na ponta da parede da DIREITA (leste da câmara);
 *   - um na ponta da parede INFERIOR (sul da câmara).
 * São posições de pés; o motor valida/ajusta cada uma no spawn.            */
export const CATACOMBS_SKELETON_ARCHER_SPAWNS = [
    { id: 'catacombs-skeleton-archer-top',    x: 720,  y: 208 }, // ponta da parede superior
    { id: 'catacombs-skeleton-archer-right',  x: 1200, y: 544 }, // ponta da parede da direita
    { id: 'catacombs-skeleton-archer-bottom', x: 752,  y: 1072 }, // ponta da parede inferior
];

export const ARCHER_STATES = {
    IDLE: 'idle',
    WALK: 'walk',
    ATTACK: 'attack',
    REACT: 'react',
    HURT: 'hurt',
    DIE: 'die'
};

/* ── Animation sheets ────────────────────────────────────── */
// Cada arquivo é um frame único 128×128 dentro da pasta do estado.
const SPRITE_BASE = './src/assets/sprites/Enemies/Normal/Skeleton_Archer/';

const ANIM_CONFIG = {
    idle:   { dir: 'Idle',    frames: 7,  loop: true },
    walk:   { dir: 'Walk',    frames: 8,  loop: true },
    attack: { dir: 'Shot_1',  frames: 15, loop: false },
    react:  { dir: 'Evasion', frames: 6,  loop: false },
    hurt:   { dir: 'Hurt',    frames: 2,  loop: false },
    die:    { dir: 'Dead',    frames: 5,  loop: false },
};

// A flecha sai quando o arco está totalmente puxado (frame 8 do Shot_1).
const ATTACK_HIT_FRAME = 8;

const FRAME_DURATION = 0.10; // 100 ms por frame

// state -> HTMLImageElement[] (frames do estado, compartilhadas por todos)
const frameCache = new Map();

/** Warm the frame cache once at startup. */
export function preloadSkeletonArcherSprites() {
    if (typeof Image === 'undefined') return; // non-browser (tests)
    for (const state of Object.keys(ANIM_CONFIG)) {
        if (frameCache.has(state)) continue;
        const cfg = ANIM_CONFIG[state];
        const frames = [];
        for (let i = 1; i <= cfg.frames; i++) {
            const img = new Image();
            img.src = `${SPRITE_BASE}${cfg.dir}/${cfg.dir}_${String(i).padStart(2, '0')}.png`;
            frames.push(img);
        }
        frameCache.set(state, frames);
    }
}

function getFrames(state) {
    const frames = frameCache.get(state);
    return frames && frames.length > 0 && frames[0].complete && frames[0].naturalWidth > 0
        ? frames
        : null;
}

/* ── Projétil (Flecha) ───────────────────────────────────── */
const ARROW_SPRITE = './src/assets/sprites/Enemies/Normal/Skeleton_Archer/Arrow/Arrow_01.png';

let arrowImage = null;
function getArrowImage() {
    if (typeof Image === 'undefined') return null;
    if (!arrowImage) {
        arrowImage = new Image();
        arrowImage.src = ARROW_SPRITE;
    }
    return arrowImage.complete && arrowImage.naturalWidth > 0 ? arrowImage : null;
}

/** Preload the arrow sprite (called from preloadSkeletonArcherSprites). */
function preloadArrowSprite() {
    if (typeof Image === 'undefined') return;
    getArrowImage();
}

import { Bullet } from './Bullet.js';

/**
 * Flecha disparada pelo SkeletonArcher. Sobe em linha reta na direção do tiro,
 * para/colide nos obstáculos e só atinge o jogador (team 'enemy').
 */
export class SkeletonArrow extends Bullet {
    constructor(x, y, angle, owner, damage = ARCHER_ATTACK_DAMAGE) {
        super(x, y, angle, ARCHER_ARROW_SPEED, null, { team: 'enemy', owner, damage });
        this.life = 2.0;
        this.maxLife = 2.0;
        this.hitRadius = ARCHER_ARROW_HIT_RADIUS;
    }

    render(ctx, camera) {
        const screen = camera.worldToScreen(this.x, this.y);
        const img = getArrowImage();
        const drawW = 44;
        const drawH = 44;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        if (img) {
            ctx.translate(screen.x, screen.y);
            // A arte da flecha aponta para a direita: gira para a direção do voo.
            ctx.rotate(this.angle);
            ctx.drawImage(img, -Math.round(drawW / 2), -Math.round(drawH / 2), drawW, drawH);
        } else {
            ctx.fillStyle = '#c9b27a';
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

export class SkeletonArcher {
    /**
     * @param {number} x  centre x of the collider (world/local map space)
     * @param {number} y  centre y of the collider (feet are at y + colliderHalfH)
     * @param {object} options
     */
    constructor(x = 0, y = 0, { id = null } = {}) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.homeX = x;
        this.homeY = y;

        // Identity / allegiance (read by the engine's team rules)
        this.team = 'enemy';
        this.role = 'enemy';
        this.name = 'SKELETON_ARCHER';

        // Health
        this.maxHp = ARCHER_MAX_HP;
        this.hp = this.maxHp;
        this.isDead = false;
        this.shouldRemove = false;

        // Collision profile (resolver injected per map by the engine)
        this.colliderHalfW = ARCHER_COLLIDER_HALF_W;
        this.colliderHalfH = ARCHER_COLLIDER_HALF_H;
        this.collisionResolver = null;
        this.worldBounds = null;

        // Animation
        this.state = ARCHER_STATES.IDLE;
        this.currentFrame = 0;
        this.animTime = 0;

        // Combat
        this.attackDamage = ARCHER_ATTACK_DAMAGE;
        this.attackCooldown = 0;
        this.attackHitApplied = false;
        this._attackTarget = null;
        this._playerNear = false;
        this._reacted = false;

        // Presentation
        this._facing = 1;
        this._hpBarTimer = 0;

        // Movement personality (IA um pouco irregular)
        this.speedMul = 0.85 + Math.random() * 0.3;
    }

    setCollisionResolver(resolver) {
        this.collisionResolver = resolver;
    }

    setWorldBounds(bounds) {
        this.worldBounds = bounds;
    }

    /* ── AI ────────────────────────────────────────────────
     * O arqueiro é uma "torre": permanece no posto na ponta da parede e atira
     * flechas enquanto o jogador estiver dentro do alcance. Se o jogador se
     * aproximar demais, ele recua um pouco — mas nunca persegue.             */
    updateAi(dt, engine) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.state === ARCHER_STATES.DIE || this.state === ARCHER_STATES.HURT) return;
        if (this.state === ARCHER_STATES.ATTACK) return; // busy drawing the bow

        const player = engine ? engine.player : null;
        if (!player || player.isDead) {
            this._playerNear = false;
            this._stopAndIdle();
            return;
        }

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;

        // First spot: play the short one-shot "react" burst (Evasion), then
        // go back to the turret/idle loop on the following frames.
        if (!this._reacted && dist <= ARCHER_ENGAGE_RANGE) {
            this._reacted = true;
            this._facing = dx < 0 ? -1 : 1;
            this.vx = 0;
            this.vy = 0;
            this._setState(ARCHER_STATES.REACT, true);
            return;
        }
        if (this.state === ARCHER_STATES.REACT) {
            this.vx = 0;
            this.vy = 0;
            return;
        }

        this._playerNear = dist <= 260;
        this._facing = dx < 0 ? -1 : 1;

        // Jogador encostou demais: recua no posto (sem fugir da parede).
        if (dist < ARCHER_MIN_RANGE) {
            const bx = Math.sign(dx) * -1;
            const by = Math.sign(dy) * -1;
            this._moveDir(bx || 1, by || 0, dt);
            return;
        }

        // Dentro do alcance: mira e atira.
        if (dist <= ARCHER_ATTACK_RANGE) {
            this._stopAndIdle();
            if (this.attackCooldown <= 0) {
                this._startAttack(player, engine);
            }
            return;
        }

        // Fora do alcance: permanece no posto.
        this._stopAndIdle();
    }

    _moveDir(nx, ny, dt) {
        this.vx = nx * ARCHER_SPEED * this.speedMul;
        this.vy = ny * ARCHER_SPEED * this.speedMul;
        if (nx < 0) this._facing = -1;
        else if (nx > 0) this._facing = 1;
        this._setState(ARCHER_STATES.WALK);
    }

    _stopAndIdle() {
        this.vx = 0;
        this.vy = 0;
        this._setState(ARCHER_STATES.IDLE);
    }

    _startAttack(player, engine) {
        this._attackTarget = player;
        this.attackHitApplied = false;
        this.attackCooldown = ARCHER_ATTACK_COOLDOWN;
        this.vx = 0;
        this.vy = 0;
        this._engineForShot = engine;
        this._setState(ARCHER_STATES.ATTACK, true);
    }

    // Dispara a flecha na direção atual do jogador (usado no frame do arco).
    _releaseArrow() {
        const target = this._attackTarget;
        const engine = this._engineForShot;
        if (!target || !engine || target.isDead) return;

        const angle = Math.atan2(target.y - this.y, target.x - this.x);
        const dist = this.colliderHalfW + 18;
        const spawnX = this.x + Math.cos(angle) * dist;
        const spawnY = this.y + Math.sin(angle) * dist;
        engine.addBullet(new SkeletonArrow(spawnX, spawnY, angle, this, this.attackDamage));
    }

    _setState(state, force = false) {
        if (this.state === ARCHER_STATES.DIE && !force) return;
        if (this.state === state) return;
        this.state = state;
        this.currentFrame = 0;
        this.animTime = 0;
    }

    /* ── Damage ──────────────────────────────────────────── */
    takeDamage(amount = ARCHER_ATTACK_DAMAGE, fromX = null, fromY = null) {
        if (this.isDead || this.state === ARCHER_STATES.DIE) return;

        this.hp = Math.max(0, this.hp - amount);
        this._hpBarTimer = 6;

        // Small knockback away from the impact point.
        if (fromX !== null && fromY !== null) {
            const angle = Math.atan2(this.y - fromY, this.x - fromX);
            this.vx += Math.cos(angle) * 90;
            this.vy += Math.sin(angle) * 90;
        }

        if (this.hp <= 0) {
            this.isDead = true;
            this.vx = 0;
            this.vy = 0;
            this._setState(ARCHER_STATES.DIE, true);
        } else {
            this._setState(ARCHER_STATES.HURT, true);
        }
    }

    /* ── Simulation ──────────────────────────────────────── */
    update(dt) {
        if (this._hpBarTimer > 0) this._hpBarTimer -= dt;

        this._advanceAnimation(dt);

        // Knockback friction while stunned.
        if (this.state === ARCHER_STATES.HURT) {
            const decay = Math.max(0, 1 - dt * 6);
            this.vx *= decay;
            this.vy *= decay;
        }

        // Release the arrow once, when the bow is fully drawn.
        if (
            this.state === ARCHER_STATES.ATTACK &&
            !this.attackHitApplied &&
            this.currentFrame >= ATTACK_HIT_FRAME
        ) {
            this.attackHitApplied = true;
            this._releaseArrow();
        }

        if (this.state === ARCHER_STATES.DIE) return;

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
        while (this.animTime >= FRAME_DURATION) {
            this.animTime -= FRAME_DURATION;

            if (this.currentFrame < cfg.frames - 1) {
                this.currentFrame += 1;
                continue;
            }

            if (cfg.loop) {
                this.currentFrame = 0;
                continue;
            }

            // One-shot finished.
            if (this.state === ARCHER_STATES.DIE) {
                this.currentFrame = cfg.frames - 1;
                this.shouldRemove = true; // removed only after the death anim
            } else {
                this._setState(ARCHER_STATES.IDLE, true);
            }
            break;
        }
    }

    /* ── Rendering ───────────────────────────────────────── */
    render(ctx, camera) {
        const screen = camera.worldToScreen(this.x, this.y);
        const cfg = ANIM_CONFIG[this.state];
        const frames = getFrames(this.state);

        const fw = 128;
        const fh = 128;
        const drawW = Math.round(fw * ARCHER_RENDER_SCALE);
        const drawH = Math.round(fh * ARCHER_RENDER_SCALE);
        // The artwork is bottom-anchored: pin the feet to the bottom of the
        // hitbox and let the body rise above it.
        const feetY = screen.y + this.colliderHalfH;
        const drawY = Math.round(feetY - drawH);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(screen.x, 0);
        if (this._facing < 0) ctx.scale(-1, 1);
        if (frames) {
            const frame = frames[Math.min(this.currentFrame, frames.length - 1)];
            ctx.drawImage(
                frame,
                Math.round(-drawW / 2), drawY, drawW, drawH
            );
        } else {
            // Fallback placeholder while the sheet is loading.
            ctx.fillStyle = '#5f6b6b';
            ctx.fillRect(Math.round(-drawW / 2), drawY, drawW, drawH);
        }
        ctx.restore();

        this._renderHealthBar(ctx, screen.x, drawY);
    }

    _renderHealthBar(ctx, centerX, topY) {
        if (this.hp >= this.maxHp && this._hpBarTimer <= 0 && !this._playerNear) return;

        const barW = 34;
        const barH = 4;
        const x = Math.round(centerX - barW / 2);
        const y = Math.round(topY + 4);

        ctx.save();
        ctx.fillStyle = 'rgba(5, 5, 11, 0.8)';
        ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);
        ctx.fillStyle = '#3a1010';
        ctx.fillRect(x, y, barW, barH);

        const pct = Math.max(0, this.hp / this.maxHp);
        if (pct > 0) {
            ctx.fillStyle = pct > 0.4 ? '#8fbf8f' : '#e62424';
            ctx.fillRect(x, y, Math.round(barW * pct), barH);
        }
        ctx.restore();
    }
}

// Preload do sprite da flecha junto com as folhas do arqueiro.
preloadArrowSprite();
