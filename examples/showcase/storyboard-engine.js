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

  /* ===== RAW-MOTION PACK (v0.5): kinetic type, annotations, exits, ambient ===== */
  Object.assign(PRESETS, {
    lineReveal: { dur: 1.4, apply: (el,p,c) => {
      if(!el.dataset.lrInit){
        el.dataset.lrInit='1';
        const lines = el.innerHTML.split(/<br\s*\/?>/i);
        el.innerHTML = lines.map(seg => '<span class="lr-line" style="display:block;overflow:hidden;padding-bottom:0.04em"><span class="lr-inner" style="display:inline-block;transform:translateY(110%);will-change:transform">'+seg+'</span></span>').join('');
        el.dataset.lrN = el.querySelectorAll('.lr-inner').length;
      }
      el.style.opacity=1;
      const n=parseInt(el.dataset.lrN,10), stagger=0.16, span=(1-(n-1)*stagger);
      el.querySelectorAll('.lr-inner').forEach((inner,i)=>{
        const lp=Math.max(0,Math.min(1,(p-i*stagger)/span)), e=E.outQuint(lp);
        inner.style.transform='translateY('+((1-e)*110)+'%)';
      });
    }},
    wordSwap: { dur: 3.0, apply: (el,p,c) => {
      if(!el.dataset.wsInit){
        el.dataset.wsInit='1'; el.style.position='relative'; el.style.minHeight='1.1em';
        const words=(el.dataset.words||el.textContent).split('|').map(w=>w.trim());
        el.dataset.wsN=words.length;
        el.innerHTML=words.map((w,i)=>'<span class="ws-w" data-i="'+i+'" style="position:absolute;left:0;right:0;top:0;opacity:0;will-change:transform,opacity">'+w+'</span>').join('');
      }
      el.style.opacity=1;
      const n=parseInt(el.dataset.wsN,10), seg=1/n, active=Math.min(n-1,Math.floor(p/seg)), local=(p-active*seg)/seg;
      el.querySelectorAll('.ws-w').forEach((w,i)=>{
        if(i!==active){ w.style.opacity=0; w.style.transform='scale(0.8)'; return; }
        let o,sc;
        if(local<0.3){ const e=E.outBack(local/0.3); o=e; sc=0.7+0.3*e; }
        else if(local>0.82 && i<n-1){ const e=(local-0.82)/0.18; o=1-e; sc=1+0.15*e; }
        else { o=1; sc=1; }
        w.style.opacity=o; w.style.transform='scale('+sc+')';
      });
    }},
    underlineDraw: { dur: 0.7, apply: (el,p,c) => { _annDraw(el,'underline'); el.style.opacity=1; _annStroke(el,(c.ease||E.outCubic)(p)); }},
    circleScribble:{ dur: 0.9, apply: (el,p,c) => { _annDraw(el,'circle');    el.style.opacity=1; _annStroke(el,(c.ease||E.outCubic)(p)); }},
    boxDraw:       { dur: 0.8, apply: (el,p,c) => { _annDraw(el,'box');       el.style.opacity=1; _annStroke(el,(c.ease||E.outCubic)(p)); }},
    strikethrough: { dur: 0.5, apply: (el,p,c) => { _annDraw(el,'strike');    el.style.opacity=1; _annStroke(el,(c.ease||E.outCubic)(p)); }},
    aurora: { dur: 9999, apply: (el,p,c) => {
      el.style.opacity=Math.min(1,p*40); const t=c.time||0;
      const a1=(50+Math.sin(t*0.13)*30)+'% '+(40+Math.cos(t*0.11)*25)+'%';
      const a2=(50+Math.cos(t*0.09)*35)+'% '+(60+Math.sin(t*0.14)*22)+'%';
      const a3=(30+Math.sin(t*0.07)*25)+'% '+(70+Math.cos(t*0.10)*20)+'%';
      const c1=el.dataset.c1||'var(--accent,#7C5CFF)', c2=el.dataset.c2||'var(--accent2,#19E3B1)', c3=el.dataset.c3||'var(--accent3,#FF5C8A)';
      el.style.backgroundImage='radial-gradient(40% 40% at '+a1+', '+c1+', transparent 70%),radial-gradient(45% 45% at '+a2+', '+c2+', transparent 70%),radial-gradient(35% 35% at '+a3+', '+c3+', transparent 70%)';
      el.style.filter='blur(60px) saturate(1.1)';
    }},
    constellation: { dur: 9999, apply: (el,p,c) => {
      if(el.tagName!=='CANVAS') return;
      if(!el.dataset.cInit){
        el.dataset.cInit='1'; el.width=el.offsetWidth||1920; el.height=el.offsetHeight||1080;
        const N=parseInt(el.dataset.count||'60',10), W=el.width, H=el.height;
        el._pts=Array.from({length:N},(_,i)=>{ const s1=(i*9301+49297)%233280/233280, s2=(i*4099+7919)%233280/233280; return {x:s1*W,y:s2*H,vx:(s1-0.5)*14,vy:(s2-0.5)*14}; });
        el._lastT=c.time||0;
      }
      el.style.opacity=Math.min(1,p*40);
      const g=el.getContext('2d'), W=el.width, H=el.height, t=c.time||0;
      let dt=t-(el._lastT||t); if(dt<0||dt>0.2) dt=0.016; el._lastT=t;
      const col=el.dataset.color||'124,92,255', pts=el._pts;
      g.clearRect(0,0,W,H);
      for(const pt of pts){ pt.x+=pt.vx*dt; pt.y+=pt.vy*dt; if(pt.x<0||pt.x>W)pt.vx*=-1; if(pt.y<0||pt.y>H)pt.vy*=-1; pt.x=Math.max(0,Math.min(W,pt.x)); pt.y=Math.max(0,Math.min(H,pt.y)); }
      g.strokeStyle='rgba('+col+',0.18)'; g.lineWidth=1.5;
      for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++){ const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y, d=Math.hypot(dx,dy); if(d<220){ g.globalAlpha=(1-d/220)*0.6; g.beginPath(); g.moveTo(pts[i].x,pts[i].y); g.lineTo(pts[j].x,pts[j].y); g.stroke(); } }
      g.globalAlpha=1; g.fillStyle='rgba('+col+',0.9)';
      for(const pt of pts){ g.beginPath(); g.arc(pt.x,pt.y,3,0,6.283); g.fill(); }
    }},
  });

  function _annDraw(el, kind){
    if(el.dataset.annInit) return; el.dataset.annInit='1';
    if(getComputedStyle(el).position==='static') el.style.position='relative';
    const w=el.offsetWidth||200, h=el.offsetHeight||60;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 '+w+' '+h);
    svg.style.cssText='position:absolute;left:-6%;top:-12%;width:112%;height:128%;overflow:visible;pointer-events:none;z-index:5';
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    const col=el.dataset.annColor||'var(--accent,#7C5CFF)';
    const sw=parseFloat(el.dataset.annWeight||((kind==='underline'||kind==='strike')?'5':'4'));
    let d;
    if(kind==='underline'){ const y=h*0.96; d='M '+(w*0.02)+' '+y+' C '+(w*0.3)+' '+(y+4)+', '+(w*0.6)+' '+(y-5)+', '+(w*0.98)+' '+(y-1); }
    else if(kind==='strike'){ const y=h*0.52; d='M '+(w*0.02)+' '+(y+2)+' C '+(w*0.35)+' '+(y-3)+', '+(w*0.65)+' '+(y+4)+', '+(w*0.98)+' '+(y-1); }
    else if(kind==='box'){ const r=10; d='M '+r+' 2 L '+(w-r)+' 4 Q '+w+' 2 '+w+' '+r+' L '+(w-2)+' '+(h-r)+' Q '+w+' '+h+' '+(w-r)+' '+(h-2)+' L '+r+' '+(h-3)+' Q 2 '+h+' 2 '+(h-r)+' L 4 '+r+' Q 2 2 '+r+' 2 Z'; }
    else { const cx=w/2, cy=h/2, rx=w*0.56, ry=h*0.62; d='M '+(cx-rx*0.3)+' '+(cy+ry)+' C '+(cx-rx)+' '+(cy+ry)+', '+(cx-rx)+' '+(cy-ry)+', '+cx+' '+(cy-ry*0.95)+' C '+(cx+rx)+' '+(cy-ry)+', '+(cx+rx)+' '+(cy+ry)+', '+(cx-rx*0.1)+' '+(cy+ry*0.96)+' C '+(cx-rx*0.8)+' '+(cy+ry*0.8)+', '+(cx-rx*0.85)+' '+(cy-ry*0.4)+', '+(cx-rx*0.2)+' '+(cy-ry*0.7); }
    path.setAttribute('d',d); path.setAttribute('fill','none'); path.setAttribute('stroke',col);
    path.setAttribute('stroke-width',sw); path.setAttribute('stroke-linecap','round'); path.setAttribute('stroke-linejoin','round');
    svg.appendChild(path); el.appendChild(svg); el._annPath=path;
    try{ el._annLen=path.getTotalLength(); }catch(e){ el._annLen=600; }
  }
  function _annStroke(el, e){ const path=el._annPath; if(!path) return; const len=el._annLen; path.style.strokeDasharray=len; path.style.strokeDashoffset=len*(1-e); }

  const EXITS = {
    fadeOut:      (el,e)=>{ el.style.opacity=1-e; },
    slideOutLeft: (el,e)=>{ el.style.opacity=1-e; el.style.transform='translateX('+(-e*140)+'px)'; },
    slideOutRight:(el,e)=>{ el.style.opacity=1-e; el.style.transform='translateX('+(e*140)+'px)'; },
    slideOutUp:   (el,e)=>{ el.style.opacity=1-e; el.style.transform='translateY('+(-e*140)+'px)'; },
    slideOutDown: (el,e)=>{ el.style.opacity=1-e; el.style.transform='translateY('+(e*140)+'px)'; },
    scaleOut:     (el,e)=>{ el.style.opacity=1-e; el.style.transform='scale('+(1-e*0.25)+')'; },
    blurOut:      (el,e)=>{ el.style.opacity=1-e; el.style.filter='blur('+(e*22)+'px)'; },
  };

  /* ========================================================================
     ADVANCED PACK (v0.6): charts, diagrams, UI demo, text/code FX
  ======================================================================== */
  function _sbStyle(id, css){ if(document.getElementById(id)) return; const st=document.createElement('style'); st.id=id; st.textContent=css; document.head.appendChild(st); }

  Object.assign(PRESETS, {
    /* ---- CHARTS ---- */
    chartArea: { dur: 1.6, apply: (el,p,c) => {       // reveal an area/line path L->R
      const e=(c.ease||E.outCubic)(p); el.style.opacity=1; el.style.clipPath=`inset(0 ${(1-e)*100}% 0 0)`;
    }},
    pieSlice: { dur: 1.4, apply: (el,p,c) => {         // SVG <circle> arc; data-pct, data-offset (0..100)
      if(!el.dataset.circ){ try{el.dataset.circ=el.getTotalLength();}catch(e){el.dataset.circ=2*Math.PI*(parseFloat(el.getAttribute('r'))||100);} }
      const circ=parseFloat(el.dataset.circ), pct=parseFloat(el.dataset.pct||'25')/100, off=parseFloat(el.dataset.offset||'0')/100, e=(c.ease||E.outCubic)(p);
      el.style.strokeDasharray=(pct*circ*e)+' '+circ; el.style.strokeDashoffset=(-off*circ); el.style.opacity=1;
    }},
    gauge: { dur: 1.4, apply: (el,p,c) => {            // rotate a needle from data-from to data-to (deg)
      const from=parseFloat(el.dataset.from||'-90'), to=parseFloat(el.dataset.to||'0'), e=(c.ease||E.outBack)(p);
      el.style.opacity=1; el.style.transform=`rotate(${from+(to-from)*e}deg)`;
    }},
    barTo: { dur: 1.2, apply: (el,p,c) => {            // morph a bar height between data-from% and data-to%
      const from=parseFloat(el.dataset.from||'0'), to=parseFloat(el.dataset.to||'100'), e=(c.ease||E.inOutCubic)(p);
      el.style.opacity=1; el.style.height=(from+(to-from)*e)+'%';
    }},

    /* ---- DIAGRAM ---- */
    connectorDraw: { dur: 1.0, apply: (el,p,c) => {    // draw an SVG path; data-arrow="end" pops an arrowhead
      if(!el.dataset.len){ try{el.dataset.len=el.getTotalLength();}catch(e){el.dataset.len=300;} }
      const len=parseFloat(el.dataset.len), e=(c.ease||E.inOutCubic)(p);
      el.style.strokeDasharray=len; el.style.strokeDashoffset=len*(1-e); el.style.opacity=1;
      if(el.dataset.arrow && p>0.82 && !el.dataset.arrowDone){
        el.dataset.arrowDone='1';
        try{
          const L=el.getTotalLength(), a=el.getPointAtLength(L), b=el.getPointAtLength(Math.max(0,L-12));
          const ang=Math.atan2(a.y-b.y,a.x-b.x), svg=el.ownerSVGElement||el.parentNode, NS='http://www.w3.org/2000/svg';
          const mk=(x2,y2)=>{ const ln=document.createElementNS(NS,'line'); ln.setAttribute('x1',a.x);ln.setAttribute('y1',a.y);ln.setAttribute('x2',x2);ln.setAttribute('y2',y2);
            ln.setAttribute('stroke',el.getAttribute('stroke')||'currentColor'); ln.setAttribute('stroke-width',el.getAttribute('stroke-width')||'3'); ln.setAttribute('stroke-linecap','round'); svg.appendChild(ln); };
          mk(a.x-14*Math.cos(ang-0.5), a.y-14*Math.sin(ang-0.5));
          mk(a.x-14*Math.cos(ang+0.5), a.y-14*Math.sin(ang+0.5));
        }catch(e){}
      }
    }},

    /* ---- UI DEMO SIMULATION ---- */
    cursorTour: { dur: 9999, apply: (el,p,c) => {
      // data-stops="#sel@2.0, #sel2@4.0:click, #field@6.0:type=Hello"
      _sbStyle('sb-cursor-css', '#sb-cursor{position:fixed;width:26px;height:26px;z-index:2147483646;pointer-events:none;left:0;top:0;margin:-2px 0 0 -2px;transition:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))}.sb-ripple{position:fixed;z-index:2147483645;border:3px solid var(--accent,#7C5CFF);border-radius:50%;pointer-events:none}');
      let cur=document.getElementById('sb-cursor');
      if(!cur){ cur=document.createElement('div'); cur.id='sb-cursor';
        cur.innerHTML='<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2 L4 20 L9 15 L13 22 L16 21 L12 14 L19 14 Z" fill="#fff" stroke="#111" stroke-width="1.3"/></svg>';
        document.body.appendChild(cur); }
      if(!el._stops){
        el._stops=(el.dataset.stops||'').split(',').map(seg=>{
          seg=seg.trim(); const at=seg.split('@'); const sel=at[0].trim(); const rest=(at[1]||'0');
          const m=rest.match(/^([\d.]+)(?::(click|type=.*))?$/); const t=m?parseFloat(m[1]):0; const act=m&&m[2]?m[2]:'';
          return {sel,t,act,done:false};
        }).filter(x=>x.sel);
      }
      const stops=el._stops; if(!stops.length) return;
      cur.style.opacity=(c.time>=stops[0].t-0.6)?1:0;
      function center(sel){ const tg=document.querySelector(sel); if(!tg) return null; const r=tg.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,tg}; }
      // find segment
      let i=0; while(i<stops.length-1 && c.time>=stops[i+1].t) i++;
      const a=center(stops[i].sel); if(!a){ return; }
      let pos=a;
      if(i<stops.length-1){
        const b=center(stops[i+1].sel);
        if(b){ const seg=Math.max(0.001,stops[i+1].t-stops[i].t); const f=Math.max(0,Math.min(1,(c.time-stops[i].t)/seg)); const e=E.inOutCubic(f);
          pos={x:a.x+(b.x-a.x)*e, y:a.y+(b.y-a.y)*e}; }
      }
      cur.style.left=pos.x+'px'; cur.style.top=pos.y+'px';
      // fire actions at stops
      stops.forEach(stp=>{
        if(!stp.done && c.time>=stp.t && c.time<stp.t+0.5){
          stp.done=true; const ct=center(stp.sel); if(!ct) return;
          if(stp.act==='click' || stp.act.startsWith('type')){
            const rip=document.createElement('div'); rip.className='sb-ripple';
            rip.style.left=ct.x+'px'; rip.style.top=ct.y+'px';
            document.body.appendChild(rip);
            rip.animate([{width:'0px',height:'0px',opacity:.8,transform:'translate(-50%,-50%)'},{width:'80px',height:'80px',opacity:0,transform:'translate(-50%,-50%)'}],{duration:600,easing:'ease-out',fill:'forwards'}).onfinish=()=>rip.remove();
            if(ct.tg){ ct.tg.animate([{transform:'scale(1)'},{transform:'scale(0.96)'},{transform:'scale(1)'}],{duration:240,easing:'ease-out'}); }
          }
          if(stp.act.startsWith('type=')){ const txt=stp.act.slice(5), tg=ct.tg;
            if(tg){ let n=0; const iv=setInterval(()=>{ n++; const v=txt.slice(0,n); if('value' in tg) tg.value=v; else tg.textContent=v; if(n>=txt.length) clearInterval(iv); }, 55); } }
        }
      });
    }},
    clickRipple: { dur: 0.6, apply: (el,p,c) => {
      _sbStyle('sb-cursor-css','');
      el.style.opacity=1; const e=E.outCubic(p);
      el.style.transform=`scale(${e*1.6})`; el.style.opacity=String(1-p);
      el.style.borderRadius='50%'; if(!el.style.border) el.style.border='3px solid var(--accent,#7C5CFF)';
    }},
    typeInto: { dur: 1.6, apply: (el,p,c) => {
      const txt=el.dataset.text!==undefined?el.dataset.text:(el.dataset.fullText||el.textContent);
      if(!el.dataset.fullText) el.dataset.fullText=txt;
      const n=Math.floor(el.dataset.fullText.length*(c.ease||E.linear)(p)); const v=el.dataset.fullText.slice(0,n);
      if('value' in el) el.value=v; else el.textContent=v; el.style.opacity=1;
    }},

    /* ---- TEXT / CODE FX ---- */
    assemble: { dur: 1.4, apply: (el,p,c) => {         // letters fly in from scatter to form the word
      if(!el.dataset.asmInit){ el.dataset.asmInit='1';
        const chars=[...el.textContent];
        el.innerHTML=chars.map((ch,i)=>{ if(ch===' ') return ' ';
          const s=(i*9301+49297)%233280/233280, s2=(i*4099+7919)%233280/233280;
          const dx=(s-0.5)*600, dy=(s2-0.5)*400, rot=(s-0.5)*120;
          return '<span class="asm-c" data-dx="'+dx.toFixed(0)+'" data-dy="'+dy.toFixed(0)+'" data-rot="'+rot.toFixed(0)+'" style="display:inline-block;opacity:0">'+ch+'</span>';
        }).join('');
        el.dataset.asmN=el.querySelectorAll('.asm-c').length;
      }
      el.style.opacity=1; const n=parseInt(el.dataset.asmN,10);
      el.querySelectorAll('.asm-c').forEach((sp,i)=>{
        const lp=Math.max(0,Math.min(1,(p*1.3 - (i/n)*0.3))); const e=E.outCubic(lp);
        sp.style.opacity=e; sp.style.transform='translate('+((1-e)*parseFloat(sp.dataset.dx))+'px,'+((1-e)*parseFloat(sp.dataset.dy))+'px) rotate('+((1-e)*parseFloat(sp.dataset.rot))+'deg)';
      });
    }},
    rgbGlitch: { dur: 1.0, apply: (el,p,c) => {        // RGB-split jitter settling to clean
      el.style.opacity=Math.min(1,p*2.5);
      const settle=Math.max(0,1-p), jit=Math.sin(p*60)*8*settle, dx=(6+jit)*settle;
      el.style.textShadow=dx.toFixed(1)+'px 0 rgba(255,0,80,.8), '+(-dx).toFixed(1)+'px 0 rgba(0,220,255,.8)';
      el.style.transform='translateX('+(jit*0.4).toFixed(1)+'px)';
      if(p>=1) el.style.textShadow='none';
    }},
    neonOn: { dur: 1.3, apply: (el,p,c) => {           // flicker on, then steady glow
      const col=el.dataset.neon||'var(--accent,#7C5CFF)';
      if(p<0.55){ const ph=(p*9)%1; el.style.opacity=(ph>0.2&&ph<0.5)?0.2:1; el.style.textShadow='none'; }
      else { el.style.opacity=1; const g=0.6+0.4*Math.sin(p*Math.PI*3);
        el.style.textShadow='0 0 6px '+col+', 0 0 18px '+col+', 0 0 '+(28*g).toFixed(0)+'px '+col; }
    }},
    textMask: { dur: 1.8, apply: (el,p,c) => {         // gradient/image shows through text + sheen sweep
      if(!el.dataset.tmInit){ el.dataset.tmInit='1';
        const img=el.dataset.img;
        el.style.backgroundImage = img ? ('url('+img+')') : 'linear-gradient(110deg,var(--accent,#7C5CFF),var(--accent2,#19E3B1),var(--accent3,#FF5C8A))';
        el.style.backgroundSize='cover'; el.style.webkitBackgroundClip='text'; el.style.backgroundClip='text'; el.style.webkitTextFillColor='transparent'; el.style.color='transparent';
        el.style.backgroundPosition='center';
      }
      el.style.opacity=Math.min(1,p*3);
      // sheen: a bright band sweeps across via an extra layered gradient
      const x=(p*140-20);
      const base = el.dataset.img ? 'url('+el.dataset.img+')' : 'linear-gradient(110deg,var(--accent,#7C5CFF),var(--accent2,#19E3B1),var(--accent3,#FF5C8A))';
      el.style.backgroundImage='linear-gradient(100deg, transparent '+(x-12)+'%, rgba(255,255,255,.85) '+x+'%, transparent '+(x+12)+'%), '+base;
    }},
    codeType: { dur: 3.0, apply: (el,p,c) => {         // syntax-highlighted code typing
      if(!el.dataset.ctInit){ el.dataset.ctInit='1';
        _sbStyle('sb-code-css','.tok-kw{color:#C792EA}.tok-str{color:#C3E88D}.tok-num{color:#F78C6C}.tok-com{color:#637777;font-style:italic}.tok-fn{color:#82AAFF}.tok-pun{color:#89DDFF}');
        const code=el.textContent;
        const kw=/\b(function|const|let|var|return|if|else|for|while|import|from|export|class|new|await|async|def|print|in|of|true|false|null|None|True|False)\b/;
        // tokenize line by line preserving newlines
        const out=[];
        const re=/(\/\/[^\n]*|#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+\.?\d*\b)|([A-Za-z_$][\w$]*)(\s*\()|([A-Za-z_$][\w$]*)|([{}()\[\];:,.=<>+\-*/!&|?]+)|(\s+)/g;
        let m;
        while((m=re.exec(code))){
          if(m[1]) out.push(['tok-com', m[0]]);
          else if(m[2]) out.push(['tok-str', m[0]]);
          else if(m[3]) out.push(['tok-num', m[0]]);
          else if(m[4]!==undefined){ out.push([kw.test(m[4])?'tok-kw':'tok-fn', m[4]]); out.push(['tok-pun', m[5]]); }
          else if(m[6]) out.push([kw.test(m[6])?'tok-kw':'', m[6]]);
          else if(m[7]) out.push(['tok-pun', m[0]]);
          else out.push(['', m[0]]);
        }
        // build char spans with classes
        let html=''; let idx=0; const charcls=[];
        out.forEach(([cls,txt])=>{ for(const ch of txt){ charcls.push(cls); } });
        const allchars=[...code];
        el.innerHTML=allchars.map((ch,i)=>{ const cl=charcls[i]||''; const safe=ch==='\n'?'\n':ch.replace(/</g,'&lt;').replace(/>/g,'&gt;');
          return '<span class="ct-c '+cl+'" style="opacity:0">'+safe+'</span>'; }).join('');
        el.dataset.ctN=allchars.length; el.style.whiteSpace='pre-wrap';
      }
      el.style.opacity=1; const n=parseInt(el.dataset.ctN,10), shown=Math.floor(n*(c.ease||E.linear)(p));
      const sp=el.querySelectorAll('.ct-c'); for(let i=0;i<sp.length;i++) sp[i].style.opacity = i<shown?1:0;
    }},
  });

  /* ===== SENIOR COMPOSITION PACK (v0.7) ===== */
  Object.assign(PRESETS, {
    rackFocus: { dur: 1.2, apply: (el,p,c) => {   // focus pull: snaps into sharp + brightens
      const e=(c.ease||E.outCubic)(p);
      el.style.opacity=Math.min(1,p*3);
      el.style.filter='blur('+((1-e)*18)+'px) brightness('+(0.55+0.45*e)+')';
      el.style.transform='scale('+(0.985+0.015*e)+')';
    }},
    defocus: { dur: 1.2, apply: (el,p,c) => {      // push OUT of focus (recede a layer)
      const e=(c.ease||E.outCubic)(p);
      el.style.opacity=1; el.style.filter='blur('+(e*16)+'px) brightness('+(1-0.35*e)+')';
    }},
    vignette: { dur: 1.6, apply: (el,p,c) => {     // edges darken in
      const e=(c.ease||E.outCubic)(p);
      el.style.opacity=1; el.style.position='absolute'; el.style.inset='0'; el.style.pointerEvents='none'; el.style.zIndex='38';
      el.style.boxShadow='inset 0 0 '+(120+e*140)+'px '+(30+e*70)+'px rgba(0,0,0,'+(0.28+e*0.34)+')';
    }},
    cinematicGrade: { dur: 9999, apply: (el,p,c) => {  // full-frame film grade (vignette + corner falloff + tint)
      el.style.opacity=1;
      if(el.dataset.cgInit) return; el.dataset.cgInit='1';
      el.style.position='absolute'; el.style.inset='0'; el.style.pointerEvents='none'; el.style.zIndex='39';
      el.style.boxShadow='inset 0 0 220px 70px rgba(0,0,0,0.5)';
      el.style.background='radial-gradient(125% 125% at 50% 32%, transparent 52%, rgba(0,0,0,0.42) 100%)';
      el.style.mixBlendMode='multiply';
    }},
    filmGrain: { dur: 9999, apply: (el,p,c) => {   // animated grain via fractal-noise SVG data-uri
      el.style.opacity = (el.dataset.grainOpacity||'0.06');
      if(el.dataset.fgInit) return; el.dataset.fgInit='1';
      el.style.position='absolute'; el.style.inset='0'; el.style.pointerEvents='none'; el.style.zIndex='41'; el.style.mixBlendMode='overlay';
      const svg="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";
      el.style.backgroundImage="url(\""+svg+"\")"; el.style.backgroundSize='320px 320px';
      let f=0; el._grain=setInterval(()=>{ f=(f+1)%6; el.style.backgroundPosition=(f*53%320)+'px '+(f*97%320)+'px'; }, 90);
    }},
  });

  /* ========================================================================
     FUN PACK (v0.7): owned, brand-colored, render-safe dazzle effects.
     Most are self-contained — drop <div class="anim" data-anim="confettiBurst">.
     Colors pull from --accent / --accent2 / --accent3 / --gold.
  ======================================================================== */
  const FUN = ['var(--accent,#7C5CFF)','var(--accent2,#19E3B1)','var(--accent3,#FF5C8A)','var(--gold,#FFD166)'];
  function _seed(i){ return ((i*9301+49297)%233280)/233280; }

  Object.assign(PRESETS, {
    confettiBurst: { dur: 1.8, apply: (el,p,c) => {
      if(!el.dataset.fb){ el.dataset.fb='1'; if(getComputedStyle(el).position==='static') el.style.position='relative';
        let h=''; for(let i=0;i<54;i++){ const col=FUN[i%4], rad=(i%3)?'2px':'50%';
          h+='<span class="fb-p" style="position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px;background:'+col+';border-radius:'+rad+'"></span>'; }
        el.innerHTML=h; }
      el.style.opacity=1; const e=E.outCubic(p), ps=el.querySelectorAll('.fb-p');
      ps.forEach((sp,i)=>{ const a=(i/ps.length)*Math.PI*2+_seed(i)*6, d=e*(260+(_seed(i)*180)), x=Math.cos(a)*d, y=Math.sin(a)*d - e*70 + e*e*200, r=e*720*((i%2)?1:-1);
        sp.style.transform='translate('+x+'px,'+y+'px) rotate('+r+'deg)'; sp.style.opacity=String(1-Math.max(0,(p-0.55)/0.45)); });
    }},
    fireworks: { dur: 2.6, apply: (el,p,c) => {
      if(!el.dataset.fw){ el.dataset.fw='1'; if(getComputedStyle(el).position==='static') el.style.position='relative';
        let h=''; for(let b=0;b<4;b++){ const cx=15+_seed(b)*70, cy=20+_seed(b+9)*40, col=FUN[b%4];
          for(let i=0;i<20;i++) h+='<span class="fw-p" data-b="'+b+'" style="position:absolute;left:'+cx+'%;top:'+cy+'%;width:8px;height:8px;margin:-4px;border-radius:50%;background:'+col+'"></span>'; }
        el.innerHTML=h; }
      el.style.opacity=1; const ps=el.querySelectorAll('.fw-p');
      ps.forEach((sp,i)=>{ const b=parseInt(sp.dataset.b,10), bs=b*0.18, lp=Math.max(0,Math.min(1,(p-bs)/0.5)), e=E.outCubic(lp);
        const a=(i%20)/20*Math.PI*2, d=e*120; sp.style.transform='translate('+Math.cos(a)*d+'px,'+(Math.sin(a)*d+e*e*60)+'px)'; sp.style.opacity=String((lp>0?1:0)*(1-lp)); });
    }},
    sparkle: { dur: 9999, apply: (el,p,c) => {
      if(!el.dataset.sk){ el.dataset.sk='1'; if(getComputedStyle(el).position==='static') el.style.position='relative';
        let h=''; for(let i=0;i<14;i++){ const x=_seed(i)*100, y=_seed(i+5)*100, sz=8+_seed(i+2)*16;
          h+='<svg class="sk-s" data-i="'+i+'" style="position:absolute;left:'+x+'%;top:'+y+'%;width:'+sz+'px;height:'+sz+'px;overflow:visible" viewBox="0 0 10 10"><path d="M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z" fill="'+FUN[i%4]+'"/></svg>'; }
        el.innerHTML=h; }
      el.style.opacity=1; const t=c.time||0;
      el.querySelectorAll('.sk-s').forEach((sv,i)=>{ const ph=t*2+_seed(i)*6.28, o=0.2+0.8*Math.max(0,Math.sin(ph)); sv.style.opacity=String(o); sv.style.transform='scale('+(0.4+o*0.8)+') rotate('+(t*40+i*30)+'deg)'; });
    }},
    checkDraw: { dur: 0.9, apply: (el,p,c) => {
      if(!el.dataset.ck){ el.dataset.ck='1';
        el.innerHTML='<svg viewBox="0 0 100 100" style="width:100%;height:100%;overflow:visible"><circle cx="50" cy="50" r="44" fill="none" stroke="var(--accent2,#19E3B1)" stroke-width="7" class="ck-c"/><path d="M28 52 L44 68 L74 34" fill="none" stroke="var(--accent2,#19E3B1)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" class="ck-p"/></svg>';
        const cc=el.querySelector('.ck-c'), cp=el.querySelector('.ck-p'); try{el.dataset.ccl=cc.getTotalLength(); el.dataset.cpl=cp.getTotalLength();}catch(e){el.dataset.ccl=276;el.dataset.cpl=90;} }
      el.style.opacity=1; const cc=el.querySelector('.ck-c'), cp=el.querySelector('.ck-p');
      const ccl=parseFloat(el.dataset.ccl), cpl=parseFloat(el.dataset.cpl);
      const e1=E.outCubic(Math.min(1,p/0.6)), e2=E.outBack(Math.max(0,(p-0.5)/0.5));
      cc.style.strokeDasharray=ccl; cc.style.strokeDashoffset=ccl*(1-e1);
      cp.style.strokeDasharray=cpl; cp.style.strokeDashoffset=cpl*(1-e2);
    }},
    crossDraw: { dur: 0.7, apply: (el,p,c) => {
      if(!el.dataset.cx){ el.dataset.cx='1';
        el.innerHTML='<svg viewBox="0 0 100 100" style="width:100%;height:100%;overflow:visible"><circle cx="50" cy="50" r="44" fill="none" stroke="var(--accent3,#FF5C8A)" stroke-width="7"/><path d="M34 34 L66 66 M66 34 L34 66" fill="none" stroke="var(--accent3,#FF5C8A)" stroke-width="9" stroke-linecap="round" class="cx-p"/></svg>'; }
      el.style.opacity=1; const cp=el.querySelector('.cx-p'); if(!el.dataset.cxl){try{el.dataset.cxl=cp.getTotalLength();}catch(e){el.dataset.cxl=180;}}
      const l=parseFloat(el.dataset.cxl); cp.style.strokeDasharray=l; cp.style.strokeDashoffset=l*(1-E.outCubic(p));
    }},
    spinner: { dur: 9999, apply: (el,p,c) => {
      if(!el.dataset.sp){ el.dataset.sp='1';
        el.innerHTML='<svg viewBox="0 0 50 50" style="width:100%;height:100%"><circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="5"/><circle cx="25" cy="25" r="20" fill="none" stroke="var(--accent,#7C5CFF)" stroke-width="5" stroke-linecap="round" stroke-dasharray="90 36" class="sp-a"/></svg>'; }
      el.style.opacity=1; el.querySelector('.sp-a').style.transform='rotate('+((c.time||0)*320)+'deg)'; el.querySelector('.sp-a').style.transformOrigin='center';
    }},
    dotsLoader: { dur: 9999, apply: (el,p,c) => {
      if(!el.dataset.dl){ el.dataset.dl='1'; el.style.display='inline-flex'; el.style.gap='14px';
        el.innerHTML='<span class="dl-d"></span><span class="dl-d"></span><span class="dl-d"></span>';
        el.querySelectorAll('.dl-d').forEach((d,i)=>{ d.style.cssText='width:22px;height:22px;border-radius:50%;background:'+FUN[i%3]+';display:inline-block'; }); }
      el.style.opacity=1; const t=c.time||0;
      el.querySelectorAll('.dl-d').forEach((d,i)=>{ d.style.transform='translateY('+(Math.sin(t*5-i*0.6)*-16)+'px)'; });
    }},
    heartBeat: { dur: 1.2, apply: (el,p,c) => {
      if(!el.dataset.hb){ el.dataset.hb='1'; el.style.display='inline-block';
        if(el.dataset.emoji) el.textContent=el.dataset.emoji;
        else el.innerHTML='<svg viewBox="0 0 24 24" style="width:100%;height:100%;overflow:visible"><path d="M12 20.3C5 15.5 2.5 11.8 2.5 8.4 2.5 5.7 4.6 3.7 7.2 3.7 9 3.7 10.7 4.8 12 6.6 13.3 4.8 15 3.7 16.8 3.7 19.4 3.7 21.5 5.7 21.5 8.4 21.5 11.8 19 15.5 12 20.3Z" fill="var(--accent3,#FF5C8A)"/></svg>'; }
      el.style.opacity=Math.min(1,p*3);
      const t=p*2*Math.PI*1.5, thump=1+0.18*Math.abs(Math.sin(t))*Math.max(0,1-p*0.5);
      el.style.transform='scale('+(p<0.3?E.outBack(p/0.3):thump)+')';
    }},
    starPop: { dur: 0.9, apply: (el,p,c) => {
      if(!el.dataset.stp){ el.dataset.stp='1'; el.innerHTML='<svg viewBox="0 0 24 24" style="width:100%;height:100%"><path d="M12 1 L15 9 L23 9 L17 14 L19 22 L12 17 L5 22 L7 14 L1 9 L9 9 Z" fill="var(--gold,#FFD166)"/></svg>'; }
      el.style.opacity=Math.min(1,p*3); const e=E.outElastic(p); el.style.transform='scale('+(0.2+0.8*e)+') rotate('+((1-e)*180)+'deg)';
    }},
    rocketLaunch: { dur: 1.6, apply: (el,p,c) => {
      if(!el.dataset.rl){ el.dataset.rl='1'; el.style.display='inline-block';
        if(el.dataset.emoji) el.textContent=el.dataset.emoji;
        else el.innerHTML='<svg viewBox="0 0 24 24" style="width:100%;height:100%;overflow:visible"><path d="M12 1.5C15.8 4.6 17 9.4 16 14.5H8C7 9.4 8.2 4.6 12 1.5Z" fill="#EAF0FF"/><circle cx="12" cy="8.5" r="2.1" fill="var(--accent,#7C5CFF)"/><path d="M8 13L4.8 18 8 16.7ZM16 13L19.2 18 16 16.7Z" fill="var(--accent3,#FF5C8A)"/><path d="M9.6 15.5C10.4 20 12 22 12 22 12 22 13.6 20 14.4 15.5 13.2 16.4 10.8 16.4 9.6 15.5Z" fill="var(--gold,#FFD166)"/></svg>'; }
      el.style.opacity=1; const e=p*p;
      el.style.transform='translateY('+(-e*680)+'px) translateX('+(Math.sin(p*14)*5)+'px) scale('+(1-p*0.25)+')';
    }},
    coinFlip: { dur: 1.2, apply: (el,p,c) => {
      if(!el.dataset.cf){ el.dataset.cf='1'; el.style.display='inline-flex'; el.style.alignItems='center'; el.style.justifyContent='center';
        el.style.width=el.style.width||'120px'; el.style.height=el.style.height||'120px'; el.style.borderRadius='50%';
        el.style.background='radial-gradient(circle at 38% 30%, #FFE39A, var(--gold,#FFD166) 60%, #C9962B)'; el.style.color='#7a5a10'; el.style.fontWeight='800'; el.style.fontSize='52px';
        if(!el.textContent.trim()) el.textContent=el.dataset.face||'$'; }
      el.style.opacity=Math.min(1,p*3); el.style.transform='perspective(600px) rotateY('+((1-E.outCubic(p))*1080)+'deg)';
    }},
    trophyShine: { dur: 1.4, apply: (el,p,c) => {
      if(!el.dataset.tr){ el.dataset.tr='1'; el.style.display='inline-block';
        if(el.dataset.emoji) el.textContent=el.dataset.emoji;
        else el.innerHTML='<svg viewBox="0 0 24 24" style="width:100%;height:100%"><path d="M6 3H18V8A6 6 0 0 1 6 8Z" fill="var(--gold,#FFD166)"/><path d="M6 4.5H3.5V6A3 3 0 0 0 6.4 9M18 4.5H20.5V6A3 3 0 0 1 17.6 9" fill="none" stroke="var(--gold,#FFD166)" stroke-width="1.4"/><path d="M10.5 13H13.5V16H16V19H8V16H10.5Z" fill="var(--gold,#FFD166)"/></svg>'; }
      el.style.opacity=Math.min(1,p*3); el.style.transform='scale('+(0.6+0.4*E.outBack(Math.min(1,p*1.5)))+')';
    }},
    badgeUnlock: { dur: 1.5, apply: (el,p,c) => {
      if(!el.dataset.bu){ el.dataset.bu='1'; if(getComputedStyle(el).position==='static') el.style.position='relative';
        const ring=document.createElement('span'); ring.className='bu-ring'; ring.style.cssText='position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px;border-radius:50%;border:4px solid var(--accent,#7C5CFF);pointer-events:none'; el.appendChild(ring); }
      el.style.opacity=Math.min(1,p*3); el.style.transform='scale('+(0.3+0.7*E.outElastic(Math.min(1,p*1.3)))+')';
      const ring=el.querySelector('.bu-ring'), e=E.outCubic(p); if(ring){ ring.style.transform='scale('+(1+e*14)+')'; ring.style.opacity=String(1-e); }
    }},
    pulseRings: { dur: 9999, apply: (el,p,c) => {
      if(!el.dataset.pr){ el.dataset.pr='1'; if(getComputedStyle(el).position==='static') el.style.position='relative';
        el.innerHTML='<span class="pr-r"></span><span class="pr-r"></span><span class="pr-r"></span>';
        el.querySelectorAll('.pr-r').forEach(r=>r.style.cssText='position:absolute;left:50%;top:50%;width:60px;height:60px;margin:-30px;border-radius:50%;border:3px solid var(--accent,#7C5CFF)'); }
      el.style.opacity=1; const t=c.time||0;
      el.querySelectorAll('.pr-r').forEach((r,i)=>{ const ph=((t*0.6+i/3)%1); r.style.transform='scale('+(0.4+ph*3)+')'; r.style.opacity=String((1-ph)*0.7); });
    }},
    waveform: { dur: 9999, apply: (el,p,c) => {
      if(!el.dataset.wf){ el.dataset.wf='1'; el.style.display='inline-flex'; el.style.alignItems='center'; el.style.gap='8px'; el.style.height=el.style.height||'120px';
        const N=parseInt(el.dataset.bars||'18',10); let h=''; for(let i=0;i<N;i++) h+='<span class="wf-b" style="width:12px;border-radius:6px;background:'+FUN[i%4]+';height:20%"></span>'; el.innerHTML=h; el.dataset.wfN=N; }
      el.style.opacity=1; const t=c.time||0, bars=el.querySelectorAll('.wf-b'); let amp=0;
      if(typeof analyser!=='undefined' && analyser && freqData){ analyser.getByteFrequencyData(freqData); }
      bars.forEach((b,i)=>{ let v;
        if(typeof freqData!=='undefined' && freqData && analyser){ v=(freqData[Math.min(freqData.length-1,i*2)]||0)/255; }
        else { v=0.5+0.5*Math.sin(t*6 + i*0.5); }
        b.style.height=(15+v*85)+'%'; });
    }},
    partyPopper: { dur: 1.6, apply: (el,p,c) => {
      if(!el.dataset.pp){ el.dataset.pp='1'; if(getComputedStyle(el).position==='static') el.style.position='relative';
        const em=document.createElement('span'); em.style.cssText='display:inline-block;width:64px;height:64px';
        if(el.dataset.emoji) em.textContent=el.dataset.emoji;
        else em.innerHTML='<svg viewBox="0 0 24 24" style="width:100%;height:100%;overflow:visible"><path d="M3 21L9 8 16 15Z" fill="var(--accent,#7C5CFF)"/><path d="M3 21L9 8 11.5 10.5Z" fill="var(--accent2,#19E3B1)"/></svg>';
        el.appendChild(em);
        let h=''; for(let i=0;i<30;i++) h+='<span class="pp-s" style="position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;border-radius:'+((i%2)?'50%':'2px')+';background:'+FUN[i%4]+'"></span>';
        const wrap=document.createElement('span'); wrap.innerHTML=h; el.appendChild(wrap); el._ppEm=em; }
      el.style.opacity=1; if(el._ppEm) el._ppEm.style.transform='scale('+(0.5+0.5*E.outBack(Math.min(1,p*2)))+') rotate('+(-20+p*10)+'deg)';
      const e=E.outCubic(p); el.querySelectorAll('.pp-s').forEach((sp,i)=>{ const a=(-Math.PI*0.75)+(i/30)*(Math.PI*0.9), d=e*(300+_seed(i)*160), x=Math.cos(a)*d, y=Math.sin(a)*d+e*e*180; sp.style.transform='translate('+x+'px,'+y+'px) rotate('+(e*540)+'deg)'; sp.style.opacity=String(1-Math.max(0,(p-0.6)/0.4)); });
    }},
    ratingStars: { dur: 1.3, apply: (el,p,c) => {
      if(!el.dataset.rs){ el.dataset.rs='1'; el.style.display='inline-flex'; el.style.gap='10px';
        const n=parseInt(el.dataset.count||'5',10); let h=''; for(let i=0;i<n;i++) h+='<svg class="rs-s" viewBox="0 0 24 24" style="width:60px;height:60px"><path d="M12 1 L15 9 L23 9 L17 14 L19 22 L12 17 L5 22 L7 14 L1 9 L9 9 Z" fill="var(--gold,#FFD166)"/></svg>'; el.innerHTML=h; el.dataset.rsN=n; }
      el.style.opacity=1; const n=parseInt(el.dataset.rsN,10); el.querySelectorAll('.rs-s').forEach((sv,i)=>{ const lp=Math.max(0,Math.min(1,(p*1.2 - i/n))); const e=E.outBack(lp); sv.style.transform='scale('+e+') rotate('+((1-e)*90)+'deg)'; sv.style.opacity=String(lp>0?1:0); });
    }},
    emojiPop: { dur: 0.9, apply: (el,p,c) => {
      if(!el.dataset.ep){ el.dataset.ep='1'; if(!el.textContent.trim()) el.textContent=el.dataset.emoji||'✨'; el.style.display='inline-block'; }
      el.style.opacity=Math.min(1,p*4); const e=E.outElastic(p); el.style.transform='scale('+(0.2+0.8*e)+') translateY('+((1-E.outCubic(p))*30)+'px)';
    }},
    thumbsUp: { dur: 0.9, apply: (el,p,c) => {
      if(!el.dataset.tu){ el.dataset.tu='1'; el.style.display='inline-block';
        if(el.dataset.emoji) el.textContent=el.dataset.emoji;
        else el.innerHTML='<svg viewBox="0 0 24 24" style="width:100%;height:100%"><path d="M3 10H6.5V21H4A1 1 0 0 1 3 20Z" fill="var(--accent,#7C5CFF)"/><path d="M7 9.5L11.5 2.4C12.7 2.4 13.6 3.5 13.3 4.7L12.4 9H18.6C19.9 9 20.9 10.2 20.6 11.5L19.2 18.6C19 19.6 18.1 20.3 17.1 20.3H7Z" fill="var(--accent2,#19E3B1)"/></svg>'; }
      el.style.opacity=Math.min(1,p*4); const e=E.outBack(Math.min(1,p*1.4)); const wob=Math.sin(p*Math.PI*4)*(1-p)*12;
      el.style.transform='scale('+e+') rotate('+wob+'deg)';
    }},
    lightbulb: { dur: 1.2, apply: (el,p,c) => {
      if(!el.dataset.lb){ el.dataset.lb='1'; el.style.display='inline-block';
        if(el.dataset.emoji) el.textContent=el.dataset.emoji;
        else el.innerHTML='<svg viewBox="0 0 24 24" style="width:100%;height:100%;overflow:visible"><path d="M9 18.5H15V20A1.5 1.5 0 0 1 13.5 21.5H10.5A1.5 1.5 0 0 1 9 20Z" fill="#9aa3c0"/><path d="M12 2.5A7 7 0 0 1 16.5 14.8C15.6 15.7 15.2 16.6 15.1 17.5H8.9C8.8 16.6 8.4 15.7 7.5 14.8A7 7 0 0 1 12 2.5Z" fill="var(--gold,#FFD166)"/></svg>'; }
      if(p<0.5){ const ph=(p*10)%1; el.style.opacity=(ph>0.3&&ph<0.6)?0.25:1; el.style.filter='none'; }
      else { el.style.opacity=1; const g=0.5+0.5*Math.sin(p*Math.PI*4); el.style.filter='drop-shadow(0 0 '+(10+g*26)+'px var(--gold,#FFD166))'; }
      el.style.transform='scale('+(0.7+0.3*E.outBack(Math.min(1,p*2)))+')';
    }},
    confettiRain: { dur: 9999, apply: (el,p,c) => {
      if(!el.dataset.cr){ el.dataset.cr='1'; el.style.position='absolute'; el.style.inset='0'; el.style.overflow='hidden'; el.style.pointerEvents='none';
        let h=''; for(let i=0;i<60;i++){ const x=_seed(i)*100, sz=8+_seed(i+3)*8; h+='<span class="cr-p" data-i="'+i+'" style="position:absolute;left:'+x+'%;top:-5%;width:'+sz+'px;height:'+(sz*1.4)+'px;background:'+FUN[i%4]+';border-radius:2px"></span>'; } el.innerHTML=h; }
      el.style.opacity=1; const t=c.time||0;
      el.querySelectorAll('.cr-p').forEach((sp,i)=>{ const sp1=0.3+_seed(i)*0.5, y=((t*sp1+_seed(i))%1.15)*110, sway=Math.sin(t*2+i)*20; sp.style.transform='translate('+sway+'px,'+y+'vh) rotate('+(t*180+i*40)+'deg)'; });
    }},
    shimmerSweep: { dur: 1.4, apply: (el,p,c) => {
      if(getComputedStyle(el).position==='static') el.style.position='relative'; el.style.overflow='hidden'; el.style.opacity=1;
      let sh=el.querySelector('.ss-band'); if(!sh){ sh=document.createElement('span'); sh.className='ss-band'; sh.style.cssText='position:absolute;top:0;bottom:0;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);pointer-events:none'; el.appendChild(sh); }
      sh.style.left=(-40+p*180)+'%';
    }},
    burstLines: { dur: 0.7, apply: (el,p,c) => {
      if(!el.dataset.bl){ el.dataset.bl='1'; if(getComputedStyle(el).position==='static') el.style.position='relative';
        let h='<svg viewBox="0 0 200 200" style="position:absolute;left:50%;top:50%;width:300px;height:300px;margin:-150px;overflow:visible">'; for(let i=0;i<12;i++){ const a=i/12*Math.PI*2; h+='<line class="bl-l" x1="'+(100+Math.cos(a)*30)+'" y1="'+(100+Math.sin(a)*30)+'" x2="'+(100+Math.cos(a)*90)+'" y2="'+(100+Math.sin(a)*90)+'" stroke="'+FUN[i%4]+'" stroke-width="6" stroke-linecap="round"/>'; } h+='</svg>'; el.innerHTML=h; }
      el.style.opacity=1; const e=E.outCubic(p); el.querySelectorAll('.bl-l').forEach(l=>{ l.style.transformOrigin='100px 100px'; l.style.transform='scale('+(0.3+e*1.1)+')'; l.style.opacity=String(1-p); });
    }},
    floatEmojis: { dur: 9999, apply: (el,p,c) => {
      if(!el.dataset.fe){ el.dataset.fe='1'; el.style.position='absolute'; el.style.inset='0'; el.style.overflow='hidden'; el.style.pointerEvents='none';
        const set=(el.dataset.emojis||'❤️,👍,🎉,⭐,🔥').split(','); let h='';
        for(let i=0;i<18;i++){ const x=_seed(i)*100, em=set[i%set.length], sz=30+_seed(i+2)*40; h+='<span class="fe-e" data-i="'+i+'" style="position:absolute;left:'+x+'%;bottom:-10%;font-size:'+sz+'px">'+em+'</span>'; } el.innerHTML=h; }
      el.style.opacity=1; const t=c.time||0;
      el.querySelectorAll('.fe-e').forEach((sp,i)=>{ const sp1=0.25+_seed(i)*0.4, y=((t*sp1+_seed(i))%1.2)*120, sway=Math.sin(t*1.5+i)*30; sp.style.transform='translate('+sway+'px,-'+y+'vh)'; sp.style.opacity=String(Math.max(0,1-((t*sp1+_seed(i))%1.2))); });
    }},
  });




  /* ===== LOTTIE (real) + vector float ===== */
  Object.assign(PRESETS, {
    // Play a Lottie via lottie-web, clock-synced. Source: data-src="x.json"
    // (served/HTTP decks) OR data-key="confetti" (inline window.SB_LOTTIE map,
    // works on file:// too). Scrubs by progress by default; data-lottie-loop="1"
    // free-runs from the clock. Needs lottie_svg.min.js loaded on the page.
    lottie: { dur: 3.0, apply: (el,p,c) => {
      if(!el._ltTried){
        if(typeof window==='undefined' || !window.lottie){
          if(!window._sbLottieWarned){ window._sbLottieWarned=1; console.warn('[storyboard] lottie-web not loaded yet (include lottie_svg.min.js)'); }
          return; // retry next tick once the lib is present
        }
        el._ltTried=true;
        const key=el.dataset.key, src=el.dataset.src||el.dataset.lottie;
        const opts={ container: el, renderer:'svg', loop:false, autoplay:false, rendererSettings:{preserveAspectRatio:'xMidYMid meet'} };
        if(key && window.SB_LOTTIE && window.SB_LOTTIE[key]) opts.animationData=window.SB_LOTTIE[key];
        else if(src) opts.path=src;
        else { console.warn('[storyboard] lottie: needs data-key or data-src'); return; }
        try{
          el._lt=window.lottie.loadAnimation(opts);
          el._lt.addEventListener('DOMLoaded', ()=>{ el._ltReady=true; el._ltFrames=el._lt.getDuration(true)||60; el._ltFps=el._lt.frameRate||30; });
        }catch(e){ console.warn('[storyboard] lottie load failed', e); }
      }
      el.style.opacity=1;
      if(el._ltReady && el._lt){
        const frames=el._ltFrames||60;
        if(el.dataset.lottieLoop==='1'){ el._lt.goToAndStop((((c.time||0)*(el._ltFps||30))%frames), true); }
        else { const e=(c.ease||E.linear)(p); el._lt.goToAndStop(Math.min(frames-1, e*(frames-1)), true); }
      }
    }},
    // Owned vector confetti/hearts/stars drifting up (no OS emoji). data-shapes="heart,star,confetti,dot"
    floatShapes: { dur: 9999, apply: (el,p,c) => {
      if(!el.dataset.fs){ el.dataset.fs='1'; el.style.position='absolute'; el.style.inset='0'; el.style.overflow='hidden'; el.style.pointerEvents='none';
        const kinds=(el.dataset.shapes||'heart,star,confetti,dot').split(',');
        const mk=(k,col)=>{
          if(k==='heart') return '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 20.3C5 15.5 2.5 11.8 2.5 8.4 2.5 5.7 4.6 3.7 7.2 3.7 9 3.7 10.7 4.8 12 6.6 13.3 4.8 15 3.7 16.8 3.7 19.4 3.7 21.5 5.7 21.5 8.4 21.5 11.8 19 15.5 12 20.3Z" fill="'+col+'"/></svg>';
          if(k==='star') return '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 1L15 9 23 9 17 14 19 22 12 17 5 22 7 14 1 9 9 9Z" fill="'+col+'"/></svg>';
          if(k==='confetti') return '<div style="width:100%;height:62%;background:'+col+';border-radius:2px"></div>';
          return '<div style="width:70%;height:70%;border-radius:50%;background:'+col+';margin:15%"></div>';
        };
        let h=''; for(let i=0;i<18;i++){ const x=_seed(i)*100, sz=20+_seed(i+2)*34, col=FUN[i%4], k=kinds[i%kinds.length];
          h+='<span class="fs-e" style="position:absolute;left:'+x+'%;bottom:-12%;width:'+sz+'px;height:'+sz+'px">'+mk(k,col)+'</span>'; }
        el.innerHTML=h; }
      el.style.opacity=1; const t=c.time||0;
      el.querySelectorAll('.fs-e').forEach((sp,i)=>{ const sp1=0.25+_seed(i)*0.4, prog=((t*sp1+_seed(i))%1.25), y=prog*125, sway=Math.sin(t*1.5+i)*30;
        sp.style.transform='translate('+sway+'px,-'+y+'vh) rotate('+(t*50+i*40)+'deg)'; sp.style.opacity=String(Math.max(0,1-prog)); });
    }},
  });

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
  let EXIT_SCHED=[];
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
    // Exit animation (data-exit + data-exit-at | data-exit-t). Independent of loop.
    if(el.dataset.exit && EXITS[el.dataset.exit]){ let xt; if(el.dataset.exitT!==undefined) xt=parseFloat(el.dataset.exitT); else if(el.dataset.exitAt!==undefined) xt=cueTime+parseFloat(el.dataset.exitAt); else xt=t+dur+2; EXIT_SCHED.push({el,t:xt,dur:el.dataset.exitDur!==undefined?parseFloat(el.dataset.exitDur):0.7,fx:EXITS[el.dataset.exit],ease:resolveEase(el)}); }
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
    for(const x of EXIT_SCHED){ if(time<x.t) continue; const e=(x.ease||EASE.outCubic)(Math.max(0,Math.min(1,(time-x.t)/x.dur))); x.fx(x.el,e); }
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
      C.cam.querySelectorAll('[data-plane]').forEach(pl=>{
        const f=parseFloat(pl.dataset.plane||'1');
        pl.style.transform='translate('+(x*(f-1))+'px,'+(y*(f-1))+'px) scale('+(1+(sc-1)*(f-1))+')';
      });
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
