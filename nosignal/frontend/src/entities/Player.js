/**
 * Player.js
 * Astronaut Playable Entity with 8-directional movement,
 * full state machine, pixel art rendering at 2x scale,
 * and mouse-aimed combat.
 */

import { assetLoader } from '../engine/AssetLoader.js';
import { Bullet } from './Bullet.js';

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
    constructor(x = 0, y = 0, name = 'ARES-1') {
        this.name = name;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;

        // Visual & scale parameters
        this.nativeSize = 64;   // Native sprite 64x64
        this.scale = 2;         // 2x upscale -> 128x128
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

        // Animation definitions and frame counts
        this.animConfig = {
            [PlayerState.IDLE]: { name: 'Breathing_Idle', frames: 4, speed: 0.16, loop: true },
            [PlayerState.RUNNING]: { name: 'Running', frames: 6, speed: 0.10, loop: true },
            [PlayerState.SHOOTING]: { name: 'Shooting', frames: 11, speed: 0.05, loop: false },
            [PlayerState.PUNCHING]: { name: 'Punch', frames: 6, speed: 0.065, loop: false },
            [PlayerState.JUMPING]: { name: 'Jumping', frames: 8, speed: 0.08, loop: false },
            [PlayerState.HURT]: { name: 'Hit_Knocked_Back', frames: 7, speed: 0.07, loop: false },
            [PlayerState.DEAD]: { name: 'Death_Animation', frames: 11, speed: 0.09, loop: false },
            [PlayerState.FLOATING]: { name: 'Floating', frames: 11, speed: 0.12, loop: true },
            [PlayerState.PUSH_PULL]: { name: 'Push_Pull', frames: 6, speed: 0.11, loop: true }
        };
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
        this.shootCooldown = 0.22; // Cadence
        this.updateDirectionFromAngle(aimAngle);
        this.setState(PlayerState.SHOOTING, true);

        // Slight weapon recoil
        this.recoilX = -Math.cos(aimAngle) * 45;
        this.recoilY = -Math.sin(aimAngle) * 45;

        // Spawn bullet projectile
        if (bulletManager) {
            const spawnDist = 24;
            const spawnX = this.x + Math.cos(aimAngle) * spawnDist;
            const spawnY = this.y + Math.sin(aimAngle) * spawnDist - 8; // near chest height
            bulletManager.addBullet(new Bullet(spawnX, spawnY, aimAngle));
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

        // Position update with velocity and recoil
        if (this.state !== PlayerState.DEAD) {
            this.x += (this.vx + this.recoilX) * dt;
            this.y += (this.vy + this.recoilY) * dt;

            // Clamp to world boundaries
            this.x = Math.max(-1550, Math.min(1550, this.x));
            this.y = Math.max(-1550, Math.min(1550, this.y));
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

        // Sprinting speeds up running animation
        let speed = config.speed;
        if (this.state === PlayerState.RUNNING && this.isSprinting) {
            speed *= 0.65;
        }

        this.animTime += dt;
        if (this.animTime >= speed) {
            this.animTime -= speed;
            this.currentFrame++;

            if (this.currentFrame >= config.frames) {
                if (config.loop) {
                    this.currentFrame = 0;
                } else {
                    // One-shot animation completed
                    if (this.state === PlayerState.DEAD) {
                        // Hold on the final frame of death
                        this.currentFrame = config.frames - 1;
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
        const frameImg = assetLoader.getFrame(config.name, this.direction, this.currentFrame);

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

        // Render astronaut sprite
        // Sprites are 64x64, drawn at 2x (128x128)
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
