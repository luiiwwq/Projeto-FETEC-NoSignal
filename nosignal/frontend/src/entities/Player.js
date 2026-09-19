/**
 * Player.js
 * Astronaut Playable Entity with 8-directional movement,
 * full state machine, pixel art rendering at 2x scale,
 * and mouse-aimed combat.
 */

import { assetLoader } from '../engine/AssetLoader.js';
import { Bullet } from './Bullet.js';
import { getCharacter } from '../content/characters.js';
import { gameState } from '../state/gameState.js';

const DIAGONAL_FALLBACK = {
    'south-east': ['south', 'east'],
    'south-west': ['south', 'west'],
    'north-east': ['north', 'east'],
    'north-west': ['north', 'west']
};

export const PlayerState = {
    IDLE: 'IDLE',
    RUNNING: 'RUNNING',
    SHOOTING: 'SHOOTING',
    PUNCHING: 'PUNCHING',
    JUMPING: 'JUMPING',
    HURT: 'HURT',
    DEAD: 'DEAD',
    FLOATING: 'FLOATING',
    PUSH_PULL: 'PUSH_PULL'
};

export class Player {
    constructor(x = 0, y = 0, name = 'ARES-1', characterId = null) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;

        // Character profile (native size, animation map, weapon profile).
        // The entity always knows which character it belongs to so multiple
        // characters (player, ally, enemy) can coexist.
        this.character = getCharacter(characterId || gameState.selectedCharacter);
        this.characterId = this.character.id;
        this.animMap = this.character.animations;
        this.weapon = this.character.weapon;

        // Combat alignment (overridden by CharacterActor for NPCs)
        this.team = 'player';
        this.role = 'player';

        // Cached direction resolution for clips that lack diagonal frames
        // (e.g., Ocstronaut metadata only ships the 4 cardinal directions)
        this._dirCache = new Map();

        // Visual & scale parameters
        this.nativeSize = this.character.nativeSize; // Native sprite frame size (per character)
        this.scale = 2;         // 2x upscale
        this.renderSize = this.nativeSize * this.scale;

        // State Machine
        this.state = PlayerState.IDLE;
        this.direction = 'south'; // south, south-east, east, north-east, north, north-west, west, south-west

        // Animation timing
        this.animTime = 0;
        this.currentFrame = 0;
        this.frameSpeed = 0.12; // Seconds per frame (idle default)

        // Movement stats
        this.baseSpeed = 160;   // px/sec
        this.sprintSpeed = 310; // px/sec (shifted)
        this.isSprinting = false;

        // Health & combat stats
        this.maxHp = 100;
        this.hp = 100;
        this.bulletDamage = this.weapon?.damage ?? 14;
        this.invulnerableTimer = 0;
        this.isDead = false;

        // Cooldowns
        this.shootCooldown = 0;
        this.punchCooldown = 0;
        this.recoilX = 0;
        this.recoilY = 0;

        // Jump mechanics
        this.jumpHeight = 0;
        this.jumpVelocity = 0;

        // Collision profile (injected by the GameEngine per map)
        this.colliderHalfW = 20;
        this.colliderHalfH = 22;
        this.collisionResolver = null;
        this.worldBounds = null;

