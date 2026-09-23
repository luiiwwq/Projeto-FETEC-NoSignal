/**
 * SkeletonWarrior.js
 * Undead warrior that patrols the Martian Catacombs — the direct replacement
 * for the old Skeleton_Axe group (same 5 posts, similar melee profile).
 *
 * Implements the same enemy interface the engine drives for the other
 * skeletons (team / role / colliderHalfW,H / updateAi / update / render /
 * takeDamage / isDead / shouldRemove), so the warriors join the shared
 * `actors` array with zero changes to the enemy loop.
 *
 * Animation frames come from the Skeleton_Warrior sheets (Craftpix, same pack
 * as the Skeleton_Spearman): every file is a single 128×128 frame named
 * <State>_<NN>.png. The artwork is bottom-anchored (feet reach the frame
 * bottom), so the feet are pinned to the bottom of the hitbox when rendering.
 *
 *   Idle 7f · Walk 7f · Attack_1 (slash) 5f · Protect (react) 1f ·
 *   Hurt 2f · Dead 4f
 */

/* ── Combat tuning (mesmo perfil do antigo Skeleton_Axe) ── */
export const WARRIOR_MAX_HP = 150;
export const WARRIOR_ATTACK_DAMAGE = 40;
export const WARRIOR_ATTACK_COOLDOWN = 1.0;   // seconds between swings
export const WARRIOR_ATTACK_RANGE = 42;       // centre-to-centre melee reach
export const WARRIOR_ENGAGE_RANGE = 650;      // starts chasing inside this radius
export const WARRIOR_SPEED = 70;              // px/sec

/* ── Hitbox & rendering (1.5x em relação ao 128px base) ─── */
export const WARRIOR_COLLIDER_HALF_W = 18;
export const WARRIOR_COLLIDER_HALF_H = 21;
export const WARRIOR_RENDER_SCALE = 1.5;      // 128px frames -> 192px, corpo ~120px

/* ── Local spawn layout (CATACOMBS coordinate space) ───────
 * Os 3 postos são os mesmos dos antigos Skeleton_Axe (os 3 primeiros, mais
 * próximos da entrada), em coordenadas LOCAIS do `mars-catacombs` (1254×1254).
 * Não são world/surface coordinates — o motor spawna o guerreiro com
 * spawn.x/spawn.y diretamente como posição dos pés nas Catacumbas.          */
export const CATACOMBS_SKELETON_WARRIOR_SPAWNS = [
    { id: 'catacombs-skeleton-warrior-1', x: 940, y: 374 },
    { id: 'catacombs-skeleton-warrior-2', x: 1050, y: 498 },
    { id: 'catacombs-skeleton-warrior-3', x: 931, y: 671 },
];

export const WARRIOR_STATES = {
    IDLE: 'idle',
    WALK: 'walk',
    ATTACK: 'attack',
    REACT: 'react',
    HURT: 'hurt',
    DIE: 'die'
};

/* ── Animation sheets ────────────────────────────────────── */
// Cada arquivo é um frame único 128×128 dentro da pasta do estado.
const SPRITE_BASE = './src/assets/sprites/Enemies/Normal/Skeleton_Warrior/';

const ANIM_CONFIG = {
    idle:   { dir: 'Idle',    frames: 7, loop: true },
    walk:   { dir: 'Walk',    frames: 7, loop: true },
    attack: { dir: 'Attack_1', frames: 5, loop: false },
    react:  { dir: 'Protect', frames: 1, loop: false },
    hurt:   { dir: 'Hurt',    frames: 2, loop: false },
    die:    { dir: 'Dead',    frames: 4, loop: false },
};

// A espada atinge no meio do golpe (frame 2 do Attack_1).
const ATTACK_HIT_FRAME = 2;

const FRAME_DURATION = 0.11; // 110 ms por frame

// state -> HTMLImageElement[] (frames do estado, compartilhadas por todos)
const frameCache = new Map();

