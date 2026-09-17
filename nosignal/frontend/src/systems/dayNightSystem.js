/**
 * dayNightSystem.js
 * Global day/night cycle for No Signal.
 *
 * The cycle is time based (driven by the game loop `dt`, never by
 * setInterval) and lives for the whole play session: it is NOT reset when the
 * player changes maps, so a night that started on the surface keeps ticking
 * while the player is inside a cave. Only `reset()` (a new game session)
 * restarts it on day 1.
 *
 *   day  (80s) ──► night (80s) ──► day ──► night ...
 *
 * Every full period is a "cycle". Every transition into night increments
 * `nightCount`. The golem wave is scheduled on every third night (3, 6, 9 …).
 */

export const DAY_NIGHT_DURATION = 80; // seconds per period (day or night)

export const DAY_NIGHT_PERIOD = {
    DAY: 'day',
    NIGHT: 'night'
};

// Master switch for the "golem wave every third night" rule.
export const SPAWN_WAVE_EVERY_THIRD_NIGHT = true;

export class DayNightSystem {
    constructor() {
        this.reset();
    }

    reset() {
        this.period = DAY_NIGHT_PERIOD.DAY;
        this.remainingTime = DAY_NIGHT_DURATION;
        this.elapsedTime = 0;
        this.cycleCount = 0;
        this.nightCount = 0;
        this.waveCount = 0;
        this.lastEvent = null;
    }

    /**
     * Advance the clock.
     * @param {number} dt seconds since the last frame
     * @returns {{type:'day-start'|'night-start', nightCount:number}|null}
     *          the transition that happened this frame, or null.
     */
    update(dt) {
        if (!(dt > 0)) return null;

        this.elapsedTime += dt;
        this.remainingTime -= dt;

        let event = null;

        // Loop (instead of a single `if`) so a huge dt can never make the
        // timer go negative: it consumes whole periods until it lands inside
        // the current one. In practice dt is capped at 0.1s by the engine.
        while (this.remainingTime <= 0) {
            this.remainingTime += DAY_NIGHT_DURATION;
            this.cycleCount += 1;

            if (this.period === DAY_NIGHT_PERIOD.DAY) {
                this.period = DAY_NIGHT_PERIOD.NIGHT;
                this.nightCount += 1;
                event = { type: 'night-start', nightCount: this.nightCount };
            } else {
                this.period = DAY_NIGHT_PERIOD.DAY;
                event = { type: 'day-start', nightCount: this.nightCount };
            }
        }

        this.lastEvent = event;
        return event;
    }

    /** Whole seconds left in the current period, never negative. */
    getRemainingSeconds() {
        return Math.max(0, Math.ceil(this.remainingTime));
    }

    /** Snapshot consumed by the HUD / global state. */
    getHudState() {
        return {
            period: this.period,
            remainingTime: Math.max(0, this.remainingTime),
            nightCount: this.nightCount,
            waveCount: this.waveCount
        };
    }
}

/** Format whole seconds as MM:SS with a two-digit seconds field. */
export function formatDayNightTime(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
