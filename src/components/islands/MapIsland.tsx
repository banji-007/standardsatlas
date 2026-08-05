import React, { useState, useEffect, useRef } from 'react';
import { ErrorBoundary, DetailDrawer, SM, GRAPH_LABEL, RT, RS, fmt } from './shared';
import type { AppData } from './shared';

interface PhysNode { slug: string; x: number; y: number; vx: number; vy: number; r: number; }
interface PhysEdge { from: string; to: string; type: string; state: string; }

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
      if (activeRef.current) return;
      activeRef.current = true;
      rafId = requestAnimationFrame(step);
    };
    wakeRef.current = wake;
    const step = () => {
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
    return () => {
      activeRef.current = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
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

export default function MapIsland({ data, initialSelected }: { data: AppData; initialSelected?: string | null }) {
  const [selected, setSelected] = useState<string | null>(initialSelected ?? null);
  if (!data) return <div style={{ padding: 40, color: 'red', fontFamily: 'monospace' }}>Error: props.data is undefined</div>;
  const { standards, relationships } = data;
  const selectedStd = standards.find(s => s.slug === selected) ?? null;

  return (
    <ErrorBoundary>
      <>
        <TransitionsView standards={standards} relationships={relationships} onSelect={setSelected} />
        {selectedStd && <DetailDrawer std={selectedStd} relationships={relationships} standards={standards} onClose={() => setSelected(null)} />}
      </>
    </ErrorBoundary>
  );
}
