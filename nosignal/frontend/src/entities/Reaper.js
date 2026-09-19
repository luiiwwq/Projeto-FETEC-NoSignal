/**
 * Reaper.js
 * Esqueleto hostil invocado pelo Necromancer na Sala do Rei.
 *
 * Usa as frames já recortadas de Animation_Sprite_Sheets_recortados (uma
 * imagem por frame). Implementa a mesma interface de ator do motor
 * (team / role / updateAi / update / render / takeDamage / isDead /
 * shouldRemove) para entrar na lista compartilhada `actors`.
 */

/* ── Combate ─────────────────────────────────────────────── */
export const REAPER_MAX_HP = 150;
export const REAPER_ATTACK_DAMAGE = 20;
export const REAPER_ATTACK_COOLDOWN = 1.2;
export const REAPER_ATTACK_RANGE = 42;
export const REAPER_ENGAGE_RANGE = 520;
export const REAPER_SPEED = 85;
export const REAPER_HIT_FRAME = 5;

/* ── Hitbox & render ─────────────────────────────────────── */
export const REAPER_COLLIDER_HALF_W = 16;
export const REAPER_COLLIDER_HALF_H = 24;
// Scale 2 = 96px (1,5x menor que os 144px originais).
export const REAPER_RENDER_SCALE = 2;
export const REAPER_FRAME_DURATION = 0.08;

export const REAPER_STATES = {
    IDLE: 'idle',
    RUN: 'run',
    ATTACK: 'attack',
    DIE: 'die',
};

/* ── Animações (frames recortadas) ───────────────────────── */
const SPRITE_BASE = './src/assets/sprites/Enemies/Normal/Reaper/Animation_Sprite_Sheets_recortados/';

const ANIM_CONFIG = {
    idle:   { dir: 'HostileIdleReaper',    frames: 5,  loop: true },
    run:    { dir: 'HostileRunningReaper', frames: 8,  loop: true },
    attack: { dir: 'HostileAttackReaper',  frames: 10, loop: false },
};

/* state -> HTMLImageElement[] */
const imageCache = new Map();

/** Warm the reaper cut-frames once at startup. */
export function preloadReaperSprites() {
    if (typeof Image === 'undefined') return;
    for (const state of Object.keys(ANIM_CONFIG)) {
        if (imageCache.has(state)) continue;
        const cfg = ANIM_CONFIG[state];
        const list = [];
        for (let i = 1; i <= cfg.frames; i++) {
            const img = new Image();
            img.src = `${SPRITE_BASE}${cfg.dir}/${cfg.dir}_${String(i).padStart(2, '0')}.png`;
            list.push(img);
        }
        imageCache.set(state, list);
    }
}

function getImages(state) {
    const imgs = imageCache.get(state);
    return imgs && imgs.length > 0 && imgs[0].complete && imgs[0].naturalWidth > 0 ? imgs : null;
}

export class Reaper {
    /**
     * @param {number} x  centro x do collider (posição local da Sala do Rei)
     * @param {number} y  centro y do collider (pés = y + colliderHalfH)
     * @param {object} options
     */
    constructor(x = 0, y = 0, { id = null } = {}) {
        this.id = id;
        this.x = x;
        this.y = y;

        this.team = 'enemy';
        this.role = 'enemy';
        this.name = 'REAPER';

        this.maxHp = REAPER_MAX_HP;
        this.hp = this.maxHp;
        this.isDead = false;
        this.shouldRemove = false;

        this.colliderHalfW = REAPER_COLLIDER_HALF_W;
        this.colliderHalfH = REAPER_COLLIDER_HALF_H;
        this.collisionResolver = null;
        this.worldBounds = null;

        this.state = REAPER_STATES.IDLE;
        this.currentFrame = 0;
        this.animTime = 0;

        this.attackDamage = REAPER_ATTACK_DAMAGE;
        this.attackCooldown = 0;
        this.attackHitApplied = false;
        this._attackTarget = null;
        this._playerNear = false;

        this._facing = 1;
        this._hpBarTimer = 0;
        this._dieTimer = 0;
    }

    setCollisionResolver(resolver) {
        this.collisionResolver = resolver;
    }

    setWorldBounds(bounds) {
        this.worldBounds = bounds;
    }

