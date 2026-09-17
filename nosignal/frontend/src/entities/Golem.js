/**
 * Golem.js
 * Heavy melee enemy for No Signal.
 *
 * Golens are not shooters: they walk toward the player and strike in melee
 * range. Eight of them are spawned as a wave every second night (see
 * GameEngine._spawnGolemWave). The class implements the same small interface
 * the engine already uses for CharacterActor (team / role / colliderHalfW,H /
 * isDead / shouldRemove / updateAi / update / render / takeDamage) so it can
 * share the actors array, the projectile team rules and the render pass
 * without duplicating any of that logic.
 *
 * Damage is applied a single time per swing via `attackHitApplied`, keeping
 * the 1.0s cooldown honest regardless of animation length.
 */

import { rectsOverlap } from '../systems/collisionSystem.js';

/* ── Combat tuning ───────────────────────────────────────── */
export const GOLEM_ATTACK_DAMAGE = 11;   // +5% vs the original 10
export const GOLEM_ATTACK_COOLDOWN = 1.0;   // seconds between swings
export const GOLEM_ATTACK_RANGE = 52;       // centre-to-centre melee reach
export const GOLEM_MAX_HP = 120;

/* ── Wave buff (every 4th night, stacks per tier) ────────── */
// A wave spawned on night 4, 8, 12 … gets +15% speed, +70% HP and +15% damage
// per tier (tier = night / 4). Night 2 (and every other wave) stays at base stats.
export const GOLEM_BUFF_HP_PER_TIER = 0.70;
export const GOLEM_BUFF_SPEED_PER_TIER = 0.15;
export const GOLEM_BUFF_DAMAGE_PER_TIER = 0.15;

/* ── AI tuning ───────────────────────────────────────────── */
export const GOLEM_ENGAGE_RANGE = 520;      // starts chasing inside this radius
export const GOLEM_HOME_TOLERANCE = 12;     // snap distance back at its post
export const GOLEM_SPEED = 74;              // px/sec (3% mais rápido que o base 72)

/* ── Hitbox & rendering ──────────────────────────────────── */
export const GOLEM_COLLIDER_HALF_W = 26;
export const GOLEM_COLLIDER_HALF_H = 22;

const FRAME_W = 90;
const FRAME_H = 64;
const RENDER_SCALE = 2.5;

/* ── Wave layout (explicit, no random coordinates) ───────── */
// 3 south, 2 north, 3 west — eight golems around the player's landing
// zone/cave entrance. All sit on open ground away from the obstacles,
// the player and each other. Blocked spots fall back to the nearest free tile.
export const GOLEM_WAVE_SPAWNS = {
    bottom: [{ x: 812, y: 1484 }, { x: 900, y: 1484 }, { x: 1000, y: 1484 }],
    top: [{ x: 1000, y: 250 }, { x: 880, y: 250 }],
    front: [{ x: 900, y: 350 }, { x: 800, y: 1150 }, { x: 1000, y: 350 }]
};

export const GOLEM_WAVE_SIZE =
    GOLEM_WAVE_SPAWNS.bottom.length +
    GOLEM_WAVE_SPAWNS.top.length +
    GOLEM_WAVE_SPAWNS.front.length;

export const GOLEM_STATES = {
    IDLE: 'idle',
    WALK: 'walk',
    ATTACK: 'attack',
    HURT: 'hurt',
    DIE: 'die'
};

const BASE_PATH = './src/assets/sprites/Enemies/Normal/Golem/';

const ANIM_CONFIG = {
    idle: { folder: 'Golem_1_idle', prefix: 'Golem_1_idle', frames: 8, speed: 0.14, loop: true },
    walk: { folder: 'Golem_1_walk', prefix: 'Golem_1_walk', frames: 10, speed: 0.12, loop: true },
    attack: { folder: 'Golem_1_attack', prefix: 'Golem_1_attack', frames: 11, speed: 0.07, loop: false },
    hurt: { folder: 'Golem_1_hurt', prefix: 'Golem_1_hurt', frames: 4, speed: 0.10, loop: false },
    die: { folder: 'Golem_1_die', prefix: 'Golem_1_die', frames: 13, speed: 0.11, loop: false }
};

function framePath(state, index) {
    const cfg = ANIM_CONFIG[state];
    const n = String(index + 1).padStart(2, '0');
    return `${BASE_PATH}${cfg.folder}/${cfg.prefix}_${n}.png`;
}

// state -> HTMLImageElement[] (loaded once, shared by every golem)
const frameCache = new Map();

