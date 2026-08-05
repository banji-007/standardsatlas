import React, { useState, useEffect, useRef } from 'react';
import { ErrorBoundary, DetailDrawer, DetailSheet, SM, GRAPH_LABEL, RT, RS, fmt, abbrev } from './shared';
import type { AppData, StdData, RelData } from './shared';

interface PhysNode { slug: string; x: number; y: number; vx: number; vy: number; r: number; }
interface PhysEdge { from: string; to: string; type: string; state: string; }

// CSS alone ([data-vp-show="desktop"] -> display:none on mobile) stops
// this from painting, but a requestAnimationFrame loop keeps running and
// burning CPU/battery on a hidden element regardless of display. Task 4
// requires the physics simulation not run below 640px, so the loop
// itself checks the same data-vp attribute the rest of the mobile/
// desktop split reads (set synchronously pre-paint, see BaseLayout.astro
// and Task 1's verification of it) before starting or continuing.
function isMobileViewport(): boolean {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-vp') === 'mobile';
}

function TransitionsView({ standards, relationships, onSelect }: { standards: AppData['standards']; relationships: AppData['relationships']; onSelect: (slug: string) => void }) {
  const nodesRef  = useRef<PhysNode[] | null>(null);
  const idxRef    = useRef<Record<string, number>>({});
  const edgesRef  = useRef<PhysEdge[]>([]);
  const dragRef   = useRef<number | null>(null);
  const stageRef  = useRef<HTMLDivElement | null>(null);
  const movedRef  = useRef(false);
  const keRef     = useRef(0);
  const activeRef = useRef(false);
  const wakeRef   = useRef<() => void>(() => {});
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (nodesRef.current) return;
    nodesRef.current = standards.map((s, i) => {
      const ang = i / standards.length * 6.2832;
      return { slug: s.slug, x: 400 + Math.cos(ang) * 200, y: 260 + Math.sin(ang) * 168, vx: 0, vy: 0, r: Math.min(42, 15 + Math.sqrt(s.documents.length) * 3.4) };
    });
    idxRef.current = {};
    nodesRef.current.forEach((n, i) => { idxRef.current[n.slug] = i; });
    edgesRef.current = [];
    relationships.forEach(r => { (Array.isArray(r.to) ? r.to : [r.to]).forEach(t => edgesRef.current.push({ from: r.from, to: t, type: r.type, state: r.state })); });
  }, []);

  useEffect(() => {
    let rafId: number;
    const wake = () => {
      if (activeRef.current || isMobileViewport()) return;
      activeRef.current = true;
      rafId = requestAnimationFrame(step);
    };
    wakeRef.current = wake;
    const step = () => {
      if (isMobileViewport()) { activeRef.current = false; return; }
      const N = nodesRef.current; if (!N) { rafId = requestAnimationFrame(step); return; }
      let ke = 0;
      for (let i = 0; i < N.length; i++) {
        const a = N[i]; if (dragRef.current === i) continue;
        let fx = (400 - a.x) * 0.009, fy = (260 - a.y) * 0.009;
        for (let j = 0; j < N.length; j++) { if (i === j) continue; const b = N[j]; const dx = a.x - b.x, dy = a.y - b.y, d2 = dx*dx + dy*dy || 0.01, d = Math.sqrt(d2); fx += dx/d * (9500/d2); fy += dy/d * (9500/d2); }
        a.vx = (a.vx + fx * 0.02) * 0.80; a.vy = (a.vy + fy * 0.02) * 0.80;
      }
      edgesRef.current.forEach(ed => {
        const ai = idxRef.current[ed.from], bi = idxRef.current[ed.to], a = N[ai], b = N[bi];
        if (!a || !b) return;
        const dx = b.x-a.x, dy = b.y-a.y, d = Math.sqrt(dx*dx+dy*dy)||0.01, f = (d-150)*0.02, ux = dx/d, uy = dy/d;
        if (dragRef.current !== ai) { a.vx += ux*f; a.vy += uy*f; }
        if (dragRef.current !== bi) { b.vx -= ux*f; b.vy -= uy*f; }
      });
      for (let i = 0; i < N.length; i++) {
        const a = N[i]; if (dragRef.current === i) { a.vx = 0; a.vy = 0; continue; }
        a.x += a.vx; a.y += a.vy; a.x = Math.max(a.r+10, Math.min(790-a.r, a.x)); a.y = Math.max(a.r+10, Math.min(510-a.r, a.y)); ke += a.vx*a.vx + a.vy*a.vy;
      }
      keRef.current = ke;
      const settled = ke <= 0.04 && dragRef.current === null;
      setFrame(n => n + 1);
      if (settled) { activeRef.current = false; return; }
      rafId = requestAnimationFrame(step);
    };
    wake();
    const onMove = (e: MouseEvent) => {
      if (dragRef.current === null || !stageRef.current || !nodesRef.current) return;
      const r = stageRef.current.getBoundingClientRect(), n = nodesRef.current[dragRef.current];
      if (n) { n.x = (e.clientX - r.left) / r.width * 800; n.y = (e.clientY - r.top) / r.height * 520; n.vx = 0; n.vy = 0; movedRef.current = true; setFrame(n => n + 1); wake(); }
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    // Resuming when a resize crosses back over the breakpoint is not
    // required by Task 4, but leaving the graph permanently frozen after
    // a user resizes past 640px (e.g. rotating a tablet, or a desktop
    // window drag) would be a real regression for anyone who does cross
    // it, so re-wake on the same data-vp change BaseLayout's script emits.
    const vpObserver = new MutationObserver(() => { if (!isMobileViewport()) wake(); });
    vpObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-vp'] });
    return () => {
      activeRef.current = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
      vpObserver.disconnect();
    };
  }, []);

  void frame;
  const N = nodesRef.current;

  const legendItems = (
    <>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 16, height: 2, background: '#b5562f', display: 'inline-block' }} />converge</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 16, height: 2, background: '#9a948b', display: 'inline-block' }} />supersede</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 16, height: 0, borderTop: '2px dashed #5a6fd0', display: 'inline-block' }} />associate / planned</span>
    </>
  );

  return (
    <section className="si-section si-trans-section">
      <h2 style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 24, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-.01em' }}>Transitions &amp; relationships</h2>
      <p style={{ fontSize: 14, color: '#6b655b', margin: '0 0 22px', maxWidth: 680 }}>
        How standards supersede, converge into, and align with one another. Each orb is a standard, sized by how many supporting documents it carries.{' '}
        <span className="si-trans-copy-mouse">Drag to rearrange, or click to open.</span>
        <span className="si-trans-copy-touch">Tap an orb to open it.</span>
      </p>
      <div className="si-trans-stage-wrap">
        <div ref={stageRef} style={{ position: 'relative', width: 800, height: 520, margin: '0 auto' }}>
          {N && edgesRef.current.map((ed, i) => {
            const a = N[idxRef.current[ed.from]], b = N[idxRef.current[ed.to]]; if (!a || !b) return null;
            const col = ed.type === 'converge' ? '#b5562f' : ed.type === 'supersede' ? '#9a948b' : '#5a6fd0';
            const dx = b.x-a.x, dy = b.y-a.y, len = Math.sqrt(dx*dx+dy*dy), ang = Math.atan2(dy,dx)*180/Math.PI;
            return <div key={i} style={{ position: 'absolute', left: a.x, top: a.y, width: len, transformOrigin: '0 50%', transform: `rotate(${ang}deg)`, opacity: 0.5, pointerEvents: 'none', ...(ed.state === 'planned' ? { height: 0, borderTop: `2px dashed ${col}` } : { height: 2, background: col }) }} />;
          })}
          {N && N.map((p, i) => {
            const s = standards.find(x => x.slug === p.slug)!; const m = SM[s.status] || SM['active'];
            return (
              <div key={p.slug}
                className="si-trans-orb"
                onMouseDown={e => { e.preventDefault(); dragRef.current = i; movedRef.current = false; wakeRef.current(); }}
                onClick={() => { if (movedRef.current) { movedRef.current = false; return; } onSelect(p.slug); }}
                title={s.name}
                style={{ position: 'absolute', left: p.x-p.r, top: p.y-p.r, width: p.r*2, height: p.r*2, borderRadius: '50%', background: m.bg, border: `2px solid ${m.c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', boxShadow: '0 1px 3px rgba(0,0,0,.08)', userSelect: 'none' }}>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, fontWeight: 600, color: '#3a3630', pointerEvents: 'none', textAlign: 'center', whiteSpace: 'nowrap' }}>{GRAPH_LABEL[p.slug] ?? s.name}</span>
              </div>
            );
          })}
        </div>
        <div className="si-trans-legend">
          {legendItems}
        </div>
      </div>
      <div className="si-trans-legend-static">
        {legendItems}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {relationships.slice().sort((a, b) => String(b.effective_date||'0').localeCompare(String(a.effective_date||'0'))).map(r => {
          const rt = RT[r.type] || RT.associate, rs = RS[r.state] || RS.planned;
          const tos = (Array.isArray(r.to) ? r.to : [r.to]).map(t => standards.find(s => s.slug === t)?.name ?? t).join(' + ');
          const fromName = standards.find(s => s.slug === r.from)?.name ?? r.from;
          return (
            <div key={r.id} style={{ background: '#fbf7ee', border: '1px solid #e7e0d2', borderRadius: 13, padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 9 }}>
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: rt.c, background: rt.bg, padding: '4px 9px', borderRadius: 6 }}>{rt.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontFamily: "'Newsreader',Georgia,serif", fontSize: 16, fontWeight: 600 }}>
                  <span>{fromName}</span><span style={{ color: '#b5562f', fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }}>→</span><span>{tos}</span>
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, fontWeight: 500, color: rs.c, background: rs.bg, padding: '3px 9px', borderRadius: 20 }}>{rs.label}</span>
                <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: '#a08f6a' }}>{r.effective_date ? `eff. ${fmt(r.effective_date)}` : 'date TBD'}</span>
              </div>
              {r.description && <div style={{ fontSize: 13.5, color: '#5f594e', lineHeight: 1.5, maxWidth: 820 }}>{r.description}</div>}
              {r.source_url && <a href={r.source_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 9, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#1f5f5b', textDecoration: 'none', borderBottom: `1px solid #cfe0dd` }}>Source ↗</a>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// --- MapMobileView: focus + satellites, no physics. Neighbours come
// only from real relationships (see the "same family" note in the
// legend below — family isn't a real field, so those links never
// populate; the legend entry stays because it's a static color key, not
// a claim about any specific standard). ---
function atlasOf(standards: StdData[]): string[] {
  return standards.slice().sort((a, b) => (GRAPH_LABEL[a.slug] ?? a.name).localeCompare(GRAPH_LABEL[b.slug] ?? b.name)).map(s => s.slug);
}

function MapMobileView({ standards, relationships, focus, setFocus, trail, setTrail, onSelect }: {
  standards: StdData[]; relationships: RelData[];
  focus: string; setFocus: (v: string) => void;
  trail: string[]; setTrail: (v: string[]) => void;
  onSelect: (slug: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(340);
  const dragState = useRef<{ x0: number; y0: number; axis: 'x' | 'y' | null; dx: number; swiped: boolean } | null>(null);
  const [swipeDx, setSwipeDx] = useState(0);
  const [swiping, setSwiping] = useState(false);

  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const measure = () => { const w = el.clientWidth; if (w > 0) setStageW(w); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const shortOf = (slug: string) => { const s = standards.find(x => x.slug === slug); return s ? (GRAPH_LABEL[s.slug] ?? s.name) : slug; };
  const atlas = atlasOf(standards);
  const ai = Math.max(0, atlas.indexOf(focus));

  const recentre = (slug: string) => {
    const t = trail.filter(x => x !== slug).concat(slug).slice(-6);
    setTrail(t);
    setFocus(slug);
  };
  const stepFocus = (dir: 1 | -1) => {
    if (!atlas.length) return;
    const n = (ai + dir + atlas.length) % atlas.length;
    recentre(atlas[n]);
  };

  const onSwipeStart = (e: React.MouseEvent | React.TouchEvent) => {
    const t = 'touches' in e ? e.touches[0] : e;
    dragState.current = { x0: t.clientX, y0: t.clientY, axis: null, dx: 0, swiped: false };
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const p = 'touches' in ev ? ev.touches[0] : ev;
      const st = dragState.current; if (!st) return;
      const dx = p.clientX - st.x0, dy = p.clientY - st.y0;
      if (st.axis === null && (Math.abs(dx) > 7 || Math.abs(dy) > 7)) st.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (st.axis === 'x') {
        if (ev.cancelable) ev.preventDefault();
        if (Math.abs(dx) > 9) st.swiped = true;
        st.dx = dx; setSwiping(true); setSwipeDx(dx);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp);
      const st = dragState.current; dragState.current = null;
      setSwiping(false); setSwipeDx(0);
      if (st && st.axis === 'x' && Math.abs(st.dx) > 46) stepFocus(st.dx < 0 ? 1 : -1);
    };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false }); window.addEventListener('touchend', onUp);
  };

  const fs = standards.find(s => s.slug === focus) ?? standards[0];
  if (!fs) return null;
  const fm = SM[fs.status] || SM.active;

  const linked: { slug: string; type: string; state: string; rel: RelData; dir: 'in' | 'out' }[] = [];
  relationships.forEach(r => {
    const tos = Array.isArray(r.to) ? r.to : [r.to];
    if (r.from === focus) tos.forEach(t => linked.push({ slug: t, type: r.type, state: r.state, rel: r, dir: 'out' }));
    else if (tos.includes(focus)) linked.push({ slug: r.from, type: r.type, state: r.state, rel: r, dir: 'in' });
  });
  const neighbours = linked.slice(0, 8);

  const STAGE_H = 258, CX = stageW / 2, CY = STAGE_H / 2, RING = Math.min(112, stageW * 0.32), FR = 46;
  const edgeCol = (t: string) => (t === 'converge' ? '#b5562f' : t === 'supersede' ? '#9a948b' : '#5a6fd0');

  return (
    <section className="si-tl-mobile-header si-map-view">
      <div className="si-tl-mobile-heading-row">
        <h2>Map</h2>
        <span className="mono si-tl-mobile-count">{neighbours.length === 1 ? '1 neighbour' : `${neighbours.length} neighbours`}</span>
      </div>
      <p>Swipe the stage to move through standards. Tap a neighbour to follow a link: coloured links are recorded transitions.</p>

      {trail.length > 1 && (
        <div className="si-map-trail">
          {trail.map(slug => (
            <button key={slug} onClick={() => recentre(slug)} className="si-map-trail-chip" style={slug === focus ? { borderColor: '#1f5f5b', background: '#eef5f4', color: '#1f5f5b', fontWeight: 600 } : undefined}>
              {shortOf(slug)}
            </button>
          ))}
        </div>
      )}

      <div className="si-map-stage-card">
        <div
          ref={stageRef}
          onMouseDown={onSwipeStart}
          onTouchStart={onSwipeStart}
          className="si-map-stage-wrap"
          style={{
            transform: `translateX(${swipeDx * 0.5}px)`,
            opacity: swiping ? Math.max(0.42, 1 - Math.abs(swipeDx) / 380) : 1,
            transition: swiping ? 'none' : 'transform .28s cubic-bezier(.2,.8,.2,1), opacity .25s ease',
          }}
        >
          <div style={{ position: 'relative', width: stageW, height: STAGE_H, margin: '0 auto' }}>
            {neighbours.map((n, i) => {
              const ang = -Math.PI / 2 + (i / Math.max(1, neighbours.length)) * Math.PI * 2;
              return (
                <div key={'e' + n.slug + i} style={{
                  position: 'absolute', left: CX, top: CY, width: RING, height: 2, transformOrigin: '0 50%',
                  transform: `rotate(${ang * 180 / Math.PI}deg)`, opacity: 0.55, pointerEvents: 'none',
                  ...(n.state === 'planned' ? { height: 0, borderTop: `2px dashed ${edgeCol(n.type)}` } : { background: edgeCol(n.type) }),
                }} />
              );
            })}
            {neighbours.map((n, i) => {
              const ang = -Math.PI / 2 + (i / Math.max(1, neighbours.length)) * Math.PI * 2;
              const x = CX + Math.cos(ang) * RING, y = CY + Math.sin(ang) * RING;
              const s = standards.find(z => z.slug === n.slug);
              if (!s) return null;
              const m = SM[s.status] || SM.active;
              const r = Math.min(29, 13 + Math.sqrt(s.documents.length) * 2);
              const hit = Math.max(44, r * 2);
              let below = Math.sin(ang) > -0.15;
              let lTop = below ? y + r + 5 : y - r - 20;
              if (lTop < 2) { below = true; lTop = y + r + 5; }
              if (lTop + 26 > STAGE_H) lTop = Math.max(2, y - r - 20);
              return (
                <div key={n.slug}>
                  <button
                    onClick={() => { if (!dragState.current?.swiped) recentre(n.slug); }}
                    className="si-map-sat-btn"
                    style={{ left: x - hit / 2, top: y - hit / 2, width: hit, height: hit }}
                  >
                    <span style={{ width: r * 2, height: r * 2, borderRadius: '50%', background: m.bg, border: `2px solid ${m.c}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span className="mono" style={{ fontSize: 9.5, fontWeight: 600, color: m.c }}>{abbrev(shortOf(n.slug))}</span>
                    </span>
                  </button>
                  <div className="mono si-map-sat-label" style={{ left: x, top: lTop, width: Math.round(84) }}>{shortOf(n.slug)}</div>
                </div>
              );
            })}
            <button onClick={() => onSelect(focus)} className="si-map-focus-btn" style={{ left: CX - FR, top: CY - FR, width: FR * 2, height: FR * 2, background: fm.bg, borderColor: '#1f5f5b' }}>
              <span style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 13, fontWeight: 600, lineHeight: 1.1, textAlign: 'center' }}>{shortOf(focus)}</span>
              <span className="mono" style={{ fontSize: 9, opacity: 0.72, marginTop: 3 }}>{fs.documents.length} docs</span>
            </button>
          </div>
        </div>
        <div className="si-map-nav-row">
          <button onClick={() => stepFocus(-1)} className="si-map-step-btn">‹</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="si-map-progress-track"><div className="si-map-progress-fill" style={{ width: `${((ai + 1) / Math.max(1, atlas.length)) * 100}%` }} /></div>
            <div className="si-map-pos-row">
              <span className="si-map-edge-label">‹ {shortOf(atlas[(ai - 1 + atlas.length) % atlas.length])}</span>
              <span className="mono si-map-pos">{ai + 1} / {atlas.length}</span>
              <span className="si-map-edge-label">{shortOf(atlas[(ai + 1) % atlas.length])} ›</span>
            </div>
          </div>
          <button onClick={() => stepFocus(1)} className="si-map-step-btn">›</button>
        </div>
        <div className="si-map-legend">
          <span><span className="si-map-legend-swatch" style={{ background: '#c9744a' }} />converge</span>
          <span><span className="si-map-legend-swatch" style={{ background: '#a09a90' }} />supersede</span>
          <span><span className="si-map-legend-swatch-dashed" />associate</span>
          <span><span className="si-map-legend-swatch" style={{ background: '#e0d9cb' }} />same family</span>
        </div>
      </div>

      <select value={focus} onChange={e => recentre(e.target.value)} className="si-map-jump-select">
        {atlas.map(slug => <option key={slug} value={slug}>{shortOf(slug)}</option>)}
      </select>

      <button onClick={() => onSelect(focus)} className="si-map-focus-card">
        <div className="si-map-focus-card-top">
          <div className="si-map-focus-dot" style={{ background: fm.dot }} />
          <span className="mono si-map-focus-status">{fs.status.replace(/-/g, ' ')}</span>
          <span className="si-map-focus-badge" style={{ color: fm.c, background: fm.bg }}>{fm.label}</span>
        </div>
        <div className="si-map-focus-short">{shortOf(focus)}</div>
        <div className="si-map-focus-name">{fs.name}</div>
        <span className="mono si-map-focus-open">Open details →</span>
      </button>

      {neighbours.length > 0 ? (
        <div className="si-map-rels-block">
          <div className="si-map-rels-heading">Transitions</div>
          <div className="si-map-rels-list">
            {neighbours.map((n, i) => {
              const isFrom = n.rel.from === focus;
              const others = (isFrom ? (Array.isArray(n.rel.to) ? n.rel.to : [n.rel.to]) : [n.rel.from]).map(shortOf).join(', ');
              const phrase = n.type === 'supersede' ? (isFrom ? 'Superseded by' : 'Supersedes') : n.type === 'converge' ? (isFrom ? 'Converges into' : 'Convergence from') : 'Aligns with';
              const rt = RT[n.type] || RT.associate, rs = RS[n.state] || RS.planned;
              return (
                <div key={n.rel.id + i} className="si-map-rel-card">
                  <div className="si-map-rel-top">
                    <span className="si-map-rel-type" style={{ color: rt.c, background: rt.bg }}>{phrase}</span>
                    <span className="si-map-rel-others">{others}</span>
                  </div>
                  <div className="si-map-rel-mid">
                    <span className="mono si-map-rel-state" style={{ color: rs.c, background: rs.bg }}>{rs.label}</span>
                    <span className="mono si-map-rel-eff">{n.rel.effective_date ? fmt(n.rel.effective_date) : 'TBD'}</span>
                  </div>
                  {n.rel.description && <div className="si-map-rel-desc">{n.rel.description}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="si-map-empty">No recorded transitions for this standard.</div>
      )}

      <div className="si-map-all-block">
        <div className="si-tl-mobile-section-heading" style={{ margin: '0 0 12px' }}>
          <h3>Every transition</h3><span className="mono">{relationships.length} recorded</span>
        </div>
        <div className="si-map-rels-list">
          {relationships.slice().sort((a, b) => String(b.effective_date || '0').localeCompare(String(a.effective_date || '0'))).map(r => {
            const rt = RT[r.type] || RT.associate, rs = RS[r.state] || RS.planned;
            const tos = (Array.isArray(r.to) ? r.to : [r.to]).map(shortOf).join(' + ');
            const active = r.from === focus || (Array.isArray(r.to) ? r.to.includes(focus) : r.to === focus);
            return (
              <button key={r.id} onClick={() => recentre(r.from)} className="si-map-rel-card si-map-rel-card-btn" style={active ? { borderColor: '#1f5f5b' } : undefined}>
                <div className="si-map-rel-top">
                  <span className="si-map-rel-type" style={{ color: rt.c, background: rt.bg }}>{rt.label}</span>
                  <span className="mono si-map-rel-eff" style={{ marginLeft: 'auto' }}>{r.effective_date ? fmt(r.effective_date) : 'TBD'}</span>
                </div>
                <div className="si-map-rel-from-to">
                  <span className="si-map-rel-short">{shortOf(r.from)}</span>
                  <span className="mono si-map-rel-arrow" style={{ color: rt.c }}>→</span>
                  <span className="si-map-rel-short">{tos}</span>
                </div>
                {r.description && <div className="si-map-rel-desc">{r.description}</div>}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function MapIsland({ data, initialSelected }: { data: AppData; initialSelected?: string | null }) {
  const [selected, setSelected] = useState<string | null>(initialSelected ?? null);
  if (!data) return <div style={{ padding: 40, color: 'red', fontFamily: 'monospace' }}>Error: props.data is undefined</div>;
  const { standards, relationships, faqs } = data;
  const selectedStd = standards.find(s => s.slug === selected) ?? null;

  const defaultFocus = standards.some(s => s.slug === 'pci-dss') ? 'pci-dss' : (atlasOf(standards)[0] ?? '');
  const [focusM, setFocusM] = useState(defaultFocus);
  const [trailM, setTrailM] = useState<string[]>(defaultFocus ? [defaultFocus] : []);

  // Deep-link support for Task 5's detail-sheet "Map" jump button
  // (/map?standard=slug). Starts unread (matching SSR exactly) and picks
  // up the param post-mount, same reasoning as Task 3's version: reading
  // window.location.search during the initial render would disagree with
  // the static server-rendered HTML and reopen the hydration-mismatch
  // problem Task 1 solved.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('standard');
    if (slug && standards.some(s => s.slug === slug)) { setFocusM(slug); setTrailM([slug]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ErrorBoundary>
      <>
        <div data-vp-show="desktop">
          <TransitionsView standards={standards} relationships={relationships} onSelect={setSelected} />
        </div>
        <div data-vp-show="mobile">
          <MapMobileView standards={standards} relationships={relationships} focus={focusM} setFocus={setFocusM} trail={trailM} setTrail={setTrailM} onSelect={setSelected} />
        </div>
        {selectedStd && (
          <>
            <div data-vp-show="desktop"><DetailDrawer std={selectedStd} relationships={relationships} standards={standards} onClose={() => setSelected(null)} /></div>
            <div data-vp-show="mobile"><DetailSheet std={selectedStd} relationships={relationships} standards={standards} faqs={faqs} onClose={() => setSelected(null)} /></div>
          </>
        )}
      </>
    </ErrorBoundary>
  );
}