/** Warm the frame cache once at startup. */
export function preloadSkeletonWarriorSprites() {
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

export class SkeletonWarrior {
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
        this.name = 'SKELETON_WARRIOR';

        // Health
        this.maxHp = WARRIOR_MAX_HP;
        this.hp = this.maxHp;
        this.isDead = false;
        this.shouldRemove = false;

        // Collision profile (resolver injected per map by the engine)
        this.colliderHalfW = WARRIOR_COLLIDER_HALF_W;
        this.colliderHalfH = WARRIOR_COLLIDER_HALF_H;
        this.collisionResolver = null;
        this.worldBounds = null;

        // Animation
        this.state = WARRIOR_STATES.IDLE;
        this.currentFrame = 0;
        this.animTime = 0;

        // Combat
        this.attackDamage = WARRIOR_ATTACK_DAMAGE;
        this.attackCooldown = 0;
        this.attackHitApplied = false;
        this._attackTarget = null;
        this._playerNear = false;
        this._reacted = false;

        // Presentation
        this._facing = 1;
        this._hpBarTimer = 0;

        // Movement personality (IA um pouco irregular — evita marcha exata)
        this.speedMul = 0.85 + Math.random() * 0.3;
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
        if (this.state === WARRIOR_STATES.DIE || this.state === WARRIOR_STATES.HURT) return;
        if (this.state === WARRIOR_STATES.ATTACK) return; // busy swinging

        const player = engine ? engine.player : null;
        if (!player || player.isDead) {
            this._playerNear = false;
            this._stopAndIdle();
            return;
        }

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;

        // First spot: play the short one-shot "react" burst (Protect), then
        // go back to the normal chase/idle loop on the following frames.
        if (!this._reacted && dist <= WARRIOR_ENGAGE_RANGE) {
            this._reacted = true;
            this._facing = dx < 0 ? -1 : 1;
            this.vx = 0;
            this.vy = 0;
            this._setState(WARRIOR_STATES.REACT, true);
            return;
        }
        if (this.state === WARRIOR_STATES.REACT) {
            this.vx = 0;
            this.vy = 0;
            return;
        }

        this._playerNear = dist <= 260;
        this._facing = dx < 0 ? -1 : 1;

        // In reach: attack on cooldown, otherwise spread to avoid clumping.
        if (dist <= WARRIOR_ATTACK_RANGE) {
            this._stopAndIdle();
            if (this.attackCooldown <= 0) {
                this._startAttack(player);
            } else {
                this._spreadFromNeighbors(engine);
            }
            return;
        }

        // Chase o jogador com separação: cada guerreiro mantém distância dos
        // colegas e se posiciona em volta do alvo.
        if (dist <= WARRIOR_ENGAGE_RANGE) {
            let moveX = dx / dist;
            let moveY = dy / dist;
            const sep = this._separationForce(engine);
            if (sep.mag > 0.001) {
                moveX += sep.x * 2.2;
                moveY += sep.y * 2.2;
                const m = Math.hypot(moveX, moveY) || 1;
                moveX /= m;
                moveY /= m;
            }
            this._moveDir(moveX, moveY, dt);
            return;
        }

        // Fora do alcance: não voltam mais ao posto — permanecem onde pararam.
        this._stopAndIdle();
    }

    _moveDir(nx, ny, dt) {
        this.vx = nx * WARRIOR_SPEED * this.speedMul;
        this.vy = ny * WARRIOR_SPEED * this.speedMul;
        if (nx < 0) this._facing = -1;
        else if (nx > 0) this._facing = 1;
        this._setState(WARRIOR_STATES.WALK);
    }

    // Empurra para longe dos esqueletos vizinhos (evita que se amontoem).
    _separationForce(engine) {
        let sx = 0;
        let sy = 0;
        const list = engine && engine.skeletons ? engine.skeletons : null;
        if (!list) return { x: 0, y: 0, mag: 0 };
        for (const other of list) {
            if (other === this || other.isDead || other.shouldRemove) continue;
            const ddx = this.x - other.x;
            const ddy = this.y - other.y;
            const d = Math.hypot(ddx, ddy);
            const minD = this.colliderHalfW + other.colliderHalfW + 10;
            if (d > 0 && d < minD * 1.5) {
                const push = (minD * 1.5 - d) / (minD * 1.5);
                sx += (ddx / d) * push;
                sy += (ddy / d) * push;
            }
        }
        return { x: sx, y: sy, mag: Math.hypot(sx, sy) };
    }

    // Enquanto espera o cooldown do ataque, afasta um pouco dos vizinhos.
    _spreadFromNeighbors(engine) {
        const sep = this._separationForce(engine);
        if (sep.mag > 0.001) {
            this._moveDir(sep.x / sep.mag, sep.y / sep.mag, 0);
        }
    }

    _stopAndIdle() {
        this.vx = 0;
        this.vy = 0;
        this._setState(WARRIOR_STATES.IDLE);
    }

    _startAttack(player) {
        this._attackTarget = player;
        this.attackHitApplied = false;
        this.attackCooldown = WARRIOR_ATTACK_COOLDOWN;
        this.vx = 0;
        this.vy = 0;
        this._setState(WARRIOR_STATES.ATTACK, true);
    }

    _setState(state, force = false) {
        if (this.state === WARRIOR_STATES.DIE && !force) return;
        if (this.state === state) return;
        this.state = state;
        this.currentFrame = 0;
        this.animTime = 0;
    }

    /* ── Damage ──────────────────────────────────────────── */
    takeDamage(amount = WARRIOR_ATTACK_DAMAGE, fromX = null, fromY = null) {
        if (this.isDead || this.state === WARRIOR_STATES.DIE) return;

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
            this._setState(WARRIOR_STATES.DIE, true);
        } else {
            this._setState(WARRIOR_STATES.HURT, true);
        }
    }

    /* ── Simulation ──────────────────────────────────────── */
    update(dt) {
        if (this._hpBarTimer > 0) this._hpBarTimer -= dt;

        this._advanceAnimation(dt);

        // Knockback friction while stunned.
        if (this.state === WARRIOR_STATES.HURT) {
            const decay = Math.max(0, 1 - dt * 6);
            this.vx *= decay;
            this.vy *= decay;
        }

        // Apply the slash once, mid-swing.
        if (
            this.state === WARRIOR_STATES.ATTACK &&
            !this.attackHitApplied &&
            this.currentFrame >= ATTACK_HIT_FRAME
        ) {
            this.attackHitApplied = true;
            const target = this._attackTarget;
            if (target && !target.isDead && typeof target.takeDamage === 'function') {
                const reach = WARRIOR_ATTACK_RANGE + 16;
                if (Math.hypot(target.x - this.x, target.y - this.y) <= reach) {
                    target.takeDamage(this.attackDamage, this.x, this.y);
                }
            }
        }

        if (this.state === WARRIOR_STATES.DIE) return;

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
            if (this.state === WARRIOR_STATES.DIE) {
                this.currentFrame = cfg.frames - 1;
                this.shouldRemove = true; // removed only after the death anim
            } else {
                this._setState(WARRIOR_STATES.IDLE, true);
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
        const drawW = Math.round(fw * WARRIOR_RENDER_SCALE);
        const drawH = Math.round(fh * WARRIOR_RENDER_SCALE);
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
