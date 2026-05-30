/* =============================================================================
   STORYBOARD ENGINE — composable animator core (v0.3)
   Single source of truth for the storyboard skill's playback engine.

   What's new vs the inline v0.2 engine:
     - Named easing registry + per-element data-ease override
     - Tunable spring physics (data-spring="stiffness,damping")
     - data-stagger on a container -> auto-distribute child start times
     - Chained sequences: data-then="pulse@1.5; float"
     - Continuous ambient loops: data-loop="float|breathe|orbit|rotate|sway|beat"
     - 3D presets: flipInX, flipInY, cardFlip, tiltIn, zoomThrough
     - Data-viz: barGrow, columnRace, lineDraw, donutSweep, ringFill, comparisonBar
     - Cinematic: shared-element transitions (data-shared-id) + camera rig
     - Beat-sync via WebAudio AnalyserNode (amplitude-reactive loops)

   Usage (in an HTML deck):
     <script src="storyboard-engine.js"></script>
     <script>
       Storyboard.init({
         timings: [{time:0,slide:1}, ...],
         labels:  ['Intro', ...],
         fallbackDuration: 90,
         wordHits: []
       });
     </script>

   Markup contract (unchanged + extended):
     <section class="slide" data-slide="N" data-transition-in="dissolve">
     <h1 class="anim" data-anim="spring" data-t-rel="0.5" data-dur="1.2"
         data-ease="outBack" data-then="float" data-loop="breathe"></h1>
     <ul class="anim-group" data-anim="slideInLeft" data-stagger="0.12" data-t-rel="1.0"><li>..</li></ul>
============================================================================= */
(function (global) {
  'use strict';

  /* ===========================================================================
     EASING REGISTRY — named curves, addressable via data-ease="<name>"
  =========================================================================== */
  const EASE = {
    linear:     p => p,
    inQuad:     p => p * p,
    outQuad:    p => 1 - (1 - p) * (1 - p),
    inOutQuad:  p => p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p + 2, 2) / 2,
    inCubic:    p => p * p * p,
    outCubic:   p => 1 - Math.pow(1 - p, 3),
    inOutCubic: p => p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2,
    outQuart:   p => 1 - Math.pow(1 - p, 4),
    outQuint:   p => 1 - Math.pow(1 - p, 5),
    outExpo:    p => p === 1 ? 1 : 1 - Math.pow(2, -10 * p),
    inOutExpo:  p => p === 0 ? 0 : p === 1 ? 1 : p < 0.5
                      ? Math.pow(2, 20*p - 10) / 2
                      : (2 - Math.pow(2, -20*p + 10)) / 2,
    outBack:    p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3*Math.pow(p-1,3) + c1*Math.pow(p-1,2); },
    inBack:     p => { const c1 = 1.70158, c3 = c1 + 1; return c3*p*p*p - c1*p*p; },
    outElastic: p => { const c4 = (2*Math.PI)/3; return p===0?0:p===1?1:Math.pow(2,-10*p)*Math.sin((p*10-0.75)*c4)+1; },
    outBounce:  p => {
      const n1 = 7.5625, d1 = 2.75;
      if (p < 1/d1) return n1*p*p;
      if (p < 2/d1) return n1*(p-=1.5/d1)*p + 0.75;
      if (p < 2.5/d1) return n1*(p-=2.25/d1)*p + 0.9375;
      return n1*(p-=2.625/d1)*p + 0.984375;
    },
  };
  // Short aliases
  EASE.smooth = EASE.inOutCubic;
  EASE.snap   = EASE.outQuint;
  EASE.pop    = EASE.outBack;

  /* Spring solver — analytic damped oscillator sampled over normalized [0,1].
     stiffness ~ 80..400, damping ~ 8..30. Returns a 0->1 curve that may
     overshoot (underdamped) before settling. Cached per (k,c). */
  const _springCache = {};
  function springCurve(stiffness, damping) {
    const key = stiffness + ':' + damping;
    if (_springCache[key]) return _springCache[key];
    // Build a lookup table by integrating the spring ODE (semi-implicit Euler)
    const m = 1, k = stiffness, c = damping;
    const steps = 240, dtTotal = 1.0;
    let x = 0, v = 0; const dt = dtTotal / steps;
    const table = new Float32Array(steps + 1);
    for (let i = 0; i <= steps; i++) {
      table[i] = x;
      const a = (-k * (x - 1) - c * v) / m;
      v += a * dt;
      x += v * dt;
    }
    const last = table[steps] || 1;
    // Normalize so the curve ends exactly at 1
    const fn = p => {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      const f = p * steps, i = Math.floor(f), frac = f - i;
      const a = table[i], b = table[i + 1] !== undefined ? table[i + 1] : last;
      return (a + (b - a) * frac) / last;
    };
    _springCache[key] = fn;
    return fn;
  }

  function resolveEase(el) {
    if (el.dataset.spring) {
      const [k, c] = el.dataset.spring.split(',').map(parseFloat);
      return springCurve(k || 200, c || 14);
    }
    if (el.dataset.ease && EASE[el.dataset.ease]) return EASE[el.dataset.ease];
    return null; // null => use preset's internal ease
  }

  /* ===========================================================================
     PRESET LIBRARY
     Each preset: { dur, ease?, apply(el, p, ctx) } where p is RAW progress 0..1.
     If a preset reads `ctx.ease`, the per-element override is applied; otherwise
     the preset eases internally (back-compat with v0.2 presets).
  =========================================================================== */
  const E = EASE;
  const PRESETS = {
    /* --- basics --- */
    fadeIn:  { dur: 0.8, apply: (el,p,c) => { el.style.opacity = (c.ease||E.outCubic)(p); } },
    fadeOut: { dur: 0.8, apply: (el,p,c) => { el.style.opacity = 1-(c.ease||E.outCubic)(p); } },
    fadeUp:  { dur: 1.0, apply: (el,p,c) => { const e=(c.ease||E.outCubic)(p); el.style.opacity=e; el.style.transform=`translateY(${(1-e)*40}px)`; } },
    fadeDown:{ dur: 1.0, apply: (el,p,c) => { const e=(c.ease||E.outCubic)(p); el.style.opacity=e; el.style.transform=`translateY(${(1-e)*-40}px)`; } },
    slideInLeft:  { dur: 1.0, apply: (el,p,c) => { const e=(c.ease||E.outCubic)(p); el.style.opacity=e; el.style.transform=`translateX(${(1-e)*-120}px)`; } },
    slideInRight: { dur: 1.0, apply: (el,p,c) => { const e=(c.ease||E.outCubic)(p); el.style.opacity=e; el.style.transform=`translateX(${(1-e)*120}px)`; } },
    scaleIn: { dur: 1.0, apply: (el,p,c) => { const e=(c.ease||E.outCubic)(p); el.style.opacity=e; el.style.transform=`scale(${0.85+0.15*e})`; } },
    crossfade: { dur: 1.2, apply: (el,p,c) => { el.style.opacity = el.dataset.out==='1' ? (1-p) : p; } },

    /* --- physics / 12 principles --- */
    anticipate: { dur: 1.2, apply: (el,p,c) => {
      let x; if (p<0.25){x=-8*(p/0.25);} else {const q=(p-0.25)/0.75; x=-8+(8+100)*E.outBack(q);}
      el.style.opacity=Math.min(1,p*3); el.style.transform=`translateX(${-x}px)`;
    }},
    overshoot: { dur: 1.0, apply: (el,p,c) => { el.style.opacity=(c.ease||E.outCubic)(p); el.style.transform=`translateY(${(1-E.outBack(p))*30}px)`; } },
    spring:  { dur: 1.2, apply: (el,p,c) => { el.style.opacity=Math.min(1,p*2); const s=0.7+0.3*(c.ease||E.outElastic)(p); el.style.transform=`scale(${s})`; } },
    bounce:  { dur: 1.2, apply: (el,p,c) => { el.style.opacity=Math.min(1,p*2); el.style.transform=`translateY(${(1-E.outBounce(p))*-120}px)`; } },
    wobble:  { dur: 0.9, apply: (el,p,c) => { el.style.opacity=1; el.style.transform=`rotate(${Math.sin(p*Math.PI*4)*(1-p)*4}deg)`; } },
    shake:   { dur: 0.5, apply: (el,p,c) => { el.style.opacity=1; el.style.transform=`translateX(${Math.sin(p*Math.PI*10)*(1-p)*12}px)`; } },
    squash:  { dur: 0.6, apply: (el,p,c) => { el.style.opacity=1; const ph=Math.sin(p*Math.PI); el.style.transform=`scale(${1+ph*0.18},${1-ph*0.22})`; } },
    pulse:   { dur: 0.9, apply: (el,p,c) => { el.style.opacity=1; el.style.transform=`scale(${1+0.08*Math.sin(p*Math.PI)})`; } },

    /* --- 3D (NEW) --- */
    flipInX: { dur: 1.1, apply: (el,p,c) => { const e=(c.ease||E.outCubic)(p); el.style.opacity=e; el.style.transformOrigin='center'; el.style.transform=`perspective(1200px) rotateX(${(1-e)*-90}deg)`; } },
    flipInY: { dur: 1.1, apply: (el,p,c) => { const e=(c.ease||E.outCubic)(p); el.style.opacity=e; el.style.transformOrigin='center'; el.style.transform=`perspective(1200px) rotateY(${(1-e)*90}deg)`; } },
    cardFlip:{ dur: 1.3, apply: (el,p,c) => { const e=(c.ease||E.inOutCubic)(p); el.style.opacity=Math.min(1,p*4); el.style.transform=`perspective(1400px) rotateY(${180*(1-e)}deg)`; } },
    tiltIn:  { dur: 1.1, apply: (el,p,c) => { const e=(c.ease||E.outBack)(p); el.style.opacity=Math.min(1,p*3); el.style.transform=`perspective(1200px) rotateX(${(1-e)*18}deg) rotateZ(${(1-e)*-6}deg) translateY(${(1-e)*40}px)`; } },
    zoomThrough: { dur: 1.2, apply: (el,p,c) => { const e=(c.ease||E.outExpo)(p); el.style.opacity=Math.min(1,p*2.5); el.style.transform=`perspective(1000px) translateZ(${(1-e)*-600}px)`; } },

    /* --- text --- */
    typewriter: { dur: 1.5, apply: (el,p,c) => {
      if (!el.dataset.fullText) el.dataset.fullText = el.textContent;
      const t=el.dataset.fullText, n=Math.floor(t.length*(c.ease||E.outCubic)(p));
      el.textContent=t.slice(0,n); el.style.opacity=1;
    }},
    wordReveal: { dur: 1.8, apply: (el,p,c) => {
      if (!el.dataset.wrInit) {
        el.dataset.wrInit='1';
        const words = el.innerHTML.split(/(\s+)/);
        el.innerHTML = words.map(w => /\S/.test(w) ? `<span class="wr-w" style="opacity:0">${w}</span>` : w).join('');
        el.dataset.wordCount = el.querySelectorAll('.wr-w').length;
      }
      el.style.opacity=1;
      const n=parseInt(el.dataset.wordCount,10), shown=Math.floor(n*(c.ease||E.outCubic)(p));
      el.querySelectorAll('.wr-w').forEach((w,i)=>{ w.style.opacity = i<shown?1:0; });
    }},
    letterSpring: { dur: 1.6, apply: (el,p,c) => {
      if (!el.dataset.lsInit) {
        el.dataset.lsInit='1';
        // If the host carries a clipped gradient (.gradient-fill), capture the
        // resolved gradient so each per-letter span can re-clip it. Otherwise
        // the spans inherit transparent text-fill with no gradient box = invisible.
        let grad=null;
        if (el.classList.contains('gradient-fill')) {
          grad=getComputedStyle(el).backgroundImage;
          el.style.webkitTextFillColor='currentColor'; el.style.color='transparent';
        }
        const gstyle = grad ? `;background-image:${grad};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent` : '';
        // Preserve <br> line breaks: wrap chars per segment, rejoin with <br>.
        const segments = el.innerHTML.split(/<br\s*\/?>/i);
        el.innerHTML = segments.map(seg => {
          const txt = seg.replace(/<[^>]+>/g,''); // strip any stray tags within a segment
          return [...txt].map(ch=>ch===' '?' ':`<span class="ls-c" style="display:inline-block;opacity:0${gstyle}">${ch}</span>`).join('');
        }).join('<br>');
        el.dataset.charCount=el.querySelectorAll('.ls-c').length;
      }
      el.style.opacity=1;
      const cs=el.querySelectorAll('.ls-c'), n=cs.length;
      cs.forEach((s,i)=>{
        const local=Math.max(0,Math.min(1,(p*n - i*0.6)/1.2));
        const e=E.outBack(local);
        s.style.opacity=local>0?1:0;
        s.style.transform=`translateY(${(1-e)*30}px) scale(${0.6+0.4*e})`;
      });
    }},
    scramble: { dur: 1.6, apply: (el,p,c) => {
      if (!el.dataset.fullText) el.dataset.fullText = el.textContent;
      const t=el.dataset.fullText, e=(c.ease||E.outCubic)(p), n=Math.floor(t.length*e);
      const glyphs='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@';
      let out=t.slice(0,n);
      for (let i=n;i<t.length;i++) out += t[i]===' '?' ':glyphs[(i*7 + Math.floor(p*60))%glyphs.length];
      el.textContent=out; el.style.opacity=1;
    }},
    tracking: { dur: 1.2, apply: (el,p,c) => { const e=(c.ease||E.outCubic)(p); el.style.opacity=e; el.style.letterSpacing=`${(1-e)*0.2}em`; } },
    gradientSweep: { dur: 2.0, apply: (el,p,c) => {
      el.style.opacity=Math.min(1,p*3);
      const fill=el.classList.contains('gradient-fill')?el:el.querySelector('.gradient-fill');
      if (fill) fill.style.backgroundPosition=`${100-p*100}% 50%`;
    }},
    splitReveal: { dur: 1.2, apply: (el,p,c) => { const e=(c.ease||E.inOutCubic)(p); el.style.opacity=1; el.style.clipPath=`inset(${(1-e)*50}% 0 ${(1-e)*50}% 0)`; } },

    /* --- numbers --- */
    counter: { dur: 1.8, apply: (el,p,c) => {
      const to=parseFloat(el.dataset.to)||0, dec=parseInt(el.dataset.decimals||'0',10), suf=el.dataset.suffix||'', pre=el.dataset.prefix||'';
      const val=to*(c.ease||E.outQuint)(p);
      el.textContent=pre+val.toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec})+suf;
      el.style.opacity=1;
    }},

    /* --- camera / framing --- */
    kenburns: { dur: 10, apply: (el,p,c) => {
      const z=parseFloat(el.dataset.zoom||'0.1'), dx=parseFloat(el.dataset.dx||'2'), dy=parseFloat(el.dataset.dy||'-2');
      el.style.opacity=1; el.style.transform=`scale(${1+z*p}) translate(${p*dx}%,${p*dy}%)`;
    }},
    cameraZoom: { dur: 2.5, apply: (el,p,c) => {
      const to=parseFloat(el.dataset.scale||'1.5'), ox=parseFloat(el.dataset.ox||'50'), oy=parseFloat(el.dataset.oy||'50'), e=(c.ease||E.inOutCubic)(p);
      el.style.opacity=1; el.style.transformOrigin=`${ox}% ${oy}%`; el.style.transform=`scale(${1+(to-1)*e})`;
    }},
    cameraPan: { dur: 3.0, apply: (el,p,c) => {
      const dx=parseFloat(el.dataset.dx||'0'), dy=parseFloat(el.dataset.dy||'0'), e=(c.ease||E.inOutCubic)(p);
      el.style.opacity=1; el.style.transform=`translate(${e*dx}px,${e*dy}px)`;
    }},
    focusBlur: { dur: 1.4, apply: (el,p,c) => { const e=(c.ease||E.outCubic)(p); el.style.opacity=Math.min(1,p*3); el.style.filter=`blur(${(1-e)*14}px)`; } },
    parallax: { dur: 8, apply: (el,p,c) => { const r=parseFloat(el.dataset.range||'40'); el.style.opacity=1; el.style.transform=`translateY(${(p-0.5)*r}px)`; } },

    /* --- decoration --- */
    glow: { dur: 1.6, apply: (el,p,c) => { el.style.opacity=1; const i=0.5+0.5*Math.sin(p*Math.PI*2); el.style.boxShadow=`0 0 ${30+i*60}px var(--accent, rgba(60,168,232,1))`; } },
    flicker: { dur: 1.0, apply: (el,p,c) => { const ph=(p*6)%1, on=ph>0.15&&ph<0.5?0:1; el.style.opacity=on?Math.min(1,p*2):0.15; } },
    highlight: { dur: 0.8, apply: (el,p,c) => {
      const e=(c.ease||E.outCubic)(p); el.style.opacity=1;
      el.style.backgroundImage=`linear-gradient(90deg, var(--highlight,#FFE066) ${e*100}%, transparent ${e*100}%)`;
      el.style.backgroundRepeat='no-repeat'; el.style.backgroundSize='100% 38%'; el.style.backgroundPosition='0 88%';
    }},
    rays: { dur: 1.4, apply: (el,p,c) => { el.style.opacity=Math.sin(p*Math.PI); const e=(c.ease||E.outCubic)(p); el.style.transform=`scale(${0.4+e*1.4}) rotate(${p*30}deg)`; } },
    particles: { dur: 8, apply: (el,p,c) => {
      el.style.opacity=1;
      el.querySelectorAll('.p').forEach((node,i)=>{
        const seed=(i*9301+49297)%233280/233280, drift=Math.sin(p*Math.PI*2+seed*6.28)*40, dy=-p*200-seed*100;
        node.setAttribute('transform',`translate(${drift},${dy})`); node.style.opacity=Math.sin(p*Math.PI)*0.8;
      });
    }},
    confetti: { dur: 1.5, apply: (el,p,c) => {
      el.style.opacity=1; const cs=el.querySelectorAll('.c'), e=E.outCubic(p);
      cs.forEach((node,i)=>{ const a=(i/cs.length)*Math.PI*2, d=e*320+(i%3)*40, x=Math.cos(a)*d, y=Math.sin(a)*d-e*80, r=e*540*((i%2)?1:-1); node.setAttribute('transform',`translate(${x},${y}) rotate(${r})`); node.style.opacity=1-p*0.4; });
    }},

    /* --- reveal / mask --- */
    reveal:   { dur: 1.2, apply: (el,p,c) => { const e=(c.ease||E.inOutCubic)(p); el.style.clipPath=`inset(0 ${(1-e)*100}% 0 0)`; el.style.opacity=1; } },
    revealUp: { dur: 1.2, apply: (el,p,c) => { const e=(c.ease||E.inOutCubic)(p); el.style.clipPath=`inset(${(1-e)*100}% 0 0 0)`; el.style.opacity=1; } },
    irisIn:   { dur: 1.4, apply: (el,p,c) => { const e=(c.ease||E.inOutCubic)(p); el.style.opacity=1; el.style.clipPath=`circle(${e*100}% at 50% 50%)`; } },

    /* --- SVG / vector --- */
    pathdraw: { dur: 2.0, apply: (el,p,c) => {
      if (!el.dataset.len){ try{el.dataset.len=el.getTotalLength();}catch(e){el.dataset.len=1000;} }
      const len=parseFloat(el.dataset.len); el.style.strokeDasharray=len; el.style.strokeDashoffset=len*(1-(c.ease||E.inOutCubic)(p)); el.style.opacity=1;
    }},
    motionPath: { dur: 2.0, apply: (el,p,c) => {
      const sel=el.dataset.path, path=sel?document.querySelector(sel):null; if(!path) return;
      if (!el.dataset.pathLen){ try{el.dataset.pathLen=path.getTotalLength();}catch(e){el.dataset.pathLen=0;} }
      const len=parseFloat(el.dataset.pathLen); if(!len) return;
      const pt=path.getPointAtLength(len*(c.ease||E.inOutCubic)(p));
      if (el.tagName==='circle'||el.tagName==='ellipse'){ el.setAttribute('cx',pt.x); el.setAttribute('cy',pt.y); }
      else el.setAttribute('transform',`translate(${pt.x},${pt.y})`);
      el.style.opacity=1;
    }},

    /* --- DATA-VIZ (NEW) --- */
    barGrow: { dur: 1.2, apply: (el,p,c) => {
      const e=(c.ease||E.outCubic)(p); el.style.opacity=1;
      const horiz = el.dataset.dir === 'h';
      el.style.transformOrigin = horiz ? 'left center' : 'bottom center';
      el.style.transform = horiz ? `scaleX(${e})` : `scaleY(${e})`;
    }},
    donutSweep: { dur: 1.6, apply: (el,p,c) => {
      // expects an SVG <circle> with a circumference; data-pct 0..100
      if (!el.dataset.circ){ try{el.dataset.circ=el.getTotalLength();}catch(e){el.dataset.circ=2*Math.PI*(parseFloat(el.getAttribute('r'))||100);} }
      const circ=parseFloat(el.dataset.circ), pct=parseFloat(el.dataset.pct||'100')/100, e=(c.ease||E.outCubic)(p);
      el.style.strokeDasharray=circ; el.style.strokeDashoffset=circ*(1 - pct*e); el.style.opacity=1;
    }},
    ringFill: { dur: 1.6, apply: (el,p,c) => { PRESETS.donutSweep.apply(el,p,c); } },
    lineDraw: { dur: 2.0, apply: (el,p,c) => { PRESETS.pathdraw.apply(el,p,c); } },
    comparisonBar: { dur: 1.3, apply: (el,p,c) => {
      const e=(c.ease||E.outCubic)(p), w=parseFloat(el.dataset.width||'100');
      el.style.opacity=1; el.style.width=`${w*e}%`;
    }},
  };

  /* ===========================================================================
     CONTINUOUS LOOPS — run forever after entrance settles.
     data-loop="float|breathe|orbit|rotate|sway|pulse|shimmer|beat"
     data-loop-amp, data-loop-period control magnitude / speed.
     Loops compose ON TOP of the settled entrance transform by appending.
  =========================================================================== */
  const LOOPS = {
    float:   (t,amp,per) => `translateY(${Math.sin(t/per*Math.PI*2)*amp}px)`,
    sway:    (t,amp,per) => `rotate(${Math.sin(t/per*Math.PI*2)*amp}deg)`,
    breathe: (t,amp,per) => `scale(${1 + Math.sin(t/per*Math.PI*2)*amp/100})`,
    rotate:  (t,amp,per) => `rotate(${(t/per*360)%360}deg)`,
    orbit:   (t,amp,per) => `translate(${Math.cos(t/per*Math.PI*2)*amp}px,${Math.sin(t/per*Math.PI*2)*amp}px)`,
    pulse:   (t,amp,per) => `scale(${1 + (0.5+0.5*Math.sin(t/per*Math.PI*2))*amp/100})`,
    shimmer: null, // handled specially (background-position)
    beat:    null, // handled specially (audio amplitude)
  };

  /* ===========================================================================
     ENGINE STATE
  =========================================================================== */
  let TIMINGS=[], SLIDE_LABELS=[], WORD_HITS=[], FALLBACK_DURATION=90, INITIAL_TIMINGS_HASH='';
  let deck, allSlides=[], currentSlide=0, rafId=0;
  let voAudio=null;
  const ANIMS=[]; const LOOP_ELS=[];
  let analyser=null, audioCtx=null, freqData=null;

  /* Synthetic clock (preview without audio) */
  let synthetic=false, synthTime=0, synthPlaying=false, synthStartedAt=0;
  function activateSynthetic(reason){ if(synthetic) return; synthetic=true; showPreviewBadge(reason); }
  function showPreviewBadge(reason){
    if (document.getElementById('sb-preview-badge')) return;
    const b=document.createElement('div'); b.id='sb-preview-badge';
    b.textContent='PREVIEW (no audio)';
    b.style.cssText='position:fixed;top:12px;left:12px;z-index:9999;font:600 11px/1 ui-monospace,monospace;letter-spacing:.1em;background:rgba(201,79,46,.92);color:#fff;padding:7px 12px;border-radius:6px;';
    document.body.appendChild(b);
  }
  function getTime(){ if(synthetic){ return synthPlaying ? synthTime+(performance.now()-synthStartedAt)/1000 : synthTime; } return voAudio?voAudio.currentTime:0; }
  function setTime(t){ if(synthetic){ synthTime=t; if(synthPlaying) synthStartedAt=performance.now(); } else if(voAudio) voAudio.currentTime=t; }
  function isPlaying(){ return synthetic ? synthPlaying : (voAudio && !voAudio.paused); }
  function getDuration(){ if(synthetic) return FALLBACK_DURATION; return (voAudio&&voAudio.duration&&isFinite(voAudio.duration))?voAudio.duration:FALLBACK_DURATION; }

  /* ===========================================================================
     SCHEDULING — parse .anim and .anim-group into a flat ANIMS list.
     Supports data-stagger (container), data-then (chained), data-loop (ambient).
  =========================================================================== */
  function parseChain(spec, baseStart, baseDur) {
    // "pulse@1.5; float" => [{preset, t, dur}] relative to end of entrance
    const out=[]; let cursor = baseStart + baseDur;
    spec.split(';').map(s=>s.trim()).filter(Boolean).forEach(part=>{
      let name=part, delay=0;
      const at=part.split('@');
      if (at.length===2){ name=at[0].trim(); delay=parseFloat(at[1]); }
      const preset=PRESETS[name]; if(!preset) return;
      const start = (at.length===2) ? baseStart + delay : cursor;
      out.push({ presetName:name, preset, t:start, dur:preset.dur });
      cursor = start + preset.dur;
    });
    return out;
  }

  function scheduleEl(el, cueTime) {
    let t;
    if (el.dataset.t !== undefined) t = parseFloat(el.dataset.t);
    else if (el.dataset.tRel !== undefined) t = cueTime + parseFloat(el.dataset.tRel);
    else t = cueTime;
    const presetName = el.dataset.anim || 'fadeIn';
    const preset = PRESETS[presetName] || PRESETS.fadeIn;
    const dur = el.dataset.dur !== undefined ? parseFloat(el.dataset.dur) : preset.dur;
    const ease = resolveEase(el);
    ANIMS.push({ el, t, dur, preset, name:presetName, ease });
    // Chained sequence
    if (el.dataset.then) {
      parseChain(el.dataset.then, t, dur).forEach(step=>{
        ANIMS.push({ el, t:step.t, dur:step.dur, preset:step.preset, name:step.presetName, ease:null, chained:true });
      });
    }
    // Continuous loop registered to start after entrance settles
    if (el.dataset.loop) {
      LOOP_ELS.push({ el, type:el.dataset.loop, amp:parseFloat(el.dataset.loopAmp||'10'), per:parseFloat(el.dataset.loopPeriod||'3'), startAt:t+dur, baseTransform:'' });
    }
  }

  function resolveSchedule() {
    ANIMS.length=0; LOOP_ELS.length=0; EXIT_SCHED.length=0;
    const cueFor={}; TIMINGS.forEach(t=>{cueFor[t.slide]=t.time;});
    // Containers with data-stagger distribute start times to children
    document.querySelectorAll('.anim-group[data-stagger]').forEach(group=>{
      const slideEl=group.closest('.slide'); const slideN=slideEl?parseInt(slideEl.dataset.slide||'0',10):0; const cue=cueFor[slideN]??0;
      const stagger=parseFloat(group.dataset.stagger||'0.1');
      const baseRel=group.dataset.tRel!==undefined?parseFloat(group.dataset.tRel):0;
      const presetName=group.dataset.anim||'fadeUp';
      const dur=group.dataset.dur!==undefined?parseFloat(group.dataset.dur):(PRESETS[presetName]?.dur||1.0);
      [...group.children].forEach((child,i)=>{
        child.classList.add('anim');
        if(!child.dataset.anim) child.dataset.anim=presetName;
        child.dataset.tRel=(baseRel + i*stagger).toFixed(3);
        if(child.dataset.dur===undefined) child.dataset.dur=dur;
        if(group.dataset.ease && !child.dataset.ease) child.dataset.ease=group.dataset.ease;
        scheduleEl(child, cue);
      });
    });
    // Standalone .anim elements (skip those already handled inside a stagger group)
    document.querySelectorAll('.anim').forEach(el=>{
      if (el.closest('.anim-group[data-stagger]') && el.parentElement.classList.contains('anim-group')) return;
      if (ANIMS.some(a=>a.el===el)) return;
      const slideEl=el.closest('.slide'); const slideN=slideEl?parseInt(slideEl.dataset.slide||'0',10):0; const cue=cueFor[slideN]??0;
      scheduleEl(el, cue);
    });
  }

  /* ===========================================================================
     APPLY — set every element's visual state for absolute time `time`.
  =========================================================================== */
  function applyAnimsAt(time) {
    // group anims by element so chained steps override in order
    for (const a of ANIMS) {
      const ctx={ ease:a.ease, time };
      if (time < a.t) {
        if (!a.chained) { a.el.style.opacity=0; a.el.classList.remove('anim-played'); }
      } else if (time <= a.t + a.dur) {
        a.preset.apply(a.el, Math.max(0,Math.min(1,(time-a.t)/a.dur)), ctx);
      } else {
        // settle once
        a.preset.apply(a.el, 1, ctx);
        a.el.classList.add('anim-played');
      }
    }
    applyLoops(time);
  }

  function applyLoops(time) {
    let beatAmp=0;
    if (analyser && freqData) { analyser.getByteFrequencyData(freqData); let s=0; for(let i=0;i<24;i++) s+=freqData[i]; beatAmp=(s/24)/255; }
    for (const L of LOOP_ELS) {
      if (time < L.startAt) continue;
      const lt = time - L.startAt;
      const fn = LOOPS[L.type];
      if (L.type==='beat') {
        L.el.style.transform = `scale(${1 + beatAmp*(L.amp/100)})`;
      } else if (L.type==='shimmer') {
        L.el.style.backgroundPosition = `${(lt/L.per*100)%100}% 50%`;
      } else if (fn) {
        // Append loop transform after any settled entrance transform
        const base = L.el.classList.contains('anim-played') ? '' : '';
        L.el.style.transform = (base?base+' ':'') + fn(lt, L.amp, L.per);
      }
    }
  }

  /* ===========================================================================
     SCENE TRANSITIONS + SHARED-ELEMENT (FLIP)
  =========================================================================== */
  let transitionOverlay=null;
  function ensureTransitionOverlay(){
    transitionOverlay=document.getElementById('transitionOverlay');
    if(!transitionOverlay){ transitionOverlay=document.createElement('div'); transitionOverlay.id='transitionOverlay'; transitionOverlay.className='transition-overlay'; document.body.appendChild(transitionOverlay); }
  }
  /* --- Presentation mode: slides stacked in place, transitioned (not scrolled) --- */
  let presentationReady=false;
  function setupPresentationMode(){
    if(!deck) return;
    deck.style.overflow='hidden';
    deck.style.scrollSnapType='none';
    deck.style.perspective='2000px';      // enables 3D flip transitions
    allSlides.forEach((s,i)=>{
      s.style.position='absolute'; s.style.top='0'; s.style.left='0';
      s.style.willChange='transform,opacity,filter';
      s.style.backfaceVisibility='hidden';
      const on = (i===currentSlide-1) || (currentSlide===0 && i===0);
      s.style.opacity = on?'1':'0';
      s.style.visibility = on?'visible':'hidden';
      s.style.transform='none'; s.style.filter='none';
      s.style.zIndex = on?'2':'1';
    });
    presentationReady=true;
  }
  function showOnly(n){
    allSlides.forEach((s,i)=>{
      const on=i===n-1;
      s.style.opacity=on?'1':'0'; s.style.visibility=on?'visible':'hidden';
      s.style.transform='none'; s.style.filter='none'; s.style.clipPath='none';
      s.style.zIndex=on?'2':'1';
    });
  }
  const EZ='cubic-bezier(0.7,0,0.2,1)', EZ_SOFT='cubic-bezier(0.22,1,0.36,1)';
  function flashOverlay(color, dur){
    const ol=transitionOverlay; ol.className='transition-overlay'; ol.style.background=color;
    ol.style.opacity='1';
    ol.animate([{opacity:0},{opacity:0.9,offset:0.4},{opacity:0}],{duration:dur,easing:'ease-in-out',fill:'forwards'}).onfinish=()=>{ol.style.opacity='0';ol.style.background='';};
  }

  /* TRANSITIONS registry: (from, to) => duration(ms). The wrapper makes `to`
     visible/top before calling and hides `from` after. Both are full-frame
     1920x1080 (or 1080x1920) slide elements stacked at the same position. */
  const TRANSITIONS = {
    cut: (f,t)=>{ return 0; },
    crossDissolve: (f,t,d=700)=>{
      if(f) f.animate([{opacity:1},{opacity:0}],{duration:d,easing:EZ_SOFT,fill:'forwards'});
      t.animate([{opacity:0},{opacity:1}],{duration:d,easing:EZ_SOFT,fill:'forwards'}); return d;
    },
    fade: (f,t,d=900)=>{ // through black
      flashOverlay('#000', d); if(f) f.animate([{opacity:1},{opacity:0}],{duration:d*0.5,fill:'forwards'});
      t.animate([{opacity:0},{opacity:0,offset:0.5},{opacity:1}],{duration:d,fill:'forwards'}); return d;
    },
    pushLeft: (f,t,d=750)=>{ if(f) f.animate([{transform:'translateX(0)'},{transform:'translateX(-100%)'}],{duration:d,easing:EZ,fill:'forwards'}); t.animate([{transform:'translateX(100%)'},{transform:'translateX(0)'}],{duration:d,easing:EZ,fill:'forwards'}); return d; },
    pushRight:(f,t,d=750)=>{ if(f) f.animate([{transform:'translateX(0)'},{transform:'translateX(100%)'}],{duration:d,easing:EZ,fill:'forwards'}); t.animate([{transform:'translateX(-100%)'},{transform:'translateX(0)'}],{duration:d,easing:EZ,fill:'forwards'}); return d; },
    pushUp:   (f,t,d=750)=>{ if(f) f.animate([{transform:'translateY(0)'},{transform:'translateY(-100%)'}],{duration:d,easing:EZ,fill:'forwards'}); t.animate([{transform:'translateY(100%)'},{transform:'translateY(0)'}],{duration:d,easing:EZ,fill:'forwards'}); return d; },
    pushDown: (f,t,d=750)=>{ if(f) f.animate([{transform:'translateY(0)'},{transform:'translateY(100%)'}],{duration:d,easing:EZ,fill:'forwards'}); t.animate([{transform:'translateY(-100%)'},{transform:'translateY(0)'}],{duration:d,easing:EZ,fill:'forwards'}); return d; },
    coverLeft:(f,t,d=700)=>{ t.style.zIndex='3'; t.animate([{transform:'translateX(100%)'},{transform:'translateX(0)'}],{duration:d,easing:EZ,fill:'forwards'}); return d; },
    revealRight:(f,t,d=700)=>{ if(f){ f.style.zIndex='3'; f.animate([{transform:'translateX(0)'},{transform:'translateX(100%)'}],{duration:d,easing:EZ,fill:'forwards'}); } return d; },
    zoomIn:  (f,t,d=800)=>{ if(f) f.animate([{transform:'scale(1)',opacity:1},{transform:'scale(1.18)',opacity:0}],{duration:d,easing:EZ_SOFT,fill:'forwards'}); t.animate([{transform:'scale(0.6)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:d,easing:EZ_SOFT,fill:'forwards'}); return d; },
    zoomOut: (f,t,d=800)=>{ if(f) f.animate([{transform:'scale(1)',opacity:1},{transform:'scale(0.82)',opacity:0}],{duration:d,easing:EZ_SOFT,fill:'forwards'}); t.animate([{transform:'scale(1.3)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:d,easing:EZ_SOFT,fill:'forwards'}); return d; },
    flip3D:  (f,t,d=900)=>{ t.style.opacity='1';
      if(f) f.animate([{transform:'rotateY(0deg)',opacity:1},{transform:'rotateY(-90deg)',opacity:0,offset:0.5},{transform:'rotateY(-90deg)',opacity:0}],{duration:d,easing:'cubic-bezier(0.6,0,0.4,1)',fill:'forwards'});
      t.animate([{transform:'rotateY(90deg)',opacity:0,offset:0},{transform:'rotateY(90deg)',opacity:0,offset:0.5},{transform:'rotateY(0deg)',opacity:1}],{duration:d,easing:'cubic-bezier(0.6,0,0.4,1)',fill:'forwards'}); return d; },
    spinZoom:(f,t,d=850)=>{ if(f) f.animate([{transform:'scale(1) rotate(0)',opacity:1},{transform:'scale(1.2) rotate(8deg)',opacity:0}],{duration:d,easing:EZ_SOFT,fill:'forwards'}); t.animate([{transform:'scale(0.7) rotate(-12deg)',opacity:0},{transform:'scale(1) rotate(0)',opacity:1}],{duration:d,easing:EZ_SOFT,fill:'forwards'}); return d; },
    whipPan: (f,t,d=480)=>{ if(f) f.animate([{transform:'translateX(0)',filter:'blur(0)'},{transform:'translateX(-60%)',filter:'blur(20px)',opacity:0}],{duration:d,easing:EZ,fill:'forwards'}); t.animate([{transform:'translateX(60%)',filter:'blur(20px)',opacity:0},{transform:'translateX(0)',filter:'blur(0)',opacity:1}],{duration:d,easing:EZ,fill:'forwards'}); return d; },
    blurThrough:(f,t,d=800)=>{ if(f) f.animate([{filter:'blur(0)',opacity:1},{filter:'blur(28px)',opacity:0}],{duration:d,easing:EZ_SOFT,fill:'forwards'}); t.animate([{filter:'blur(28px)',opacity:0},{filter:'blur(0)',opacity:1}],{duration:d,easing:EZ_SOFT,fill:'forwards'}); return d; },
    irisOpen:(f,t,d=850)=>{ t.style.zIndex='3'; t.animate([{clipPath:'circle(0% at 50% 50%)'},{clipPath:'circle(75% at 50% 50%)'}],{duration:d,easing:EZ_SOFT,fill:'forwards'}); return d; },
    barWipe: (f,t,d=700)=>{ t.style.zIndex='3'; t.animate([{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0 0 0)'}],{duration:d,easing:EZ,fill:'forwards'}); return d; },
    barWipeUp:(f,t,d=700)=>{ t.style.zIndex='3'; t.animate([{clipPath:'inset(100% 0 0 0)'},{clipPath:'inset(0 0 0 0)'}],{duration:d,easing:EZ,fill:'forwards'}); return d; },
    glitch:  (f,t,d=520)=>{ flashOverlay('rgba(124,92,255,.5)', d);
      if(f) f.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate(-12px,4px)',opacity:.6,offset:.2},{transform:'translate(10px,-6px)',opacity:.4,offset:.5},{transform:'translate(0,0)',opacity:0}],{duration:d,easing:'steps(6)',fill:'forwards'});
      t.animate([{transform:'translate(14px,-4px)',opacity:0,offset:0},{transform:'translate(-8px,6px)',opacity:.7,offset:.5},{transform:'translate(0,0)',opacity:1}],{duration:d,easing:'steps(6)',fill:'forwards'}); return d; },
    // overlay-flourish swaps (instant slide swap + colored overlay)
    flash:  (f,t,d=420)=>{ flashOverlay('#fff', d); if(f) f.animate([{opacity:1},{opacity:0}],{duration:d*0.4,fill:'forwards'}); t.animate([{opacity:0},{opacity:1}],{duration:d*0.5,fill:'forwards'}); return d; },
    blocks: (f,t,d=620)=>{ flashOverlay('var(--accent,#7C5CFF)', d); if(f) f.animate([{opacity:1},{opacity:0,offset:0.5}],{duration:d,fill:'forwards'}); t.animate([{opacity:0,offset:0.5},{opacity:1}],{duration:d,fill:'forwards'}); return d; },
  };
  // back-compat aliases
  TRANSITIONS.dissolve = TRANSITIONS.crossDissolve;
  TRANSITIONS.wipe = TRANSITIONS.barWipe;

  let transitioning=false;
  function goToSlide(n, type, instant){
    if(!presentationReady) setupPresentationMode();
    const fromEl=allSlides[currentSlide-1]||null, toEl=allSlides[n-1];
    if(!toEl){ return; }
    currentSlide=n; updateActiveMenu(n);
    if(instant || type==='cut' || !TRANSITIONS[type]){ showOnly(n); return; }
    // shared-element capture (before showing target)
    const fromMap=captureSharedRects(fromEl);
    // prepare target on top
    toEl.style.visibility='visible'; toEl.style.opacity='1'; toEl.style.zIndex='3';
    if(fromEl){ fromEl.style.visibility='visible'; fromEl.style.zIndex='2'; }
    transitioning=true;
    const dur=TRANSITIONS[type](fromEl,toEl)||0;
    // shared-element morph rides on top once target laid out
    requestAnimationFrame(()=>requestAnimationFrame(()=>playSharedTransition(fromMap,toEl)));
    setTimeout(()=>{
      if(currentSlide===n){ // settle: only target visible, transforms cleared
        allSlides.forEach((s,i)=>{ const on=i===n-1; s.style.opacity=on?'1':'0'; s.style.visibility=on?'visible':'hidden'; s.style.transform='none'; s.style.filter='none'; s.style.clipPath='none'; s.style.zIndex=on?'2':'1'; });
      }
      transitioning=false;
    }, Math.max(0,dur)+40);
  }
  // thin shim retained for any external callers
  function playTransition(kind){ /* handled by goToSlide now */ }

  /* Shared-element transition: when leaving slide A for slide B, any element in B
     with data-shared-id matching an element in A animates from A's rect to B's. */
  let lastSharedRects={};
  function captureSharedRects(slideEl){
    const map={};
    if(slideEl) slideEl.querySelectorAll('[data-shared-id]').forEach(el=>{ map[el.dataset.sharedId]=el.getBoundingClientRect(); });
    return map;
  }
  function playSharedTransition(fromMap, toSlide){
    if(!toSlide) return;
    toSlide.querySelectorAll('[data-shared-id]').forEach(el=>{
      const id=el.dataset.sharedId, from=fromMap[id]; if(!from) return;
      const to=el.getBoundingClientRect(); if(!to.width) return;
      const dx=from.left-to.left, dy=from.top-to.top, sx=from.width/to.width||1, sy=from.height/to.height||1;
      el.animate([
        { transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`, opacity:0.85 },
        { transform:'translate(0,0) scale(1,1)', opacity:1 }
      ], { duration:700, easing:'cubic-bezier(0.22,1,0.36,1)', fill:'both' });
    });
  }

  /* ===========================================================================
     CAMERA RIG — a .camera wrapper per slide, keyframed via data-camera
     data-camera="2.0=>scale:1.3,x:-40; 4.0=>scale:1.0" (time=>props)
     Applied each tick by interpolating between keyframes.
  =========================================================================== */
  const CAMERAS=[];
  function resolveCameras(){
    CAMERAS.length=0;
    const cueFor={}; TIMINGS.forEach(t=>{cueFor[t.slide]=t.time;});
    document.querySelectorAll('.camera[data-camera]').forEach(cam=>{
      const slideEl=cam.closest('.slide'); const slideN=slideEl?parseInt(slideEl.dataset.slide||'0',10):0; const cue=cueFor[slideN]??0;
      const kfs=cam.dataset.camera.split(';').map(s=>s.trim()).filter(Boolean).map(seg=>{
        const [t,props]=seg.split('=>'); const o={t:cue+parseFloat(t),scale:1,x:0,y:0};
        (props||'').split(',').forEach(pr=>{ const [k,v]=pr.split(':'); if(k&&v!==undefined) o[k.trim()]=parseFloat(v); });
        return o;
      });
      kfs.unshift({t:cue,scale:1,x:0,y:0});
      CAMERAS.push({cam,kfs});
    });
  }
  function applyCameras(time){
    for(const C of CAMERAS){
      const kfs=C.kfs; let a=kfs[0],b=kfs[0];
      for(let i=0;i<kfs.length;i++){ if(time>=kfs[i].t){a=kfs[i]; b=kfs[i+1]||kfs[i];} }
      let p = (b.t>a.t) ? (time-a.t)/(b.t-a.t) : 1; p=Math.max(0,Math.min(1,p)); const e=EASE.inOutCubic(p);
      const sc=a.scale+(b.scale-a.scale)*e, x=a.x+(b.x-a.x)*e, y=a.y+(b.y-a.y)*e;
      C.cam.style.transformOrigin='center center';
      C.cam.style.transform=`scale(${sc}) translate(${x}px,${y}px)`;
    }
  }

  /* ===========================================================================
     WORD HITS
  =========================================================================== */
  const wordHitState=new WeakMap();
  function applyWordHits(time){
    for(const h of WORD_HITS){
      if(time>=h.time && time<=h.time+0.6){
        const el=document.querySelector(h.sel); if(!el) continue;
        if(wordHitState.get(el)===h.time) continue; wordHitState.set(el,h.time);
        const preset=PRESETS[h.hit]||PRESETS.pulse, start=performance.now();
        (function frame(){ const p=Math.min(1,(performance.now()-start)/600); preset.apply(el,p,{}); if(p<1) requestAnimationFrame(frame); })();
      }
    }
  }

  /* ===========================================================================
     UI — controls, jump menu, progress, calibration
  =========================================================================== */
  let playControls,playBtn,resetBtn,jumpBtn,jumpMenu,progress;
  function buildUI(){
    if(document.getElementById('playControls')){ wireUI(); return; }
    const c=document.createElement('div'); c.className='play-controls'; c.id='playControls';
    c.innerHTML='<button id="jumpBtn" title="Jump (J)"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 6h18v2H3zM3 11h18v2H3zM3 16h18v2H3z"/></svg></button>'+
      '<button id="resetBtn" title="Reset (R)"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 5V2L7 6.5 12 11V8a5 5 0 11-5 5H5a7 7 0 107-7z"/></svg></button>'+
      '<button id="playBtn" title="Play/Pause (Space)"><svg class="icon-play" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M7 4l13 8L7 20z"/></svg><svg class="icon-pause" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="display:none"><path d="M7 4h4v16H7zM13 4h4v16h-4z"/></svg></button>';
    document.body.appendChild(c);
    const pr=document.createElement('div'); pr.className='play-progress'; pr.id='playProgress'; document.body.appendChild(pr);
    const jm=document.createElement('div'); jm.className='jump-menu'; jm.id='jumpMenu'; document.body.appendChild(jm);
    injectControlCSS(); wireUI();
  }
  function injectControlCSS(){
    if(document.getElementById('sb-ctrl-css')) return;
    const s=document.createElement('style'); s.id='sb-ctrl-css';
    s.textContent=`.play-controls{position:fixed;top:12px;right:12px;display:flex;gap:8px;z-index:9999;opacity:.42}.play-controls button{width:36px;height:36px;border-radius:50%;background:rgba(12,18,32,.62);border:1px solid rgba(255,255,255,.18);cursor:pointer;padding:0;color:#fff;display:flex;align-items:center;justify-content:center}.play-controls.is-playing .icon-play{display:none}.play-controls.is-playing .icon-pause{display:block!important}.play-progress{position:fixed;top:0;left:0;height:2px;background:var(--accent,#3CA8E8);z-index:9998;width:0;opacity:0;transition:opacity .3s}.play-progress.is-active{opacity:.75}.jump-menu{position:fixed;top:56px;right:12px;width:320px;max-height:calc(100vh - 80px);overflow-y:auto;background:rgba(12,18,32,.94);border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:6px;z-index:9999;opacity:0;pointer-events:none;transform:translateY(-8px);transition:opacity .2s,transform .2s;backdrop-filter:blur(8px)}.jump-menu.is-open{opacity:1;pointer-events:auto;transform:translateY(0)}.jump-menu button{display:flex;align-items:baseline;gap:10px;width:100%;padding:7px 12px;background:transparent;border:none;border-radius:6px;color:rgba(255,255,255,.85);font:12.5px/1.35 system-ui,sans-serif;text-align:left;cursor:pointer}.jump-menu button .jm-num{font-weight:700;color:var(--accent,#3CA8E8);min-width:22px;font-size:11px}.jump-menu button.is-active{background:rgba(60,168,232,.22);color:#fff}`;
    document.head.appendChild(s);
  }
  function wireUI(){
    playControls=document.getElementById('playControls'); playBtn=document.getElementById('playBtn');
    resetBtn=document.getElementById('resetBtn'); jumpBtn=document.getElementById('jumpBtn');
    jumpMenu=document.getElementById('jumpMenu'); progress=document.getElementById('playProgress');
    buildJumpMenu();
    jumpBtn.addEventListener('click',e=>{e.stopPropagation(); jumpMenu.classList.toggle('is-open');});
    jumpMenu.addEventListener('click',e=>{const b=e.target.closest('button[data-slide]'); if(!b)return; jumpToSlide(parseInt(b.dataset.slide,10)); jumpMenu.classList.remove('is-open');});
    document.addEventListener('click',e=>{ if(!jumpMenu.contains(e.target)&&e.target!==jumpBtn) jumpMenu.classList.remove('is-open'); });
    playBtn.addEventListener('click',()=>isPlaying()?pause():play());
    resetBtn.addEventListener('click',reset);
  }
  function buildJumpMenu(){
    jumpMenu.innerHTML='';
    const frag=document.createDocumentFragment();
    TIMINGS.forEach((cue,idx)=>{
      const btn=document.createElement('button'); btn.dataset.slide=cue.slide;
      const mm=Math.floor(cue.time/60).toString().padStart(2,'0'), ss=Math.floor(cue.time%60).toString().padStart(2,'0');
      btn.innerHTML='<span class="jm-num">'+String(cue.slide).padStart(2,'0')+'</span><span class="jm-title" style="flex:1">'+(SLIDE_LABELS[idx]||('Slide '+cue.slide))+'</span><span class="jm-num" style="min-width:38px;text-align:right;opacity:.6">'+mm+':'+ss+'</span>';
      frag.appendChild(btn);
    });
    jumpMenu.appendChild(frag);
  }
  function updateActiveMenu(n){ jumpMenu.querySelectorAll('button').forEach(b=>b.classList.toggle('is-active',parseInt(b.dataset.slide,10)===n)); }

  function jumpToSlide(n){
    const cue=TIMINGS.find(t=>t.slide===n); if(!cue) return;
    setTime(cue.time+0.01);
    const arriving=allSlides[n-1];
    const trans = arriving?.dataset.transitionIn || 'crossDissolve';
    goToSlide(n, trans, !isPlaying());  // instant when paused/scrubbing, animated when playing
    currentSlide=n; updateActiveMenu(n);
    progress.style.width=(cue.time/getDuration()*100)+'%'; progress.classList.add('is-active');
    applyAnimsAt(getTime()); applyCameras(getTime());
  }

  /* ===========================================================================
     TICK + TRANSPORT
  =========================================================================== */
  function tick(){
    const elapsed=getTime();
    let target=TIMINGS[0].slide;
    for(const t of TIMINGS){ if(elapsed>=t.time) target=t.slide; else break; }
    if(target!==currentSlide){
      const arriving=allSlides[target-1];
      const trans=arriving?.dataset.transitionIn||'crossDissolve';
      // when scrubbing far (jump) do it instantly; when playing forward, animate
      const instant = Math.abs(target-currentSlide)>1 && !isPlaying();
      goToSlide(target, trans, instant);
    }
    applyAnimsAt(elapsed); applyCameras(elapsed); applyWordHits(elapsed);
    progress.style.width=Math.min(elapsed/getDuration()*100,100)+'%';
    if(isPlaying() && elapsed<getDuration()+0.5) rafId=requestAnimationFrame(tick);
  }
  function ensureAudioGraph(){
    if(synthetic||analyser||!voAudio) return;
    try{
      audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      const src=audioCtx.createMediaElementSource(voAudio);
      analyser=audioCtx.createAnalyser(); analyser.fftSize=64; freqData=new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser); analyser.connect(audioCtx.destination);
    }catch(e){ analyser=null; }
  }
  function play(){
    if(synthetic){ synthPlaying=true; synthStartedAt=performance.now(); playControls.classList.add('is-playing'); progress.classList.add('is-active'); cancelAnimationFrame(rafId); rafId=requestAnimationFrame(tick); return; }
    voAudio.play().then(()=>{ ensureAudioGraph(); if(audioCtx&&audioCtx.state==='suspended') audioCtx.resume(); playControls.classList.add('is-playing'); progress.classList.add('is-active'); cancelAnimationFrame(rafId); rafId=requestAnimationFrame(tick); }).catch(err=>console.warn('Audio play blocked:',err));
  }
  function pause(){ if(synthetic){ synthTime=getTime(); synthPlaying=false; } else if(voAudio) voAudio.pause(); playControls.classList.remove('is-playing'); cancelAnimationFrame(rafId); }
  function reset(){ pause(); if(synthetic) synthTime=0; else if(voAudio) voAudio.currentTime=0; currentSlide=1; progress.style.width='0%'; progress.classList.remove('is-active'); showOnly(1); updateActiveMenu(1); ANIMS.forEach(a=>{a.el.classList.remove('anim-played'); if(!a.chained) a.el.style.opacity=0;}); applyAnimsAt(0); applyCameras(0); }

  /* ===========================================================================
     CALIBRATION (T/M/Bksp/A/E/Esc + bracket nudge)
  =========================================================================== */
  const CALIB={
    active:false,cues:[],badge:null,
    key(){return 'storyboard-calib::'+location.pathname;},
    start(){this.active=true;this.cues=[0];this.ensureBadge();this.update();},
    exitMode(){this.active=false;if(this.badge){this.badge.remove();this.badge=null;}},
    mark(t){if(!this.active||this.cues.length>=TIMINGS.length)return; if(t<=this.cues[this.cues.length-1])t=this.cues[this.cues.length-1]+0.1; this.cues.push(parseFloat(t.toFixed(2)));this.update();},
    undo(){if(this.active&&this.cues.length>1){this.cues.pop();this.update();}},
    apply(){const n=Math.min(this.cues.length,TIMINGS.length);for(let i=0;i<n;i++)TIMINGS[i].time=this.cues[i];resolveSchedule();resolveCameras();buildJumpMenu();applyAnimsAt(getTime());try{localStorage.setItem(this.key(),JSON.stringify({sourceHash:INITIAL_TIMINGS_HASH,cues:this.cues}));}catch(e){}this.flash('APPLIED · '+n+' cues');},
    exportCues(){const txt='timings: '+JSON.stringify(this.cues.map((t,i)=>({time:t,slide:i+1})));console.log(txt);if(navigator.clipboard)navigator.clipboard.writeText(txt).then(()=>this.flash('COPIED'),()=>this.flash('LOGGED'));else this.flash('LOGGED');},
    loadSaved(){try{const s=localStorage.getItem(this.key());if(!s)return false;const p=JSON.parse(s);if(!p||!p.sourceHash||!Array.isArray(p.cues)){localStorage.removeItem(this.key());return false;}if(p.sourceHash!==INITIAL_TIMINGS_HASH){localStorage.removeItem(this.key());return false;}const n=Math.min(p.cues.length,TIMINGS.length);for(let i=0;i<n;i++)TIMINGS[i].time=p.cues[i];this.cues=p.cues;resolveSchedule();resolveCameras();return true;}catch(e){return false;}},
    clearSaved(){try{localStorage.removeItem(this.key());}catch(e){}},
    ensureBadge(){if(this.badge)return;const b=document.createElement('div');b.style.cssText='position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9999;font:600 12px/1.5 ui-monospace,monospace;background:rgba(60,168,232,.95);color:#fff;padding:10px 18px;border-radius:8px;text-align:center;min-width:420px';document.body.appendChild(b);this.badge=b;},
    update(){if(!this.badge)return;const n=this.cues.length,total=TIMINGS.length;const l=n>=total?'ALL CAPTURED — [A]pply · [E]xport · [Esc]':'CALIBRATION · '+n+'/'+total+' · next: slide '+(n+1);this.badge.innerHTML=l+'<br><span style="opacity:.85;font-weight:400">[M] mark · [Bksp] undo · [A]pply · [E]xport · [Esc]</span>';},
    flash(m){if(!this.badge){const t=document.createElement('div');t.textContent=m;t.style.cssText='position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9999;font:600 12px/1.4 ui-monospace,monospace;background:rgba(10,132,120,.95);color:#fff;padding:10px 18px;border-radius:8px';document.body.appendChild(t);setTimeout(()=>t.remove(),2000);}else{this.badge.innerHTML='<strong>'+m+'</strong>';setTimeout(()=>{if(this.badge)this.update();},1500);}}
  };

  function bindKeys(){
    document.addEventListener('keydown',e=>{
      if(e.target.matches('input,textarea,[contenteditable]'))return;
      if(e.code==='KeyT'){e.preventDefault();CALIB.active?CALIB.exitMode():CALIB.start();return;}
      if(CALIB.active){
        if(e.code==='KeyM'){e.preventDefault();CALIB.mark(getTime());return;}
        if(e.code==='Backspace'){e.preventDefault();CALIB.undo();return;}
        if(e.code==='KeyA'){e.preventDefault();CALIB.apply();return;}
        if(e.code==='KeyE'){e.preventDefault();CALIB.exportCues();return;}
        if(e.code==='Escape'){e.preventDefault();CALIB.exitMode();return;}
      }
      if(e.code==='Space'){e.preventDefault();isPlaying()?pause():play();}
      else if(e.code==='KeyR'||e.code==='Home'){e.preventDefault();reset();}
      else if(e.code==='KeyJ'){e.preventDefault();jumpMenu.classList.toggle('is-open');}
      else if(e.code==='Escape'){jumpMenu.classList.remove('is-open');}
      else if(e.code==='ArrowRight'){e.preventDefault();const n=TIMINGS.find(t=>t.time>getTime()+0.1);if(n)jumpToSlide(n.slide);}
      else if(e.code==='ArrowLeft'){e.preventDefault();const pa=[...TIMINGS].reverse().find(t=>t.time<getTime()-0.5);if(pa)jumpToSlide(pa.slide);}
      else if(e.code==='BracketLeft'||e.code==='Comma'){e.preventDefault();const c=TIMINGS.find(t=>t.slide===currentSlide);if(c&&c.slide>1){c.time=Math.max(0,c.time-0.25);resolveSchedule();buildJumpMenu();applyAnimsAt(getTime());CALIB.flash('Slide '+c.slide+': '+c.time.toFixed(2)+'s');}}
      else if(e.code==='BracketRight'||e.code==='Period'){e.preventDefault();const c=TIMINGS.find(t=>t.slide===currentSlide);if(c&&c.slide>1){c.time+=0.25;resolveSchedule();buildJumpMenu();applyAnimsAt(getTime());CALIB.flash('Slide '+c.slide+': '+c.time.toFixed(2)+'s');}}
    });
  }

  /* ===========================================================================
     SCALE-TO-FIT — read .deck native size, fit into viewport
  =========================================================================== */
  function scaleToFit(){
    const dw=deck.offsetWidth||1920, dh=deck.offsetHeight||1080;
    const s=Math.min(window.innerWidth/dw, window.innerHeight/dh);
    deck.style.transform=`translate3d(0,0,0) scale(${s})`;
  }

  /* ===========================================================================
     PUBLIC API
  =========================================================================== */
  function init(opts){
    opts=opts||{};
    TIMINGS=opts.timings||[{time:0,slide:1}];
    SLIDE_LABELS=opts.labels||[];
    WORD_HITS=opts.wordHits||[];
    FALLBACK_DURATION=opts.fallbackDuration||90;
    INITIAL_TIMINGS_HASH=TIMINGS.map(t=>t.slide+':'+t.time.toFixed(2)).join(',');

    deck=document.getElementById('deck')||document.querySelector('.deck');
    allSlides=[...document.querySelectorAll('.slide')];
    voAudio=document.getElementById('voAudio');

    scaleToFit(); window.addEventListener('resize',scaleToFit);
    ensureTransitionOverlay();
    buildUI();
    resolveSchedule();
    resolveCameras();
    bindKeys();
    currentSlide=1; setupPresentationMode();   // stack slides in place, show slide 1

    if(voAudio){
      voAudio.addEventListener('error',()=>activateSynthetic('audio error'));
      voAudio.addEventListener('timeupdate',()=>{ if(voAudio.paused){ applyAnimsAt(voAudio.currentTime); applyCameras(voAudio.currentTime);} });
      voAudio.addEventListener('seeked',()=>{ applyAnimsAt(voAudio.currentTime); applyCameras(voAudio.currentTime); });
      voAudio.addEventListener('ended',()=>{ playControls.classList.remove('is-playing'); progress.style.width='100%'; });
      setTimeout(()=>{ if(voAudio.readyState===0&&!voAudio.duration) activateSynthetic('no audio source'); },1200);
    } else { activateSynthetic('no audio element'); }

    if(CALIB.loadSaved()){ buildJumpMenu(); }
    applyAnimsAt(0); applyCameras(0);

    Storyboard.cues=TIMINGS; Storyboard.calib=CALIB; Storyboard.presets=Object.keys(PRESETS);
    return Storyboard;
  }

  const Storyboard = {
    init, EASE, PRESETS, LOOPS,
    play, pause, reset,
    seek(t){ setTime(t); let target=TIMINGS[0].slide; for(const c of TIMINGS){ if(t>=c.time) target=c.slide; else break; } if(target!==currentSlide){ goToSlide(target,'cut',true); } applyAnimsAt(t); applyCameras(t); },
    transitions:()=>Object.keys(TRANSITIONS),
    goToSlide,
    currentSlide:()=>currentSlide,
    isSynthetic:()=>synthetic,
    registerPreset(name,def){ PRESETS[name]=def; },
    registerEase(name,fn){ EASE[name]=fn; },
  };

  global.Storyboard = Storyboard;
})(typeof window!=='undefined'?window:this);
