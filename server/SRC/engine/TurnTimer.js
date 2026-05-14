export default class TurnTimer {
    constructor(timeoutMs = 15000, onExpire = null) {
        this.timeoutMs = Number(timeoutMs) > 0 ? Number(timeoutMs) : 15000;
        this.onExpire = typeof onExpire === 'function' ? onExpire : null;
        this.timer = null;
        this.startedAt = null;
    }

    start() {
        this.stop();
        this.startedAt = Date.now();
        this.timer = setTimeout(() => {
            this.timer = null;
            if (this.onExpire) {
                this.onExpire();
            }
        }, this.timeoutMs);
        return this;
    }

    stop() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.startedAt = null;
        return this;
    }

    reset() {
        return this.start();
    }

    isRunning() {
        return this.timer !== null;
    }

    remaining() {
        if (!this.startedAt) return 0;
        const elapsed = Date.now() - this.startedAt;
        return Math.max(0, this.timeoutMs - elapsed);
    }
}
