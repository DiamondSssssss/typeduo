/**
 * Shared context passed to every attack on start/tick/end.
 * Wraps game state, boss config, and socket room for clean attack modules.
 */
class AttackContext {
  /**
   * @param {object} opts
   * @param {object} opts.game       - Full room.game state
   * @param {object} opts.bossConfig - Boss module from bosses/
   * @param {number} opts.phase      - HP phase 0|1|2
   * @param {object} opts.io         - Socket.IO server
   * @param {object} opts.room       - Room object (code, players, game)
   * @param {number} opts.now        - Date.now()
   * @param {number} opts.deltaMs    - Tick delta in ms
   */
  constructor({ game, bossConfig, phase, io, room, now, deltaMs }) {
    this.game       = game;
    this.boss       = game.boss;
    this.char       = game.character;
    this.bossConfig = bossConfig;
    this.phase      = phase;
    this.io         = io;
    this.room       = room;
    this.now        = now;
    this.deltaMs    = deltaMs;
    this.speed      = bossConfig.projSpeed?.[phase] ?? 180;
  }

  get combat() {
    if (!this.game._combat) {
      this.game._combat = { state: "idle", currentId: null, startedAt: 0, cooldowns: {}, data: {} };
    }
    return this.game._combat;
  }

  /** Distance from boss center to player. */
  distToPlayer() {
    const dx = this.char.x - this.boss.x;
    const dy = this.char.y - this.boss.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  emit(event, data = {}) {
    this.io.to(this.room.code).emit(event, { ...data, bossId: this.bossConfig.id });
  }

  /** Boss cannot take word damage while invulnerable (ultimate wind-up). */
  setBossInvulnerable(untilMs) {
    this.game.bossInvulnUntil = untilMs;
  }

  isBossInvulnerable() {
    return (this.game.bossInvulnUntil || 0) > this.now;
  }

  lockBossMovement(lock = true) {
    this.boss.combatLockMove = lock;
    if (lock) {
      this.boss.targetX = this.boss.x;
      this.boss.targetY = this.boss.y;
      this.boss.nextMoveAt = this.now + 60000;
    } else {
      this.boss.nextMoveAt = this.now;
    }
  }
}

module.exports = { AttackContext };
