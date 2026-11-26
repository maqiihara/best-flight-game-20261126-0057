// Kitehawk Ridge Run — the renderer: a pseudo-3D chase view over the valley.
// Sky, ridges, clouds, terrain segments, rings, the runway, the Kitehawk herself,
// then the HUD and the lit dashboard gauges. Everything is drawn, nothing is loaded.
import { SEG_LEN, SEGMENTS, DRAW_DISTANCE, CAMERA_DEPTH, PLANE, RUNWAY, RING, SCREENS } from './config.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export const SCREEN_TITLE = SCREENS.TITLE;
export const SCREEN_PLAY = SCREENS.PLAY;
export const SCREEN_PAUSED = SCREENS.PAUSED;
export const SCREEN_OVER = SCREENS.OVER;

const DAY = {
  skyTop: '#2f6fd0', skyMid: '#7fb2e8', skyLow: '#cfe6f7',
  sun: '#fff3b0', haze: '#d7e8f5',
  ridgeFar: '#8fa8c8', ridgeNear: '#5d7a9e', snow: '#f4f8ff',
  groundBase: '#6f9a4e', fieldA: '#7fae56', fieldB: '#a8b45a', fieldC: '#5d8a44',
  forest: '#3e6b34', river: '#4a90c2', town: '#9a8f7a', runway: '#3c4148',
  cloud: 'rgba(255,255,255,0.85)',
};
const DUSK = {
  skyTop: '#2c2350', skyMid: '#b3546b', skyLow: '#f2a35e',
  sun: '#ffcf7a', haze: '#e08a5f',
  ridgeFar: '#6b4a72', ridgeNear: '#453055', snow: '#e8c9d8',
  groundBase: '#4a5a38', fieldA: '#5d7040', fieldB: '#7a6a42', fieldC: '#46582f',
  forest: '#2c4a28', river: '#5a5a9e', town: '#6a5a4e', runway: '#2e2a33',
  cloud: 'rgba(255,190,160,0.7)',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas, world) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.floor(window.innerWidth);
    height = Math.floor(window.innerHeight);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function project(worldX, worldY, worldZ, cameraX, cameraY, cameraZ) {
    const dz = worldZ - cameraZ;
    if (dz < 0.5) return null;
    const pxPerMetre = (CAMERA_DEPTH / dz) * (width / 2);
    return {
      x: width / 2 + (worldX - cameraX) * pxPerMetre,
      y: height * 0.52 - (worldY - cameraY) * pxPerMetre,
      scale: pxPerMetre,
    };
  }

  function drawSky(palette, heading, time) {
    const grad = ctx.createLinearGradient(0, 0, 0, height * 0.55);
    grad.addColorStop(0, palette.skyTop);
    grad.addColorStop(0.6, palette.skyMid);
    grad.addColorStop(1, palette.skyLow);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height * 0.55);
    // Sun, low on the horizon for dusk, high for day.
    const sunX = width * 0.72 - heading * width * 0.12;
    const sunY = palette === DUSK ? height * 0.42 : height * 0.16;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
    glow.addColorStop(0, palette.sun);
    glow.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
    ctx.fillStyle = palette.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, palette === DUSK ? 30 : 24, 0, Math.PI * 2);
    ctx.fill();
    // Drifting clouds, placed by the clock so the sky never repeats exactly.
    ctx.fillStyle = palette.cloud;
    for (let i = 0; i < 9; i += 1) {
      const cx = ((i * 263 + time * 6) % (width + 320)) - 160;
      const cy = 40 + (i * 47) % 150;
      const cw = 90 + (i % 3) * 46;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, 16 + (i % 3) * 5, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + cw * 0.4, cy + 8, cw * 0.55, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRidges(palette, heading) {
    // Two mountain layers, parallaxed by heading, snow on the nearer peaks.
    for (let layer = 0; layer < 2; layer += 1) {
      const baseY = height * (0.52 - layer * 0.035);
      const amp = layer === 0 ? 34 : 58;
      const speed = layer === 0 ? 0.05 : 0.12;
      ctx.fillStyle = layer === 0 ? palette.ridgeFar : palette.ridgeNear;
      ctx.beginPath();
      ctx.moveTo(-4, height * 0.55);
      for (let x = -4; x <= width + 4; x += 14) {
        const t = x / width + heading * speed;
        const y = baseY - Math.abs(Math.sin(t * 9.1) * 0.7 + Math.sin(t * 23.7) * 0.3) * amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width + 4, height * 0.55);
      ctx.closePath();
      ctx.fill();
      if (layer === 1) {
        ctx.fillStyle = palette.snow;
        for (let x = 30; x < width; x += 130) {
          const t = x / width + heading * speed;
          const peakY = baseY - Math.abs(Math.sin(t * 9.1) * 0.7 + Math.sin(t * 23.7) * 0.3) * amp;
          ctx.beginPath();
          ctx.moveTo(x - 22, peakY + 16);
          ctx.lineTo(x, peakY);
          ctx.lineTo(x + 22, peakY + 16);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  function groundColor(palette, ground, index) {
    if (ground === 'forest') return palette.forest;
    if (ground === 'river') return palette.river;
    if (ground === 'town') return palette.town;
    if (ground === 'runway') return palette.runway;
    const pick = index % 9;
    if (pick < 3) return palette.fieldA;
    if (pick < 6) return palette.fieldB;
    return palette.fieldC;
  }

  function drawSprite(palette, sprite, sx, sy, scale, time) {
    const s = Math.max(2, scale * sprite.scale);
    if (sprite.type === 'tree') {
      ctx.fillStyle = '#5d3a1e';
      ctx.fillRect(sx - s * 0.06, sy - s * 0.5, s * 0.12, s * 0.5);
      ctx.fillStyle = palette === DUSK ? '#24401f' : '#2f6b2a';
      ctx.beginPath();
      ctx.moveTo(sx, sy - s * 1.5);
      ctx.lineTo(sx - s * 0.55, sy - s * 0.45);
      ctx.lineTo(sx + s * 0.55, sy - s * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx, sy - s * 1.9);
      ctx.lineTo(sx - s * 0.4, sy - s * 1.1);
      ctx.lineTo(sx + s * 0.4, sy - s * 1.1);
      ctx.closePath();
      ctx.fill();
    } else if (sprite.type === 'house') {
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(sx - s * 0.5, sy - s * 0.6, s, s * 0.6);
      ctx.fillStyle = '#a34a3a';
      ctx.beginPath();
      ctx.moveTo(sx - s * 0.58, sy - s * 0.6);
      ctx.lineTo(sx, sy - s * 1.05);
      ctx.lineTo(sx + s * 0.58, sy - s * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffd970';
      ctx.fillRect(sx - s * 0.28, sy - s * 0.42, s * 0.16, s * 0.16);
      ctx.fillRect(sx + s * 0.12, sy - s * 0.42, s * 0.16, s * 0.16);
    } else if (sprite.type === 'windsock') {
      ctx.strokeStyle = '#d8d8d8';
      ctx.lineWidth = Math.max(1, s * 0.05);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy - s * 1.6);
      ctx.stroke();
      const wave = Math.sin(time * 3 + sx) * 0.15;
      ctx.fillStyle = '#ff7a2a';
      ctx.beginPath();
      ctx.moveTo(sx, sy - s * 1.6);
      ctx.lineTo(sx + s * 0.9, sy - s * 1.45 + wave * s);
      ctx.lineTo(sx, sy - s * 1.3);
      ctx.closePath();
      ctx.fill();
    } else if (sprite.type === 'hangar') {
      ctx.fillStyle = '#7a8894';
      ctx.fillRect(sx - s * 1.1, sy - s * 0.9, s * 2.2, s * 0.9);
      ctx.fillStyle = '#5a6672';
      ctx.beginPath();
      ctx.moveTo(sx - s * 1.1, sy - s * 0.9);
      ctx.quadraticCurveTo(sx, sy - s * 1.7, sx + s * 1.1, sy - s * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3a4148';
      ctx.fillRect(sx - s * 0.7, sy - s * 0.55, s * 1.4, s * 0.55);
    }
  }

  function drawRing(palette, ring, state, cameraX, cameraY, cameraZ) {
    const centre = world.centreXAt(ring.z) + ring.x;
    const ringY = world.groundYAt(ring.z) + ring.alt;
    const p = project(centre, ringY, ring.z, cameraX, cameraY, cameraZ);
    if (!p) return;
    const r = Math.max(3, RING.radius * p.scale);
    ctx.save();
    ctx.shadowColor = ring.hit ? '#7dff9a' : '#ffb347';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = ring.hit ? '#7dff9a' : '#ff9a2a';
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.94, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(1, r * 0.04);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r * 0.82, r * 0.77, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawSegments(palette, state, cameraX, cameraY, cameraZ, time) {
    // The valley floor first, so the edges read as hillsides past the drawn strip.
    const horizonY = height * 0.52;
    const baseGrad = ctx.createLinearGradient(0, horizonY, 0, height);
    baseGrad.addColorStop(0, palette.haze);
    baseGrad.addColorStop(1, palette.groundBase);
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, horizonY, width, height - horizonY);

    const baseIndex = Math.floor(cameraZ / SEG_LEN);
    for (let n = DRAW_DISTANCE - 1; n >= 0; n -= 1) {
      const segIndex = baseIndex + n;
      if (segIndex >= SEGMENTS) continue;
      const seg = world.segments[segIndex];
      const next = world.segments[Math.min(segIndex + 1, SEGMENTS - 1)];
      const z1 = segIndex * SEG_LEN;
      const z2 = z1 + SEG_LEN;
      const p1 = project(seg.centreX - 260, seg.elevation, z1, cameraX, cameraY, cameraZ);
      const p2 = project(seg.centreX + 260, seg.elevation, z1, cameraX, cameraY, cameraZ);
      const p3 = project(next.centreX + 260, next.elevation, z2, cameraX, cameraY, cameraZ);
      const p4 = project(next.centreX - 260, next.elevation, z2, cameraX, cameraY, cameraZ);
      if (!p1 || !p2 || !p3 || !p4) continue;
      ctx.fillStyle = groundColor(palette, seg.ground, segIndex);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.lineTo(p4.x, p4.y);
      ctx.closePath();
      ctx.fill();
      // Field boundaries: thin darker seams every few segments.
      if (seg.ground === 'field' && segIndex % 3 === 0) {
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      // The runway: asphalt strip, centre dashes, threshold bars, edge lights.
      if (seg.ground === 'runway') {
        const r1 = project(seg.centreX - RUNWAY.halfWidth, seg.elevation, z1, cameraX, cameraY, cameraZ);
        const r2 = project(seg.centreX + RUNWAY.halfWidth, seg.elevation, z1, cameraX, cameraY, cameraZ);
        const r3 = project(next.centreX + RUNWAY.halfWidth, next.elevation, z2, cameraX, cameraY, cameraZ);
        const r4 = project(next.centreX - RUNWAY.halfWidth, next.elevation, z2, cameraX, cameraY, cameraZ);
        if (r1 && r2 && r3 && r4) {
          ctx.fillStyle = palette.runway;
          ctx.beginPath();
          ctx.moveTo(r1.x, r1.y); ctx.lineTo(r2.x, r2.y); ctx.lineTo(r3.x, r3.y); ctx.lineTo(r4.x, r4.y);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#f4f4f4';
          ctx.lineWidth = Math.max(1, (r2.x - r1.x) * 0.03);
          ctx.beginPath();
          ctx.moveTo((r1.x + r2.x) / 2, (r1.y + r2.y) / 2);
          ctx.lineTo((r4.x + r3.x) / 2, (r4.y + r3.y) / 2);
          ctx.stroke();
          if (segIndex === RUNWAY.startSeg || segIndex === RUNWAY.endSeg - 1) {
            ctx.fillStyle = '#f4f4f4';
            for (let bar = -2; bar <= 2; bar += 1) {
              const bx = (r1.x + r2.x) / 2 + bar * (r2.x - r1.x) * 0.18;
              ctx.fillRect(bx - (r2.x - r1.x) * 0.05, (r1.y + r2.y) / 2 - 2, (r2.x - r1.x) * 0.1, 4);
            }
          }
          if (palette === DUSK) {
            ctx.fillStyle = '#7dffb0';
            ctx.shadowColor = '#7dffb0';
            ctx.shadowBlur = 8;
            ctx.beginPath(); ctx.arc(r1.x, r1.y, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(r2.x, r2.y, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }
      // Sprites and rings of this segment, near ones painted over far ones.
      for (const sprite of seg.sprites) {
        const sp = project(seg.centreX + sprite.offset, seg.elevation, z1 + SEG_LEN / 2, cameraX, cameraY, cameraZ);
        if (sp) drawSprite(palette, sprite, sp.x, sp.y, sp.scale * 9, time);
      }
    }
    // Rings ahead, far to near.
    const ringsAhead = state.rings.filter((ring) => ring.z > cameraZ && ring.z < cameraZ + DRAW_DISTANCE * SEG_LEN);
    ringsAhead.sort((a, b) => b.z - a.z);
    for (const ring of ringsAhead) drawRing(palette, ring, state, cameraX, cameraY, cameraZ);
  }

  function drawPlane(state, yFrac = 0.60, sizeScale = 1) {
    const cx = width / 2;
    const cy = height * yFrac + state.pitch * -14;
    const s = Math.min(width, height) * 0.085 * sizeScale;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.roll * 0.5);
    ctx.scale(1 + Math.abs(state.roll) * 0.08, 1);
    // Prop blur: a faint disc ahead of the nose (the plane flies away from us).
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, -s * 1.15, s * 0.55, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings: red with white tips, slight dihedral.
    ctx.fillStyle = '#c23b2e';
    ctx.beginPath();
    ctx.moveTo(-s * 2.1, -s * 0.12);
    ctx.quadraticCurveTo(-s * 1.1, -s * 0.5, 0, -s * 0.34);
    ctx.quadraticCurveTo(s * 1.1, -s * 0.5, s * 2.1, -s * 0.12);
    ctx.quadraticCurveTo(s * 1.1, s * 0.18, 0, s * 0.08);
    ctx.quadraticCurveTo(-s * 1.1, s * 0.18, -s * 2.1, -s * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4efe4';
    ctx.beginPath();
    ctx.moveTo(-s * 2.1, -s * 0.12); ctx.lineTo(-s * 1.72, -s * 0.2); ctx.lineTo(-s * 1.72, s * 0.1); ctx.lineTo(-s * 2.1, -s * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s * 2.1, -s * 0.12); ctx.lineTo(s * 1.72, -s * 0.2); ctx.lineTo(s * 1.72, s * 0.1); ctx.lineTo(s * 2.1, -s * 0.02);
    ctx.closePath();
    ctx.fill();
    // Tail fin and stabiliser.
    ctx.fillStyle = '#c23b2e';
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.5);
    ctx.lineTo(-s * 0.22, -s * 0.55);
    ctx.lineTo(s * 0.22, -s * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8e2a20';
    ctx.fillRect(-s * 0.85, -s * 0.62, s * 1.7, s * 0.14);
    // Fuselage, seen from behind and above: cream with a red cheatline.
    const fus = ctx.createLinearGradient(-s * 0.3, 0, s * 0.3, 0);
    fus.addColorStop(0, '#d8cdb8');
    fus.addColorStop(0.5, '#f7f2e6');
    fus.addColorStop(1, '#d8cdb8');
    ctx.fillStyle = fus;
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.55);
    ctx.quadraticCurveTo(s * 0.34, -s * 0.9, s * 0.3, s * 0.1);
    ctx.quadraticCurveTo(s * 0.28, s * 0.62, 0, s * 0.66);
    ctx.quadraticCurveTo(-s * 0.28, s * 0.62, -s * 0.3, s * 0.1);
    ctx.quadraticCurveTo(-s * 0.34, -s * 0.9, 0, -s * 1.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c23b2e';
    ctx.fillRect(-s * 0.3, -s * 0.28, s * 0.6, s * 0.1);
    // Registration on the tail.
    ctx.fillStyle = '#2c2c34';
    ctx.font = `bold ${Math.max(9, s * 0.16)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('KH-7', 0, -s * 0.72);
    ctx.restore();
  }

  function text(str, x, y, size, color, align = 'left', glow = null) {
    ctx.font = `bold ${size}px sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.shadowBlur = 0;
  }

  function drawGauge(x, y, r, label, value, max, unit, warn) {
    ctx.save();
    ctx.translate(x, y);
    const face = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    face.addColorStop(0, '#2a2f38');
    face.addColorStop(1, '#10131a');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a94a6';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd970';
    ctx.shadowColor = '#ffd970';
    ctx.shadowBlur = 6;
    for (let i = 0; i <= 10; i += 1) {
      const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      const inner = i % 5 === 0 ? r * 0.72 : r * 0.8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
      ctx.lineWidth = i % 5 === 0 ? 2.5 : 1.2;
      ctx.strokeStyle = '#e8e4d8';
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    const angle = -Math.PI * 0.75 + (clamp(value, 0, max) / max) * Math.PI * 1.5;
    ctx.strokeStyle = warn ? '#ff5a4a' : '#ffcf5a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * r * 0.68, Math.sin(angle) * r * 0.68);
    ctx.stroke();
    ctx.fillStyle = '#e8e4d8';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8ccd4';
    ctx.font = `${Math.max(9, r * 0.24)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, r * 0.45);
    ctx.fillStyle = '#ffd970';
    ctx.font = `bold ${Math.max(10, r * 0.3)}px sans-serif`;
    ctx.fillText(unit, 0, -r * 0.32);
    ctx.restore();
  }

  function drawHud(state) {
    const altFt = Math.round(state.y * 3.28084);
    const spdKt = Math.round(state.speed * 1.94384);
    const hdg = Math.round(((state.heading * 180) / Math.PI % 360 + 360) % 360);
    // Top strip.
    ctx.fillStyle = 'rgba(10,14,22,0.55)';
    ctx.fillRect(0, 0, width, 54);
    text(`ALT ${altFt} ft`, 18, 36, 22, '#e8f4ff', 'left', '#7fb2e8');
    text(`SPD ${spdKt} kt`, width * 0.30, 36, 22, '#e8f4ff', 'left', '#7fb2e8');
    text(`HDG ${String(hdg).padStart(3, '0')}°`, width * 0.55, 36, 22, '#e8f4ff', 'left', '#7fb2e8');
    text(`SCORE ${state.score}`, width - 18, 36, 22, '#ffd970', 'right', '#ffb347');
    // Compass strip.
    const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    ctx.fillStyle = 'rgba(10,14,22,0.45)';
    ctx.fillRect(width / 2 - 190, 58, 380, 22);
    for (let d = -90; d <= 90; d += 15) {
      const deg = (hdg + d + 360) % 360;
      const x = width / 2 + d * 2;
      const label = deg % 45 === 0 ? points[Math.round(deg / 45) % 8] : String(deg).padStart(3, '0');
      text(label, x, 74, d === 0 ? 13 : 10, d === 0 ? '#ffd970' : '#c8d8e8', 'center');
    }
    // Fuel and damage bars, right side.
    const fx = width - 210;
    ctx.fillStyle = 'rgba(10,14,22,0.55)';
    roundRect(ctx, fx - 10, 64, 200, 52, 8);
    ctx.fill();
    text('FUEL', fx, 84, 12, '#c8d8e8');
    ctx.fillStyle = '#222a36';
    ctx.fillRect(fx + 52, 74, 130, 12);
    ctx.fillStyle = state.fuel < 20 ? '#ff5a4a' : '#7ddb6a';
    ctx.fillRect(fx + 52, 74, 130 * (state.fuel / state.mission.fuel), 12);
    text('DMG', fx, 108, 12, '#c8d8e8');
    ctx.fillStyle = '#222a36';
    ctx.fillRect(fx + 52, 98, 130, 12);
    ctx.fillStyle = state.damage > 60 ? '#ff5a4a' : '#ffb347';
    ctx.fillRect(fx + 52, 98, 130 * (state.damage / 100), 12);
    // Rings and objective, left side.
    text(`RINGS ${state.ringsHit}/${state.rings.length}`, 18, 84, 15, '#e8f4ff');
    if (state.mission.drop) {
      text(state.dropped ? 'CRATE DELIVERED ✓' : 'CARGO: drop over the hut meadow (click / Space)', 18, 106, 14, state.dropped ? '#7dff9a' : '#ffd970');
    } else {
      text(state.mission.id === 'dusk' ? 'Land on the lit strip before dark' : 'Fly the rings, then land on the strip', 18, 106, 14, '#ffd970');
    }
    // Stall warning.
    if (state.speed < PLANE.minSpeed && !state.over) {
      text('STALL — NOSE DOWN, ADD THROTTLE', width / 2, 130, 20, '#ff5a4a', 'center', '#ff5a4a');
    }
    if (state.messageTimer > 0) {
      ctx.fillStyle = 'rgba(10,14,22,0.6)';
      const msgW = ctx.measureText(state.message).width + 36;
      roundRect(ctx, width / 2 - Math.max(180, ctx.measureText(state.message).width / 2) - 18, height - 210, Math.max(360, ctx.measureText(state.message).width + 36), 34, 8);
      ctx.fill();
      text(state.message, width / 2, height - 187, 16, '#ffffff', 'center');
    }
    // Dashboard gauges along the bottom.
    const gy = height - 52;
    const gr = 40;
    const gap = Math.min(150, width / 7);
    const gx0 = width / 2 - gap * 1.5;
    drawGauge(gx0, gy, gr, 'AIRSPEED', state.speed, PLANE.maxSpeed, `${spdKt}`, state.speed < PLANE.minSpeed);
    drawGauge(gx0 + gap, gy, gr, 'ALTIMETER', state.y, 220, `${altFt}`, false);
    drawGauge(gx0 + gap * 2, gy, gr, 'HEADING', hdg, 360, `${String(hdg).padStart(3, '0')}°`, false);
    drawGauge(gx0 + gap * 3, gy, gr, 'FUEL', state.fuel, state.mission.fuel, `${Math.round(state.fuel)}`, state.fuel < 20);
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(8,12,20,0.45)';
    ctx.fillRect(0, 0, width, height);
    text('KITEHAWK', width / 2, height * 0.24, 64, '#f7f2e6', 'center', '#ffb347');
    text('RIDGE RUN', width / 2, height * 0.24 + 58, 64, '#ffb347', 'center', '#ff9a2a');
    text('A bush-plane valley run — rings, a supply drop, and one lit strip at dusk.', width / 2, height * 0.24 + 96, 17, '#e8f4ff', 'center');
    const missions = state.mission;
    const listY = height * 0.44;
    const all = [
      { n: '1', name: 'Ring Run', blurb: 'Thread six rings, then land.' },
      { n: '2', name: 'Supply Drop', blurb: 'Drop the crate on the hut meadow.' },
      { n: '3', name: 'Dusk Mail', blurb: 'Last light. Land on the lit strip.' },
    ];
    all.forEach((m, i) => {
      const y = listY + i * 52;
      const selected = missions.id === ['rings', 'supply', 'dusk'][i];
      ctx.fillStyle = selected ? 'rgba(255,179,71,0.25)' : 'rgba(10,14,22,0.5)';
      roundRect(ctx, width / 2 - 260, y - 26, 520, 44, 10);
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = '#ffb347';
        ctx.lineWidth = 2;
        roundRect(ctx, width / 2 - 260, y - 26, 520, 44, 10);
        ctx.stroke();
      }
      text(`[${m.n}] ${m.name}`, width / 2 - 244, y + 2, 18, selected ? '#ffd970' : '#e8f4ff');
      text(m.blurb, width / 2 - 30, y + 2, 13, '#c8d8e8');
    });
    text('Arrows / WASD fly · Shift throttle up · Ctrl throttle down · Mouse steers · Click drops the crate', width / 2, listY + 3 * 52 + 26, 15, '#c8d8e8', 'center');
    text('Press SPACE or click to fly — M changes mission', width / 2, listY + 3 * 52 + 52, 16, '#ffd970', 'center', '#ffb347');
    if (best > 0) text(`Best score: ${best}`, width / 2, listY + 3 * 52 + 82, 15, '#e8f4ff', 'center');
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(8,12,20,0.55)';
    ctx.fillRect(0, 0, width, height);
    const title = state.landed ? 'DOWN SAFE' : state.crashed ? 'DOWN IN THE VALLEY' : 'SORTIE OVER';
    const color = state.landed ? '#7dff9a' : '#ff8a7a';
    text(title, width / 2, height * 0.34, 52, color, 'center', color);
    text(`${state.mission.name} · Rings ${state.ringsHit}/${state.rings.length}${state.mission.drop ? ` · Crate ${state.dropped ? 'delivered' : 'still aboard'}` : ''}`, width / 2, height * 0.34 + 44, 18, '#e8f4ff', 'center');
    text(`Score ${state.score}   ·   Best ${Math.max(best, state.score)}`, width / 2, height * 0.34 + 78, 22, '#ffd970', 'center');
    text('Press SPACE to fly again', width / 2, height * 0.34 + 122, 16, '#c8d8e8', 'center');
  }

  function draw(state, screen, best) {
    const palette = state.mission.palette === 'dusk' ? DUSK : DAY;
    const time = state.time;
    const cameraX = state.x;
    const cameraY = state.y + 7;
    const cameraZ = state.z;
    drawSky(palette, state.heading, time);
    drawRidges(palette, state.heading);
    drawSegments(palette, state, cameraX, cameraY, cameraZ, time);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_OVER) drawPlane(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      drawPlane(state, 0.84, 0.9);
    }
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8,12,20,0.5)';
      ctx.fillRect(0, 0, width, height);
      text('PAUSED', width / 2, height * 0.4, 48, '#f7f2e6', 'center');
      text('Press P or Space to keep flying', width / 2, height * 0.4 + 44, 16, '#c8d8e8', 'center');
    }
    if (screen === SCREEN_OVER) drawOver(state, best);
  }

  return { draw, resize };
}