/** Warm the cache once at startup; the first wave is minutes away. */
export function preloadGolemSprites() {
    if (typeof Image === 'undefined') return;
    for (const state of Object.keys(ANIM_CONFIG)) {
        if (frameCache.has(state)) continue;
        const cfg = ANIM_CONFIG[state];
        const frames = [];
        for (let i = 0; i < cfg.frames; i++) {
            const img = new Image();
            img.src = framePath(state, i);
            frames.push(img);
        }
        frameCache.set(state, frames);
    }
}

function getFrame(state, index) {
    const frames = frameCache.get(state);
    if (!frames) return null;
    const img = frames[Math.min(index, frames.length - 1)];
    return img && img.complete && img.naturalWidth > 0 ? img : null;
}

export class Golem {
    constructor(x = 0, y = 0, buffTier = 0) {
        this.x = x;
        this.y = y;
        this.homeX = x;
        this.homeY = y;
        this.vx = 0;
        this.vy = 0;

        // Identity / allegiance (read by the engine's team rules)
        this.team = 'enemy';
        this.role = 'enemy';
        this.name = 'GOLEM';

        // Wave buff: every 4th-night wave comes back stronger.
        // tier 0 -> base stats; tier 1 -> +15% speed, +70% HP, +15% damage; …
        const hpMul = 1 + GOLEM_BUFF_HP_PER_TIER * buffTier;
        const speedMul = 1 + GOLEM_BUFF_SPEED_PER_TIER * buffTier;
        const dmgMul = 1 + GOLEM_BUFF_DAMAGE_PER_TIER * buffTier;
        this.speedMul = speedMul;
        this.attackDamage = Math.round(GOLEM_ATTACK_DAMAGE * dmgMul);

        // Health
        this.maxHp = Math.round(GOLEM_MAX_HP * hpMul);
        this.hp = this.maxHp;
        this.isDead = false;
        this.shouldRemove = false;

        // Collision profile (resolver injected per map by the engine)
        this.colliderHalfW = GOLEM_COLLIDER_HALF_W;
        this.colliderHalfH = GOLEM_COLLIDER_HALF_H;
        this.collisionResolver = null;
        this.worldBounds = null;

        // Animation
        this.state = GOLEM_STATES.IDLE;
        this.currentFrame = 0;
        this.animTime = 0;

        // Combat
        this.attackCooldown = 0;
        this.attackHitApplied = false;
        this._attackTarget = null;
        this._playerNear = false;

        // Presentation
        this._facing = 1;
        this._hpBarTimer = 0;
    }

    setCollisionResolver(resolver) {
        this.collisionResolver = resolver;
    }

    setWorldBounds(bounds) {
        this.worldBounds = bounds;
    }