    /* ── IA ──────────────────────────────────────────────── */
    updateAi(dt, engine) {
        if (this.attackCooldown > 0) this.attackCooldown -= dt;
        if (this.state === REAPER_STATES.DIE) return;
        if (this.state === REAPER_STATES.ATTACK) return;

        const player = engine ? engine.player : null;
        if (!player || player.isDead) {
            this._stopAndIdle();
            return;
        }

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        this._facing = dx < 0 ? -1 : 1;
        this._playerNear = dist <= 260;

        if (dist <= REAPER_ATTACK_RANGE) {
            this._stopAndIdle();
            if (this.attackCooldown <= 0) {
                this._startAttack(player);
            }
            return;
        }

        if (dist <= REAPER_ENGAGE_RANGE) {
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

        this._stopAndIdle();
    }

    _moveDir(nx, ny, dt) {
        this.vx = nx * REAPER_SPEED;
        this.vy = ny * REAPER_SPEED;
        if (nx < 0) this._facing = -1;
        else if (nx > 0) this._facing = 1;
        this._setState(REAPER_STATES.RUN);
    }

    _separationForce(engine) {
        let sx = 0;
        let sy = 0;
        const list = engine && engine.reapers ? engine.reapers : null;
        if (!list) return { x: 0, y: 0, mag: 0 };
        for (const other of list) {
            if (other === this || other.isDead || other.shouldRemove) continue;
            const ddx = this.x - other.x;
            const ddy = this.y - other.y;
            const d = Math.hypot(ddx, ddy);
            const minD = this.colliderHalfW + other.colliderHalfW + 8;
            if (d > 0 && d < minD * 1.5) {
                const push = (minD * 1.5 - d) / (minD * 1.5);
                sx += (ddx / d) * push;
                sy += (ddy / d) * push;
            }
        }
        return { x: sx, y: sy, mag: Math.hypot(sx, sy) };
    }

    _stopAndIdle() {
        this.vx = 0;
        this.vy = 0;
        this._setState(REAPER_STATES.IDLE);
    }

    _startAttack(player) {
        this._attackTarget = player;
        this.attackHitApplied = false;
        this.attackCooldown = REAPER_ATTACK_COOLDOWN;
        this.vx = 0;
        this.vy = 0;
        this._setState(REAPER_STATES.ATTACK, true);
    }

    _setState(state, force = false) {
        if (this.state === REAPER_STATES.DIE && !force) return;
        if (this.state === state) return;
        this.state = state;
        this.currentFrame = 0;
        this.animTime = 0;
    }

    /* ── Dano ────────────────────────────────────────────── */
    takeDamage(amount = REAPER_ATTACK_DAMAGE, fromX = null, fromY = null) {
        if (this.isDead || this.state === REAPER_STATES.DIE) return;

        this.hp = Math.max(0, this.hp - amount);
        this._hpBarTimer = 6;

        if (fromX !== null && fromY !== null) {
            const angle = Math.atan2(this.y - fromY, this.x - fromX);
            this.vx += Math.cos(angle) * 90;
            this.vy += Math.sin(angle) * 90;
        }

        if (this.hp <= 0) {
            this.isDead = true;
            this.vx = 0;
            this.vy = 0;
            this._dieTimer = 0.45;
            this._setState(REAPER_STATES.DIE, true);
        }
    }

    /* ── Simulação ───────────────────────────────────────── */
    update(dt) {
        if (this._hpBarTimer > 0) this._hpBarTimer -= dt;

        this._advanceAnimation(dt);

        if (this.state === REAPER_STATES.DIE) {
            this._dieTimer -= dt;
            if (this._dieTimer <= 0) this.shouldRemove = true;
            return;
        }

        if (
            this.state === REAPER_STATES.ATTACK &&
            !this.attackHitApplied &&
            this.currentFrame >= REAPER_HIT_FRAME
        ) {
            this.attackHitApplied = true;
            const target = this._attackTarget;
            if (target && !target.isDead && typeof target.takeDamage === 'function') {
                const reach = REAPER_ATTACK_RANGE + 16;
                if (Math.hypot(target.x - this.x, target.y - this.y) <= reach) {
                    target.takeDamage(this.attackDamage, this.x, this.y);
                }
            }
        }

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
        while (this.animTime >= REAPER_FRAME_DURATION) {
            this.animTime -= REAPER_FRAME_DURATION;

            if (this.currentFrame < cfg.frames - 1) {
                this.currentFrame += 1;
                continue;
            }

            if (cfg.loop) {
                this.currentFrame = 0;
                continue;
            }

            if (this.state === REAPER_STATES.ATTACK) {
                this._setState(REAPER_STATES.IDLE, true);
            }
            break;
        }
    }

    /* ── Render ──────────────────────────────────────────── */
    render(ctx, camera) {
        // A morte não tem frames próprias: usa o Idle para o fade-out.
        const state = this.state === REAPER_STATES.DIE ? REAPER_STATES.IDLE : this.state;
        const screen = camera.worldToScreen(this.x, this.y);
        const cfg = ANIM_CONFIG[state];
        const imgs = getImages(state);

        const drawW = 48 * REAPER_RENDER_SCALE;
        const drawH = 48 * REAPER_RENDER_SCALE;
        const feetY = screen.y + this.colliderHalfH;
        const drawY = Math.round(feetY - drawH);

        // Sombra no chão.
        ctx.save();
        ctx.fillStyle = 'rgba(5, 2, 8, 0.45)';
        ctx.beginPath();
        ctx.ellipse(screen.x, feetY - 3, 24, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        if (this.state === REAPER_STATES.DIE) {
            ctx.globalAlpha = Math.max(0, Math.min(1, this._dieTimer / 0.45));
        }
        ctx.imageSmoothingEnabled = false;
        ctx.translate(screen.x, 0);
        if (this._facing < 0) ctx.scale(-1, 1);

        if (imgs) {
            const srcIndex = Math.min(this.currentFrame, cfg.frames - 1);
            ctx.drawImage(
                imgs[srcIndex],
                Math.round(-drawW / 2),
                drawY,
                drawW,
                drawH
            );
        } else {
            ctx.fillStyle = '#2a2a35';
            ctx.fillRect(Math.round(-drawW / 2), drawY, drawW, drawH);
        }
        ctx.restore();

        this._renderHealthBar(ctx, screen.x, drawY);
    }

    _renderHealthBar(ctx, centerX, topY) {
        if (this.hp >= this.maxHp && this._hpBarTimer <= 0 && !this._playerNear) return;

        const barW = 30;
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