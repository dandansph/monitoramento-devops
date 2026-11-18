// Detecção de anomalias de tráfego por z-score sobre uma janela móvel.
// Pontos anômalos NÃO entram na linha de base, para que um ataque longo não "vire normal".
export class AnomalyDetector {
  constructor({ window = 60, minSamples = 12, minStd = 3 } = {}) {
    this.window = window;
    this.minSamples = minSamples;
    this.minStd = minStd;
    this.samples = [];
  }

  stats() {
    const n = this.samples.length;
    const mean = this.samples.reduce((a, b) => a + b, 0) / (n || 1);
    const variance = this.samples.reduce((a, b) => a + (b - mean) ** 2, 0) / (n || 1);
    return { mean, std: Math.max(Math.sqrt(variance), this.minStd) };
  }

  /** Retorna { z, mean, std, anomalous } para o novo valor. */
  push(value, threshold = 3) {
    if (this.samples.length < this.minSamples) {
      this.samples.push(value);
      return { z: 0, mean: value, std: 0, anomalous: false, learning: true };
    }
    const { mean, std } = this.stats();
    const z = (value - mean) / std;
    const anomalous = z > threshold;
    if (!anomalous) {
      this.samples.push(value);
      if (this.samples.length > this.window) this.samples.shift();
    }
    return { z: +z.toFixed(2), mean: +mean.toFixed(1), std: +std.toFixed(1), anomalous, learning: false };
  }
}