    /* ── AI ──────────────────────────────────────────────── */
    updateAi(dt, engine) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.state === GOLEM_STATES.DIE || this.state === GOLEM_STATES.HURT) return;
        if (this.state === GOLEM_STATES.ATTACK) return; // busy swinging

        const player = engine ? engine.player : null;
        if (!player || player.isDead) {
            this._playerNear = false;
            this._stopAndIdle();
            return;
        }

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        this._playerNear = dist <= 260;
        this._facing = dx < 0 ? -1 : 1;

        // In reach: attack on cooldown, otherwise hold position.
        if (dist <= GOLEM_ATTACK_RANGE) {
            this._stopAndIdle();
            if (this.attackCooldown <= 0) this._startAttack(player);
            return;
        }

        // Chase the player.
        if (dist <= GOLEM_ENGAGE_RANGE) {
            this._moveDir(dx / dist, dy / dist, dt);
            return;
        }

        // Leash: walk back to the post, then idle.
        const hx = this.homeX - this.x;
        const hy = this.homeY - this.y;
        const hd = Math.hypot(hx, hy);
        if (hd > GOLEM_HOME_TOLERANCE) {
            this._moveDir(hx / hd, hy / hd, dt);
        } else {
            this._stopAndIdle();
        }
    }

    _moveDir(nx, ny, dt) {
        this.vx = nx * GOLEM_SPEED * this.speedMul;
        this.vy = ny * GOLEM_SPEED * this.speedMul;
        this._setState(GOLEM_STATES.WALK);
    }

    _stopAndIdle() {
        this.vx = 0;
        this.vy = 0;
        this._setState(GOLEM_STATES.IDLE);
    }

    _startAttack(player) {
        this._attackTarget = player;
        this.attackHitApplied = false;
        this.attackCooldown = GOLEM_ATTACK_COOLDOWN;
        this.vx = 0;
        this.vy = 0;
        this._setState(GOLEM_STATES.ATTACK, true);
    }

    _setState(state, force = false) {
        if (this.state === GOLEM_STATES.DIE && !force) return;
        if (this.state === state) return;
        this.state = state;
        this.currentFrame = 0;
        this.animTime = 0;
    }

    /* ── Damage ──────────────────────────────────────────── */
    takeDamage(amount = GOLEM_ATTACK_DAMAGE, fromX = null, fromY = null) {
        if (this.isDead || this.state === GOLEM_STATES.DIE) return;

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
            this._setState(GOLEM_STATES.DIE, true);
        } else {
            this._setState(GOLEM_STATES.HURT, true);
        }
    }

    /* ── Simulation ──────────────────────────────────────── */
    update(dt) {
        if (this._hpBarTimer > 0) this._hpBarTimer -= dt;

        this._advanceAnimation(dt);

        // Knockback friction while stunned.
        if (this.state === GOLEM_STATES.HURT) {
            const decay = Math.max(0, 1 - dt * 6);
            this.vx *= decay;
            this.vy *= decay;
        }

        // Apply the melee hit once, mid-swing.
        if (
            this.state === GOLEM_STATES.ATTACK &&
            !this.attackHitApplied &&
            this.currentFrame >= 5
        ) {
            this.attackHitApplied = true;
            const target = this._attackTarget;
            if (target && !target.isDead && typeof target.takeDamage === 'function') {
                const reach = GOLEM_ATTACK_RANGE + 16;
                if (Math.hypot(target.x - this.x, target.y - this.y) <= reach) {
                    target.takeDamage(this.attackDamage, this.x, this.y);
                }
            }
        }

        if (this.state === GOLEM_STATES.DIE) return;

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
        while (this.animTime >= cfg.speed) {
            this.animTime -= cfg.speed;

            if (this.currentFrame < cfg.frames - 1) {
                this.currentFrame += 1;
                continue;
            }

            if (cfg.loop) {
                this.currentFrame = 0;
                continue;
            }

            // One-shot finished.
            if (this.state === GOLEM_STATES.DIE) {
                this.currentFrame = cfg.frames - 1;
                this.shouldRemove = true; // removed only after the death anim
            } else {
                this._setState(GOLEM_STATES.IDLE, true);
            }
            break;
        }
    }

    /* ── Rendering ───────────────────────────────────────── */
    render(ctx, camera) {
        const screen = camera.worldToScreen(this.x, this.y);
        const cfg = ANIM_CONFIG[this.state];
        const img = getFrame(this.state, this.currentFrame);

        const fw = FRAME_W * RENDER_SCALE;
        const fh = FRAME_H * RENDER_SCALE;
        // The artwork is bottom-anchored, so pin the feet to the bottom of the
        // hitbox and let the body rise above it.
        const feetY = screen.y + this.colliderHalfH;
        const drawY = Math.round(feetY - fh);

        // Ground shadow.
        ctx.save();
        ctx.fillStyle = 'rgba(10, 5, 5, 0.45)';
        ctx.beginPath();
        ctx.ellipse(screen.x, feetY - 2, 24, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.translate(screen.x, 0);
        if (this._facing < 0) ctx.scale(-1, 1);
        if (img) {
            ctx.drawImage(img, Math.round(-fw / 2), drawY, Math.round(fw), Math.round(fh));
        } else {
            ctx.fillStyle = '#6b6b78';
            ctx.fillRect(Math.round(-fw / 2), drawY, Math.round(fw), Math.round(fh));
        }
        ctx.restore();

        this._renderHealthBar(ctx, screen.x, drawY);
    }

    _renderHealthBar(ctx, centerX, topY) {
        if (this.hp >= this.maxHp && this._hpBarTimer <= 0 && !this._playerNear) return;

        const barW = 46;
        const barH = 5;
        const x = Math.round(centerX - barW / 2);
        const y = Math.round(topY + 6);

        ctx.save();
        ctx.fillStyle = 'rgba(5, 5, 11, 0.8)';
        ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);
        ctx.fillStyle = '#3a1010';
        ctx.fillRect(x, y, barW, barH);

        const pct = Math.max(0, this.hp / this.maxHp);
        if (pct > 0) {
            ctx.fillStyle = pct > 0.4 ? '#5ad85a' : '#e62424';
            ctx.fillRect(x, y, Math.round(barW * pct), barH);
        }
        ctx.restore();
    }
}
