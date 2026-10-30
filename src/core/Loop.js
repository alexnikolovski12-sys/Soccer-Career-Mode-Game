// Fixed-timestep loop with interpolated rendering.
// Simulation always advances in exact `step` increments; `timeScale` scales how
// much simulated time accrues per real second (slow-mo / shot freeze), so
// physics stay identical across devices and frame rates.

export class Loop {
  constructor({ hz = 60, maxSteps = 5, update, render }) {
    this.step = 1 / hz;
    this.maxSteps = maxSteps;
    this.update = update;
    this.render = render;
    this.timeScale = 1;
    this.acc = 0;
    this.last = 0;
    this.running = false;
    this.simTime = 0;
    this._tick = this._tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._tick);
  }

  stop() { this.running = false; }

  _tick(now) {
    if (!this.running) return;
    requestAnimationFrame(this._tick);
    // Clamp long frames (tab switches, debugger) to avoid huge catch-up bursts.
    const realDt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.acc += realDt * this.timeScale;
    let steps = 0;
    while (this.acc >= this.step && steps < this.maxSteps) {
      this.update(this.step);
      this.simTime += this.step;
      this.acc -= this.step;
      steps++;
    }
    if (steps >= this.maxSteps) this.acc = 0;
    this.render(this.acc / this.step, realDt, realDt * this.timeScale);
  }
}
