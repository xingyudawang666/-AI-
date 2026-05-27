export interface AppSettings {
  hue: number;
  size: number;
  speed: number;
  density: number;
  isFireMode: boolean;
  isSandMode: boolean;
  isWaterMode: boolean;
  customColor: string;
}

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  color: string;
  wobble: number;
  maxLife: number;

  isPaint: boolean;

  isFireParticle: boolean;
  isWaterParticle: boolean;

  constructor(x: number, y: number, color: string, settings: AppSettings, isPaint: boolean = false, isExplosion: boolean = false, overrideType?: 'water') {
    this.x = x;
    this.y = y;
    this.isPaint = isPaint;
    this.isFireParticle = overrideType !== 'water' && settings.isFireMode;
    this.isWaterParticle = overrideType === 'water' || settings.isWaterMode;
    
    if (this.isFireParticle) {
      if (isExplosion) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 25 * settings.speed;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = (Math.random() * 12 + 4) * settings.size;
        this.maxLife = Math.random() * 0.8 + 0.4;
        this.isPaint = false;
      } else if (isPaint) {
        this.vx = (Math.random() - 0.5) * 1.5 * settings.speed;
        this.vy = (Math.random() * -3 - 1) * settings.speed;
        this.size = (Math.random() * 5 + 3) * settings.size;
        this.maxLife = 2.0; 
        this.isPaint = false; // Act like regular moving particles but move upward
      } else {
        this.vx = (Math.random() - 0.5) * 2 * settings.speed;
        this.vy = (Math.random() * -6 - 2) * settings.speed; 
        this.size = (Math.random() * 12 + 6) * settings.size;
        this.maxLife = Math.random() * 0.6 + 0.3;
      }
      this.color = 'rgb(255, 200, 100)';
    } else if (overrideType !== 'water' && settings.isSandMode) {
      this.vx = (Math.random() - 0.5) * 2 * settings.speed;
      this.vy = Math.random() * 4 * settings.speed; // falling down
      this.size = (Math.random() * 3 + 1.5) * settings.size;
      this.maxLife = Infinity; // Doesn't die
      this.isPaint = false;
      this.color = settings.customColor || `hsl(${35 + Math.random() * 15}, 65%, ${Math.random() * 30 + 40}%)`;
    } else if (this.isWaterParticle) {
      this.vx = (Math.random() - 0.5) * 1.5 * settings.speed;
      this.vy = (Math.random() * 2 + 3) * settings.speed; // Fall down steadily
      this.size = (Math.random() * 4 + 2) * settings.size;
      this.maxLife = Math.random() * 1.0 + 1.0;
      this.color = color || `rgba(${150 + Math.random() * 50}, ${200 + Math.random() * 55}, 255, 0.6)`;
    } else {
      this.color = settings.customColor || color;
      if (isPaint) {
        this.vx = 0;
        this.vy = 0;
        this.size = settings.size * 5; // Thicker brush
        this.maxLife = 5.0; // Last longer
      } else {
        this.vx = (Math.random() - 0.5) * 8 * settings.speed;
        this.vy = (Math.random() - 0.5) * 8 * settings.speed;
        this.size = (Math.random() * 5 + 2) * settings.size;
        this.maxLife = 1.0;
      }
    }
    
    this.life = this.maxLife;
    this.wobble = Math.random() * Math.PI * 2;
  }

  update(settings: AppSettings, gravityTarget: { x: number, y: number } | null, isGrabbed: boolean) {
    if (this.isPaint && !this.isWaterParticle) {
      // Paint particles decay very slowly and don't move
      this.life -= 0.005;
      return;
    }

    if (this.isFireParticle) {
      this.life -= 0.015 * settings.speed;
      this.vy -= 0.2 * settings.speed; // buoyant / go up
      this.wobble += 0.2;
      this.vx += Math.sin(this.wobble) * 0.3;
      
      if (gravityTarget) {
          const dx = gravityTarget.x - this.x;
          const dy = gravityTarget.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (isGrabbed && dist > 15) {
              this.vx += (dx / dist) * 4.0 * settings.speed;
              this.vy += (dy / dist) * 4.0 * settings.speed;
          } else if (!isGrabbed && dist < 150) {
              this.vx -= (dx / dist) * 1.5 * settings.speed;
              this.vy -= (dy / dist) * 1.5 * settings.speed;
          }
      }
      this.vx *= 0.92;
      this.vy *= 0.95;
      this.x += this.vx;
      this.y += this.vy;
      return;
    }
    
    if (this.isWaterParticle) {
      this.vy += 0.3 * settings.speed; // gravity
      this.vx += (Math.random() - 0.5) * 0.5; // slight random spreading
      this.vx *= 0.98;
      this.vy *= 0.98;
      this.x += this.vx;
      this.y += this.vy;
      this.life -= 0.015 * settings.speed;
      return;
    }
    
    if (settings.isSandMode) {
       this.wobble += 0.02 * settings.speed;
       this.vx += Math.sin(this.wobble) * 0.1 * settings.speed; // wind
       
       if (gravityTarget && isGrabbed) {
          const dx = gravityTarget.x - this.x;
          const dy = gravityTarget.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 20 && dist < 300) {
              this.vx += (dx / dist) * 0.5 * settings.speed;
              this.vy += (dy / dist) * 0.2 * settings.speed;
          }
       }
       
       this.vx *= 0.98;
       this.vy *= 0.98; 
       this.x += this.vx;
       this.y += this.vy;
       return; 
    }

    // Add some organic movement
    this.wobble += 0.1 * settings.speed;
    this.vx += Math.sin(this.wobble) * 0.5 * settings.speed;
    this.vy += Math.cos(this.wobble) * 0.5 * settings.speed;
    
    if (gravityTarget) {
      const dx = gravityTarget.x - this.x;
      const dy = gravityTarget.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (isGrabbed) {
        // Attract (聚拢)
        if (dist > 10) {
           this.vx += (dx / dist) * 2.0 * settings.speed;
           this.vy += (dy / dist) * 2.0 * settings.speed;
        }
      } else {
        // Repel (burst/diffuse) if close
        if (dist < 200) {
           this.vx -= (dx / dist) * 1.5 * settings.speed;
           this.vy -= (dy / dist) * 1.5 * settings.speed;
        }
      }
    }

    // Apply friction
    this.vx *= 0.92;
    this.vy *= 0.92;

    this.x += this.vx;
    this.y += this.vy;
    
    // Decrease life
    this.life -= 0.015 * settings.speed;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    const lifeRatio = this.maxLife === Infinity ? 1 : Math.max(0, this.life / this.maxLife);
    const currentSize = this.size * lifeRatio;
    ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
    
    if (this.isFireParticle) {
      ctx.globalCompositeOperation = 'lighter';
      let r, g, b, a;
      if (lifeRatio > 0.7) {
          r = 255; g = 255; b = Math.floor(200 * (lifeRatio - 0.7) / 0.3); a = lifeRatio;
      } else if (lifeRatio > 0.3) {
          r = 255; g = Math.floor(150 * (lifeRatio - 0.3) / 0.4); b = 0; a = lifeRatio;
      } else {
          r = Math.floor(255 * (lifeRatio / 0.3)); g = 0; b = 0; a = lifeRatio;
      }
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
      ctx.shadowColor = `rgba(${r}, 0, 0, ${a})`;
      ctx.shadowBlur = 25 * lifeRatio;
    } else {
      ctx.fillStyle = this.color;
      ctx.globalAlpha = lifeRatio;
      ctx.shadowBlur = this.maxLife === Infinity ? 0 : 15 * lifeRatio;
      ctx.shadowColor = this.color;
    }
    
    ctx.fill();
    ctx.globalAlpha = 1.0;
    
    if (this.isFireParticle) {
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

export class ParticleSystem {
  particles: Particle[] = [];
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  settings: AppSettings = { hue: 190, size: 1, speed: 1, density: 1, isFireMode: false, isSandMode: false, isWaterMode: false, customColor: "" };
  gravityTargets: Array<{x: number, y: number, isGrabbed: boolean}> = [];
  sandHeightMap: number[] = [];

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.initSandMap();
  }

  initSandMap() {
    this.sandHeightMap = new Array(Math.ceil(this.width || 1024)).fill(this.height || 768);
  }

  clear() {
    this.particles = [];
    this.initSandMap();
  }

  updateSettings(newSettings: AppSettings) {
    if (!this.settings.isSandMode && newSettings.isSandMode) {
      this.initSandMap();
    }
    this.settings = newSettings;
  }

  setGravityTargets(targets: Array<{x: number, y: number, isGrabbed: boolean}>) {
    this.gravityTargets = targets;
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.initSandMap();
  }

  emit(x: number, y: number, color: string, count: number = 3, isPaint: boolean = false, isExplosion: boolean = false, overrideType?: 'water') {
    const finalCount = isExplosion ? Math.floor(count * 5 * this.settings.density) : Math.floor(count * this.settings.density);
    const loopCount = isPaint ? Math.max(1, Math.floor(finalCount / 3)) : finalCount; // Emit fewer for paint
    for (let i = 0; i < loopCount; i++) {
        // override color if hue is specific, or just let caller override
        const adjustedColor = color.startsWith('hsl') ? color : color; // We'll handle hsl in App.tsx
        this.particles.push(new Particle(x, y, adjustedColor, this.settings, isPaint, isExplosion, overrideType));
    }
  }

  addSand(x: number, amount: number) {
    const ix = Math.floor(x);
    const r = Math.ceil(amount * 1.5) + 2; 
    
    for (let dx = -r; dx <= r; dx++) {
      const idx = ix + dx;
      if (idx >= 0 && idx < this.width) {
        const weight = Math.max(0, 1 - Math.abs(dx) / r);
        this.sandHeightMap[idx] -= weight * amount;
      }
    }
  }

  avalanche() {
    const limit = Math.ceil(this.width);
    const maxSlope = 1.0; 
    for (let i = 0; i < limit - 1; i++) {
        const diff = this.sandHeightMap[i] - this.sandHeightMap[i+1];
        if (diff > maxSlope) {
            const flow = (diff - maxSlope) / 2;
            this.sandHeightMap[i] -= flow;
            this.sandHeightMap[i+1] += flow;
        } else if (diff < -maxSlope) {
            const flow = (-diff - maxSlope) / 2;
            this.sandHeightMap[i] += flow;
            this.sandHeightMap[i+1] -= flow;
        }
    }
  }

  updateAndDraw() {
    // Clear canvas instead of fading with rect so video behind shows through
    this.ctx.clearRect(0, 0, this.width, this.height);

    if (this.settings.isSandMode) {
      this.avalanche();
      
      // Draw sand pile
      this.ctx.fillStyle = this.settings.customColor || 'hsl(40, 60%, 40%)';
      this.ctx.beginPath();
      this.ctx.moveTo(0, this.height);
      const limit = Math.ceil(this.width);
      for (let x = 0; x < limit; x++) {
        this.ctx.lineTo(x, this.sandHeightMap[x] || this.height);
      }
      this.ctx.lineTo(this.width, this.height);
      this.ctx.fill();
    }

    // Update and draw particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Find nearest gravity target
      let nearestTarget = null;
      let isGrabbed = false;
      let minDist = Infinity;
      
      for (const target of this.gravityTargets) {
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDist) {
          minDist = distSq;
          nearestTarget = {x: target.x, y: target.y};
          isGrabbed = target.isGrabbed;
        }
      }

      p.update(this.settings, nearestTarget, isGrabbed);
      
      if (this.settings.isSandMode && !p.isWaterParticle && !p.isFireParticle) {
        p.vy += (0.2 * this.settings.speed); // gravity
        
        const ix = Math.floor(p.x);
        if (ix >= 0 && ix < this.width) {
          const floor = this.sandHeightMap[ix];
          if (p.y >= floor - p.size) {
            // Hit the pile
            this.addSand(p.x, p.size * 2.0); // Multiply by 2 for faster accumulation
            p.life = 0; // kill it
          }
        } else if (p.y > this.height) {
            p.life = 0;
        }
      }

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      } else {
        p.draw(this.ctx);
      }
    }
  }

  // Draw hand skeleton lines
  drawConnections(landmarks: { x: number; y: number }[], color: string) {
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8], // Index
      [5, 9], [9, 10], [10, 11], [11, 12], // Middle
      [9, 13], [13, 14], [14, 15], [15, 16], // Ring
      [13, 17], [0, 17], [17, 18], [18, 19], [19, 20] // Pinky and palm base
    ];
    
    this.ctx.beginPath();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.globalAlpha = 0.5;
    
    for (const [i, j] of connections) {
      const pt1 = landmarks[i];
      const pt2 = landmarks[j];
      
      this.ctx.moveTo(pt1.x * this.width, pt1.y * this.height);
      this.ctx.lineTo(pt2.x * this.width, pt2.y * this.height);
    }
    this.ctx.stroke();
    this.ctx.globalAlpha = 1.0;
  }
}
