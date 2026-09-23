/**
 * CharacterActor.js
 * Reusable non-player character entity used for both the surface ally and
 * enemy NPCs. It reuses all of the Player rendering/animation/health/weapon
 * logic and only adds what NPCs need: identity, a team, and (for enemies) a
 * simple combat AI that mirrors the player's shooting behaviour.
 */

import { Player, PlayerState } from './Player.js';
import { getCharacter } from '../content/characters.js';

export const ActorRole = {
    ALLY: 'ally',
    ENEMY: 'enemy'
};

export class CharacterActor extends Player {
    constructor({ x = 0, y = 0, name = null, characterId = null, team = 'ally', role = 'ally' } = {}) {
        const profile = getCharacter(characterId);
        super(x, y, name || profile.label, profile.id);

        // Identity (kept explicit on every actor)
        this.characterId = profile.id;
        this.character = profile;
        this.animMap = profile.animations;
        this.weapon = profile.weapon;

        // Alignment
        this.team = team;
        this.role = role;
        this.isActor = true;
        this.blocksPlayer = false;

        // Combat statistics: enemies are tankier (150 HP) than the default 105.
        this.maxHp = role === ActorRole.ENEMY ? 150 : this.maxHp;
        this.hp = this.maxHp;

        // NPC combat ranges (only meaningful for enemies). Kept long enough
        // that enemies can shoot from a safer distance without rushing the
        // player from across the map.
        this.engageRange = role === ActorRole.ENEMY ? 800 : 0;
        this.attackRange = role === ActorRole.ENEMY ? 420 : 0;

        // Post position: the enemy leashes back here when the player leaves
        // its engage range instead of chasing forever.
        this.homeX = x;
        this.homeY = y;
        this.homeTolerance = 6;

        // Removal lifecycle after death
        this.shouldRemove = false;
        this._deadTimer = 1.4;
    }

    // Enemy AI: face/approach the player and fire within range.
    // Allies are stationary and never attack.
    updateAi(dt, engine) {
        if (this.role !== ActorRole.ENEMY || this.isDead) return;
        // NPC inimigo aguarda o jogador se aproximar para iniciar o diálogo;
        // não persegue nem ataca até todas as falas terminarem.
        if (this._dialoguePending) {
            this.vx = 0;
            this.vy = 0;
            this.setState(PlayerState.IDLE);
            return;
        }

        const target = engine.player;
        if (!target || target.isDead) {
            this.vx = 0;
            this.vy = 0;
            this.setState(PlayerState.IDLE);
            return;
        }

        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        const angle = Math.atan2(dy, dx);

        if (this.state === PlayerState.HURT) {
            this.vx = 0;
            this.vy = 0;
            return;
        }

        // Player is outside the engage range: walk back to the post and wait.
        // This keeps the enemy near its ship instead of chasing across the map.
        if (dist > this.engageRange) {
            const hx = this.homeX - this.x;
            const hy = this.homeY - this.y;
            const hd = Math.hypot(hx, hy);
            if (hd > this.homeTolerance) {
                const speed = this.baseSpeed * 0.6;
                this.vx = (hx / hd) * speed;
                this.vy = (hy / hd) * speed;
                this.updateDirectionFromAngle(Math.atan2(hy, hx));
                this.setState(PlayerState.RUNNING);
            } else {
                this.vx = 0;
                this.vy = 0;
                this.setState(PlayerState.IDLE);
            }
            return;
        }

        this.updateDirectionFromAngle(angle);

        if (dist > this.attackRange) {
            const speed = this.baseSpeed;
            this.vx = (dx / dist) * speed;
            this.vy = (dy / dist) * speed;
            this.setState(PlayerState.RUNNING);
        } else {
            this.vx = 0;
            this.vy = 0;
            this.setState(PlayerState.IDLE);
            if (this.shootCooldown <= 0 && this.state !== PlayerState.SHOOTING) {
                this.shoot(angle, engine);
            }
        }
    }

    update(dt) {
        super.update(dt);

        if (this.isDead) {
            this._deadTimer -= dt;
            if (this._deadTimer <= 0) this.shouldRemove = true;
        }
    }

    _renderNameTag(ctx, centerX, topY) {
        const isEnemy = this.role === ActorRole.ENEMY;
        const label = isEnemy ? `${this.name} · ENEMY` : `${this.name} · ALLY`;
        const border = isEnemy ? '#ff4d4d' : '#4dd2ff';
        const text = isEnemy ? '#ffd0d0' : '#d6f4ff';

        ctx.save();
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';

        const tagY = topY + 16 - this.jumpHeight;
        const textW = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(5, 5, 11, 0.78)';
        ctx.fillRect(centerX - textW / 2 - 6, tagY - 9, textW + 12, 13);
        ctx.strokeStyle = border;
        ctx.lineWidth = 1;
        ctx.strokeRect(centerX - textW / 2 - 6, tagY - 9, textW + 12, 13);

        ctx.fillStyle = text;
        ctx.fillText(label, centerX, tagY);
        ctx.restore();
    }
}
