// Detecção de força bruta: janela deslizante de falhas de login por IP e por conta, com bloqueio temporário.
export class BruteForceDetector {
  constructor({ windowMs = 5 * 60_000, maxPerIp = 5, maxPerUser = 8, blockMs = 10 * 60_000 } = {}) {
    Object.assign(this, { windowMs, maxPerIp, maxPerUser, blockMs });
    this.failures = []; // { ts, ip, user }
    this.blocked = new Map(); // ip -> até quando
  }

  prune(now) {
    this.failures = this.failures.filter((f) => now - f.ts < this.windowMs);
    for (const [ip, until] of this.blocked) if (until < now) this.blocked.delete(ip);
  }

  isBlocked(ip, now = Date.now()) {
    this.prune(now);
    return this.blocked.has(ip);
  }

  recordFailure(ip, user, now = Date.now()) {
    this.prune(now);
    this.failures.push({ ts: now, ip, user });
    const countIp = this.failures.filter((f) => f.ip === ip).length;
    const countUser = this.failures.filter((f) => f.user === user).length;
    let newlyBlocked = false;
    if (countIp >= this.maxPerIp && !this.blocked.has(ip)) {
      this.blocked.set(ip, now + this.blockMs);
      newlyBlocked = true;
    }
    return { countIp, countUser, newlyBlocked, userTargeted: countUser >= this.maxPerUser };
  }

  recordSuccess(ip) {
    this.failures = this.failures.filter((f) => f.ip !== ip);
  }

  summary(now = Date.now()) {
    this.prune(now);
    const byIp = {};
    const byUser = {};
    for (const f of this.failures) {
      byIp[f.ip] = (byIp[f.ip] || 0) + 1;
      byUser[f.user] = (byUser[f.user] || 0) + 1;
    }
    return {
      total: this.failures.length,
      byIp: Object.entries(byIp).map(([ip, count]) => ({ ip, count, blocked: this.blocked.has(ip) })).sort((a, b) => b.count - a.count),
      byUser: Object.entries(byUser).map(([user, count]) => ({ user, count })).sort((a, b) => b.count - a.count),
      blocked: [...this.blocked].map(([ip, until]) => ({ ip, until })),
    };
  }
}

export const bruteForce = new BruteForceDetector();