        // Animation definitions and frame counts
        // The clip `name` comes from the character animation translation table;
        // `frames` acts as fallback when the loaded metadata is unavailable.
        this.animConfig = {
            [PlayerState.IDLE]: { name: this._animName(PlayerState.IDLE), frames: 4, speed: 0.16, loop: true },
            [PlayerState.RUNNING]: { name: this._animName(PlayerState.RUNNING), frames: 6, speed: 0.10, loop: true },
            [PlayerState.SHOOTING]: { name: this._animName(PlayerState.SHOOTING), frames: 11, speed: 0.05, loop: false },
            [PlayerState.PUNCHING]: { name: this._animName(PlayerState.PUNCHING), frames: 6, speed: 0.065, loop: false },
            [PlayerState.JUMPING]: { name: this._animName(PlayerState.JUMPING), frames: 8, speed: 0.08, loop: false },
            [PlayerState.HURT]: { name: this._animName(PlayerState.HURT), frames: 7, speed: 0.07, loop: false },
            [PlayerState.DEAD]: { name: this._animName(PlayerState.DEAD), frames: 11, speed: 0.09, loop: false },
            [PlayerState.FLOATING]: { name: this._animName(PlayerState.FLOATING), frames: 11, speed: 0.12, loop: true },
            [PlayerState.PUSH_PULL]: { name: this._animName(PlayerState.PUSH_PULL), frames: 6, speed: 0.11, loop: true }
        };
    }

    _animName(state) {
        return this.animMap[state] || 'Breathing_Idle';
    }

    _resolveSpriteDir(clipName, direction) {
        const cacheKey = `${clipName}|${direction}`;
        const cached = this._dirCache.get(cacheKey);
        if (cached) return cached;

        let resolved = direction;
        const candidates = DIAGONAL_FALLBACK[direction];
        if (candidates && assetLoader.getFrameCount(clipName, direction, this.characterId) === 0) {
            resolved = candidates.find((d) => assetLoader.getFrameCount(clipName, d, this.characterId) > 0) || candidates[0];
        }

        this._dirCache.set(cacheKey, resolved);
        return resolved;
    }

    _animFrameCount(state) {
        const clipName = this._animName(state);
        const dir = this._resolveSpriteDir(clipName, this.direction);
        const realCount = assetLoader.getFrameCount(clipName, dir, this.characterId);
        if (realCount > 0) return realCount;
        return this.animConfig[state]?.frames || 1;
    }

    setState(newState, force = false) {
        if (this.state === PlayerState.DEAD && !force) return;
        if (this.state === newState) return;

        // Priority validation: HURT and one-shot actions shouldn't be overridden by simple move
        if (!force) {
            if (this.state === PlayerState.HURT) return;
            if ((this.state === PlayerState.SHOOTING || this.state === PlayerState.PUNCHING || this.state === PlayerState.JUMPING)
                && (newState === PlayerState.IDLE || newState === PlayerState.RUNNING)) {
                return;
            }
        }

        this.state = newState;
        this.currentFrame = 0;
        this.animTime = 0;
    }

    updateDirectionFromAngle(angle) {
        // Convert radian angle to 8 directions
        let a = angle;
        while (a < 0) a += Math.PI * 2;
        while (a >= Math.PI * 2) a -= Math.PI * 2;

        const step = Math.PI / 4; // 45 degrees
        const index = Math.round(a / step) % 8;
        const dirs = [
            'east',
            'south-east',
            'south',
            'south-west',
            'west',
            'north-west',
            'north',
            'north-east'
        ];
        this.direction = dirs[index];
    }

    updateDirectionFromMovement(dx, dy) {
        if (dx === 0 && dy === 0) return;

        if (dy > 0) {
            if (dx > 0) this.direction = 'south-east';
            else if (dx < 0) this.direction = 'south-west';
            else this.direction = 'south';
        } else if (dy < 0) {
            if (dx > 0) this.direction = 'north-east';
            else if (dx < 0) this.direction = 'north-west';
            else this.direction = 'north';
        } else {
            if (dx > 0) this.direction = 'east';
            else if (dx < 0) this.direction = 'west';
        }
    }

    setCollisionResolver(resolver) {
        this.collisionResolver = resolver;
    }

    setWorldBounds(bounds) {
        this.worldBounds = bounds;
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.recoilX = 0;
        this.recoilY = 0;
    }

    handleInput(input, camera, bulletManager) {
        if (this.state === PlayerState.DEAD) return;

        // 1. Mouse Aiming & Combat Actions
        const screenPos = camera.worldToScreen(this.x, this.y);
        const aimAngle = Math.atan2(input.mouseY - screenPos.y, input.mouseX - screenPos.x);

        // Shoot Action (Left Click)
        if (input.mouseLeft && this.shootCooldown <= 0 && this.state !== PlayerState.HURT) {
            this.shoot(aimAngle, bulletManager);
        }

        // Punch Action (Right Click)
        if (input.mouseRight && this.punchCooldown <= 0 && this.state !== PlayerState.HURT) {
            this.punch(aimAngle);
        }

        // Jump Action (Spacebar)
        if (input.keys['Space'] && this.state !== PlayerState.JUMPING && this.state !== PlayerState.HURT) {
            this.jump();
        }

        // Movement input
        let moveX = 0;
        let moveY = 0;

        if (input.keys['KeyW'] || input.keys['ArrowUp']) moveY -= 1;
        if (input.keys['KeyS'] || input.keys['ArrowDown']) moveY += 1;
        if (input.keys['KeyA'] || input.keys['ArrowLeft']) moveX -= 1;
        if (input.keys['KeyD'] || input.keys['ArrowRight']) moveX += 1;

        this.isSprinting = !!input.keys['ShiftLeft'] || !!input.keys['ShiftRight'];

        // Normalize diagonal speed to avoid moving faster diagonally
        if (moveX !== 0 && moveY !== 0) {
            moveX *= Math.SQRT1_2;
            moveY *= Math.SQRT1_2;
        }

        const currentSpeed = this.isSprinting ? this.sprintSpeed : this.baseSpeed;
        this.vx = moveX * currentSpeed;
        this.vy = moveY * currentSpeed;

        // If not in a high-priority action state, update walking/idle
        const isActionActive = (this.state === PlayerState.SHOOTING ||
            this.state === PlayerState.PUNCHING ||
            this.state === PlayerState.JUMPING ||
            this.state === PlayerState.HURT ||
            this.state === PlayerState.FLOATING ||
            this.state === PlayerState.PUSH_PULL);

        if (!isActionActive) {
            if (moveX !== 0 || moveY !== 0) {
                this.updateDirectionFromMovement(moveX, moveY);
                this.setState(PlayerState.RUNNING);
            } else {
                this.setState(PlayerState.IDLE);
            }
        }
    }

    shoot(aimAngle, bulletManager) {
        const weapon = this.weapon || {};
        this.shootCooldown = weapon.cooldown ?? 0.22; // Cadence
        this.updateDirectionFromAngle(aimAngle);
        this.setState(PlayerState.SHOOTING, true);

        // Slight weapon recoil
        this.recoilX = -Math.cos(aimAngle) * 45;
        this.recoilY = -Math.sin(aimAngle) * 45;

        // Spawn bullet projectile(s)
        if (bulletManager) {
            const spawnDist = 24;
            const spawnX = this.x + Math.cos(aimAngle) * spawnDist;
            // Spawn from the upper body so south-facing bullets never
            // clip into the ground/collision box on the first frame.
            const spawnY = this.y - 20 + Math.sin(aimAngle) * spawnDist * 0.35;

            const bulletOpts = {
                team: this.team,
                owner: this,
                damage: this.weapon?.damage ?? this.bulletDamage
            };

            if (weapon.type === 'shotgun') {
                const pellets = weapon.pellets || 5;
                const spread = weapon.spread || 0;
                const step = pellets > 1 ? spread / (pellets - 1) : 0;
                for (let i = 0; i < pellets; i++) {
                    const offsetAngle = aimAngle - spread / 2 + step * i;
                    bulletManager.addBullet(new Bullet(spawnX, spawnY, offsetAngle, weapon.speed, weapon, bulletOpts));
                }
            } else {
                bulletManager.addBullet(new Bullet(spawnX, spawnY, aimAngle, weapon.speed, weapon, bulletOpts));
            }
        }
    }

    punch(aimAngle) {
        this.punchCooldown = 0.38;
        this.updateDirectionFromAngle(aimAngle);
        this.setState(PlayerState.PUNCHING, true);

        // Forward impulse for punch
        this.recoilX = Math.cos(aimAngle) * 70;
        this.recoilY = Math.sin(aimAngle) * 70;
    }

    jump() {
        this.jumpHeight = 0;
        this.jumpVelocity = 280;
        this.setState(PlayerState.JUMPING, true);
    }

    takeDamage(amount = 20, fromX = null, fromY = null) {
        if (this.state === PlayerState.DEAD || this.invulnerableTimer > 0) return;

        this.hp = Math.max(0, this.hp - amount);
        this.invulnerableTimer = 0.65; // Invulnerability window

        // Knockback away from source
        if (fromX !== null && fromY !== null) {
            const angle = Math.atan2(this.y - fromY, this.x - fromX);
            this.recoilX = Math.cos(angle) * 140;
            this.recoilY = Math.sin(angle) * 140;
        } else {
            this.recoilX = -Math.sin(Math.random() * Math.PI * 2) * 80;
            this.recoilY = -Math.cos(Math.random() * Math.PI * 2) * 80;
        }

        if (this.hp <= 0) {
            this.die();
        } else {
            this.setState(PlayerState.HURT, true);
        }
    }

    die() {
        this.hp = 0;
        this.isDead = true;
        this.vx = 0;
        this.vy = 0;
        this.setState(PlayerState.DEAD, true);
    }

    respawn(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.hp = this.maxHp;
        this.isDead = false;
        this.invulnerableTimer = 0.5;
        this.setState(PlayerState.IDLE, true);
    }

    update(dt) {
        // Cooldowns
        if (this.shootCooldown > 0) this.shootCooldown -= dt;
        if (this.punchCooldown > 0) this.punchCooldown -= dt;
        if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;

        // Recoil decay
        this.recoilX *= Math.max(0, 1 - dt * 10);
        this.recoilY *= Math.max(0, 1 - dt * 10);

        // Position update with velocity and recoil, resolved through
        // the injected collision resolver (walls + world bounds)
        if (this.state !== PlayerState.DEAD) {
            const dx = (this.vx + this.recoilX) * dt;
            const dy = (this.vy + this.recoilY) * dt;

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

        // Jump physics arc
        if (this.state === PlayerState.JUMPING || this.jumpHeight > 0) {
            this.jumpHeight += this.jumpVelocity * dt;
            this.jumpVelocity -= 900 * dt; // Gravity
            if (this.jumpHeight <= 0) {
                this.jumpHeight = 0;
                this.jumpVelocity = 0;
            }
        }

        // Animation frame progression
        this._updateAnimation(dt);
    }

    _updateAnimation(dt) {
        const config = this.animConfig[this.state];
        if (!config) return;

        const frameCount = this._animFrameCount(this.state);

        // Sprinting speeds up running animation
        let speed = config.speed;
        if (this.state === PlayerState.RUNNING && this.isSprinting) {
            speed *= 0.65;
        }

        this.animTime += dt;
        if (this.animTime >= speed) {
            this.animTime -= speed;
            this.currentFrame++;

            if (this.currentFrame >= frameCount) {
                if (config.loop) {
                    this.currentFrame = 0;
                } else {
                    // One-shot animation completed
                    if (this.state === PlayerState.DEAD) {
                        // Hold on the final frame of death
                        this.currentFrame = frameCount - 1;
                    } else {
                        // Return to IDLE or RUNNING
                        const isMoving = Math.abs(this.vx) > 1 || Math.abs(this.vy) > 1;
                        this.setState(isMoving ? PlayerState.RUNNING : PlayerState.IDLE, true);
                    }
                }
            }
        }
    }

    render(ctx, camera) {
        const screenPos = camera.worldToScreen(this.x, this.y);
        const config = this.animConfig[this.state];
        if (!config) return;

        // Fetch sprite frame from AssetLoader
        const clipName = this._animName(this.state);
        const spriteDir = this._resolveSpriteDir(clipName, this.direction);
        const frameImg = assetLoader.getFrame(clipName, spriteDir, this.currentFrame, this.characterId);

        // Visual flash during invulnerability i-frames
        if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer * 20) % 2 === 0) {
            ctx.globalAlpha = 0.45;
        }

        // Soft shadow underneath feet
        if (this.state !== PlayerState.DEAD && this.state !== PlayerState.FLOATING) {
            ctx.save();
            ctx.fillStyle = 'rgba(10, 5, 5, 0.45)';
            ctx.beginPath();
            ctx.ellipse(
                screenPos.x,
                screenPos.y + 22,
                Math.max(10, 24 - this.jumpHeight * 0.1),
                Math.max(4, 9 - this.jumpHeight * 0.04),
                0, 0, Math.PI * 2
            );
            ctx.fill();
            ctx.restore();
        }

        // Render player sprite at nativeSize x scale
        // Character is centered horizontally, feet grounded
        const renderW = this.renderSize;
        const renderH = this.renderSize;
        const drawX = Math.round(screenPos.x - renderW / 2);
        const drawY = Math.round(screenPos.y - renderH / 2 - this.jumpHeight);

        if (frameImg) {
            ctx.drawImage(frameImg, drawX, drawY, renderW, renderH);
        } else {
            // Fallback placeholder if frame is loading
            ctx.fillStyle = '#e07228';
            ctx.fillRect(drawX + 40, drawY + 30, 48, 68);
        }

        ctx.globalAlpha = 1.0;

        // Overhead Player Name Tag
        this._renderNameTag(ctx, screenPos.x, drawY);
    }

    _renderNameTag(ctx, centerX, topY) {
        ctx.save();
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';

        // Tag Background
        const tagY = topY + 16 - this.jumpHeight;
        const textW = ctx.measureText(this.name).width;
        ctx.fillStyle = 'rgba(5, 5, 11, 0.75)';
        ctx.fillRect(centerX - textW / 2 - 6, tagY - 9, textW + 12, 13);
        ctx.strokeStyle = '#e07228';
        ctx.lineWidth = 1;
        ctx.strokeRect(centerX - textW / 2 - 6, tagY - 9, textW + 12, 13);

        // Name text
        ctx.fillStyle = '#f6c885';
        ctx.fillText(this.name, centerX, tagY);
        ctx.restore();
    }
}
