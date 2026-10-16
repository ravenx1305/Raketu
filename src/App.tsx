import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

export default function App() {
  const [count, setCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('war_clicker_count');
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [nukeCount, setNukeCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('war_clicker_nuke_count');
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);
  const screenShakeRef = useRef(0);
  const [isShaking, setIsShaking] = useState(false);
  const [isNuclearFlash, setIsNuclearFlash] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize or get persistent single AudioContext
  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Play deep explosive sound reusing the single AudioContext
  const playExplosionSound = (isNuke = false) => {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      
      const duration = isNuke ? 1.2 : 0.5;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * (isNuke ? 0.35 : 0.18)));
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isNuke ? 1200 : 700, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(isNuke ? 20 : 35, ctx.currentTime + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(isNuke ? 0.9 : 0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sawtooth';
      subOsc.frequency.setValueAtTime(isNuke ? 160 : 110, ctx.currentTime);
      subOsc.frequency.exponentialRampToValueAtTime(18, ctx.currentTime + (isNuke ? 0.8 : 0.35));

      subGain.gain.setValueAtTime(isNuke ? 0.9 : 0.7, ctx.currentTime);
      subGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (isNuke ? 0.8 : 0.35));

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);

      whiteNoise.start();
      subOsc.start();
      whiteNoise.stop(ctx.currentTime + duration);
      subOsc.stop(ctx.currentTime + (isNuke ? 0.8 : 0.35));
    } catch {
      // Audio failsafe
    }
  };

  // Trigger blast at coordinates
  const triggerBlast = (originX: number, originY: number, isNuke = false) => {
    playExplosionSound(isNuke);

    // Trigger visual screen shake & flash
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), isNuke ? 350 : 180);

    if (isNuke) {
      setIsNuclearFlash(true);
      setTimeout(() => setIsNuclearFlash(false), 200);
    }

    // Keep shockwaves capped
    if (shockwavesRef.current.length > 25) {
      shockwavesRef.current.splice(0, 5);
    }

    // Shockwave
    shockwavesRef.current.push(
      {
        x: originX,
        y: originY,
        radius: 10,
        maxRadius: Math.max(window.innerWidth, window.innerHeight) * (isNuke ? 0.9 : 0.45),
        alpha: 1,
        color: isNuke ? '#ffee00' : '#ffaa00'
      },
      {
        x: originX,
        y: originY,
        radius: 5,
        maxRadius: Math.max(window.innerWidth, window.innerHeight) * (isNuke ? 1.2 : 0.6),
        alpha: 0.9,
        color: isNuke ? '#ff0033' : '#ff3300'
      }
    );

    // Keep particles capped to avoid memory leaks
    if (particlesRef.current.length > 350) {
      particlesRef.current.splice(0, 80);
    }

    const nukeColors = ['#ffffff', '#ffff55', '#ffcc00', '#ff5500', '#ff0033', '#ffffcc', '#ffffff'];
    const standardColors = ['#ffffff', '#fff275', '#ff9f1c', '#ff3838', '#e71d36', '#ff0055', '#333333', '#111111'];
    const colors = isNuke ? nukeColors : standardColors;
    const countParticles = isNuke ? 90 : 50;

    for (let i = 0; i < countParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (isNuke ? 22 : 14) + 4;
      particlesRef.current.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * (isNuke ? 16 : 10) + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        decay: Math.random() * 0.02 + 0.012
      });
    }

    for (let i = 0; i < (isNuke ? 40 : 20); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * (isNuke ? 32 : 22) + 6;
      particlesRef.current.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 1.5,
        color: isNuke ? '#ffff00' : '#ffcc00',
        alpha: 1,
        decay: Math.random() * 0.018 + 0.008
      });
    }
  };

  const isNukePhase = count >= 222;
  const isFinished = isNukePhase && nukeCount >= 10;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isFinished) return;

    if (!isNukePhase) {
      setCount(prev => {
        const next = prev + 1;
        try {
          localStorage.setItem('war_clicker_count', next.toString());
        } catch {}
        return next;
      });
      triggerBlast(e.clientX, e.clientY, false);
    } else {
      setNukeCount(prev => {
        const next = Math.min(prev + 1, 10);
        try {
          localStorage.setItem('war_clicker_nuke_count', next.toString());
        } catch {}
        return next;
      });
      triggerBlast(e.clientX, e.clientY, true);
    }
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCount(0);
    setNukeCount(0);
    try {
      localStorage.setItem('war_clicker_count', '0');
      localStorage.setItem('war_clicker_nuke_count', '0');
    } catch {}
  };

  const handleSkipTo222 = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCount(222);
    setNukeCount(0);
    try {
      localStorage.setItem('war_clicker_count', '222');
      localStorage.setItem('war_clicker_nuke_count', '0');
    } catch {}
  };

  // Canvas loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const interval = setInterval(() => {
      if (Math.random() > 0.4) {
        const randX = Math.random() * window.innerWidth;
        const randY = Math.random() * window.innerHeight;
        shockwavesRef.current.push({
          x: randX,
          y: randY,
          radius: 5,
          maxRadius: Math.random() * 200 + 100,
          alpha: 0.4,
          color: '#ff4400'
        });
      }
    }, 2800);

    const render = () => {
      ctx.fillStyle = 'rgba(8, 8, 12, 0.22)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
        const sw = shockwavesRef.current[i];
        sw.radius += (sw.maxRadius - sw.radius) * 0.12 + 4;
        sw.alpha -= 0.025;

        if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
          shockwavesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = Math.max(1, (1 - sw.radius / sw.maxRadius) * 14);
        ctx.globalAlpha = sw.alpha;
        ctx.stroke();

        const grad = ctx.createRadialGradient(sw.x, sw.y, 0, sw.x, sw.y, sw.radius);
        grad.addColorStop(0, `rgba(255, 220, 50, ${sw.alpha * 0.5})`);
        grad.addColorStop(0.7, `rgba(255, 60, 0, ${sw.alpha * 0.3})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.restore();
      }

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
      clearInterval(interval);
    };
  }, []);

  return (
    <div 
      onClick={handleClick}
      className={`min-h-screen w-full relative overflow-hidden select-none cursor-pointer flex flex-col items-center justify-center bg-black transition-all duration-75 ${
        isShaking ? 'translate-x-2 -translate-y-1.5 scale-[1.01]' : ''
      }`}
    >
      {/* Nuclear Flash Overlay */}
      {isNuclearFlash && (
        <div className="absolute inset-0 bg-yellow-300/40 pointer-events-none z-20 animate-pulse" />
      )}

      {/* Background Canvas */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 pointer-events-none z-0"
      />

      {/* Controls in top corners */}
      <div className="absolute top-6 right-6 z-30 flex items-center gap-2">
        {/* Reset button */}
        <button 
          type="button"
          onClick={handleReset}
          className="px-3 py-1.5 rounded-full bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 backdrop-blur-md transition-all text-xs font-mono active:scale-95"
          title="Скинути лічильник"
        >
          Скинути
        </button>

        {/* Copy link button */}
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="px-3 py-1.5 rounded-full bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800/80 backdrop-blur-md transition-all text-xs font-mono flex items-center gap-1.5 active:scale-95"
          title="Скопіювати посилання"
        >
          <span>{copied ? "✓" : "🔗"}</span>
          <span>{copied ? "Скопійовано" : "Лінк"}</span>
        </button>

        {/* Sound toggle */}
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setSoundEnabled(!soundEnabled);
          }}
          className="p-2 rounded-full bg-slate-900/70 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80 backdrop-blur-md transition-all active:scale-90"
          title={soundEnabled ? "Вимкнути звук" : "Увімкнути звук"}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-400" />}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
        
        {/* PHASE 1: < 222 */}
        {!isNukePhase && (
          <>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-wider text-red-500 drop-shadow-[0_0_25px_rgba(255,50,0,0.8)] mb-6 sm:mb-8 font-mono">
              ракети в рашку
            </h1>
            <div className="text-7xl sm:text-9xl md:text-[11rem] font-black tracking-tight text-white font-mono drop-shadow-[0_0_35px_rgba(255,200,0,0.9)] leading-none active:scale-105 transition-transform">
              {count}
            </div>
          </>
        )}

        {/* PHASE 2: >= 222 AND < 10 (ЯДЕРКА) */}
        {isNukePhase && !isFinished && (
          <>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-wider text-yellow-400 drop-shadow-[0_0_30px_rgba(255,220,0,1)] mb-6 sm:mb-8 font-mono animate-pulse">
              та всьо давай тепер ядерку
            </h1>
            <div className="text-7xl sm:text-9xl md:text-[11rem] font-black tracking-tight text-yellow-300 font-mono drop-shadow-[0_0_45px_rgba(255,100,0,1)] leading-none active:scale-105 transition-transform">
              {nukeCount}
            </div>
            <p className="text-xs sm:text-sm font-mono text-yellow-500/80 mt-4 tracking-widest uppercase">
              {10 - nukeCount} кліків до фіналу
            </p>
          </>
        )}

        {/* PHASE 3: НА 10 КЛІКАХ ЯДЕРКИ - І ВСЕ */}
        {isFinished && (
          <div className="space-y-6">
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-wider text-white drop-shadow-[0_0_40px_rgba(255,255,255,1)] font-mono animate-bounce">
              ТА ВСЬО. І ВСЕ. 💥
            </h1>
            <div className="text-6xl sm:text-8xl font-black text-yellow-400 font-mono drop-shadow-[0_0_50px_rgba(255,0,0,1)]">
              10 / 10
            </div>
            <div className="pt-4 pointer-events-auto">
              <button
                type="button"
                onClick={handleReset}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-red-600 via-yellow-500 to-amber-600 text-black font-black uppercase text-base sm:text-lg tracking-wider shadow-2xl active:scale-95 transition-all hover:brightness-110"
              >
                Почати знову 🔄
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
