import React, { useEffect } from 'react';
import type { Doc, StdData, RelData } from '../../lib/appTypes';

export type { Doc, Ver, StdData, RelData, AppData } from '../../lib/appTypes';

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null };
  static getDerivedStateFromError(e: Error) { return { err: e.message }; }
  render() {
    if (this.state.err) return (
      <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 9999, padding: 40, fontFamily: 'monospace', fontSize: 14, color: '#c00', whiteSpace: 'pre-wrap', overflowY: 'auto' }}>
        <b>React render error:</b>{'\n'}{this.state.err}
      </div>
    );
    return this.props.children;
  }
}

export const ACCENT = '#1f5f5b';

export const SM: Record<string, { label: string; c: string; bg: string; dot: string }> = {
  'active':           { label: 'Active',           c: '#1f7a4d', bg: '#e7f3ec', dot: '#2a9d63' },
  'under-review':     { label: 'Under review',     c: '#3a4f9e', bg: '#e9ecfb', dot: '#5a6fd0' },
  'sunset-scheduled': { label: 'Sunset scheduled', c: '#9a6512', bg: '#fbf0db', dot: '#d39314' },
  'retired':          { label: 'Retired',          c: '#6b6760', bg: '#ece9e3', dot: '#9a948b' },
  'forthcoming':      { label: 'Forthcoming',      c: '#2f6f9e', bg: '#e6f0f7', dot: '#4a8fc0' },
};

export const GRAPH_LABEL: Record<string, string> = {
  'pci-dss':         'PCI DSS',
  'p2pe':            'P2PE',
  'secure-software': 'Secure Software',
  'secure-slc':      'Secure SLC',
  'pts-poi':         'PTS POI',
  'pts-hsm':         'PTS HSM',
  'pin-security':    'PIN Security',
  'cpp-logical':     'CPP Logical',
  'cpp-physical':    'CPP Physical',
  '3ds-core':        'PCI 3DS Core',
  '3ds-sdk':         'PCI 3DS SDK',
  'mpoc':            'MPoC',
  'spoc':            'SPoC',
  'cpoc':            'CPoC',
  'tsp':             'TSP',
  'pa-dss':          'PA-DSS',
  'kmo':             'KMO',
};

export const DT: Record<string, { label: string; order: number; c: string; bg: string }> = {
  'standard':      { label: 'Standard',      order: 0, c: '#1f5f5b', bg: '#e6f0ef' },
  'guidance':      { label: 'Guidance',      order: 1, c: '#3a4f9e', bg: '#e9ecfb' },
  'faq':           { label: 'FAQ',           order: 2, c: '#7a4f8e', bg: '#f1ebf4' },
  'saq':           { label: 'SAQ',           order: 3, c: '#8a6512', bg: '#f6ecd8' },
  'template':      { label: 'Template',      order: 4, c: '#6b6760', bg: '#ece9e3' },
  'supplemental':  { label: 'Supplemental',  order: 5, c: '#6b6760', bg: '#ece9e3' },
  'bulletin':      { label: 'Bulletin',      order: 6, c: '#9a6512', bg: '#fbf0db' },
  'report':        { label: 'Report',        order: 7, c: '#6b6760', bg: '#ece9e3' },
  'program-guide': { label: 'Program guide', order: 8, c: '#3a4f9e', bg: '#e9ecfb' },
};

export const RT: Record<string, { label: string; c: string; bg: string }> = {
  converge: { label: 'Converge', c: '#b5562f', bg: '#f7e7df' },
  supersede: { label: 'Supersede', c: '#6b6760', bg: '#ece9e3' },
  associate: { label: 'Associate', c: '#3a4f9e', bg: '#e9ecfb' },
};

export const RS: Record<string, { label: string; c: string; bg: string }> = {
  planned: { label: 'Planned', c: '#8a8377', bg: '#efe9dd' },
  'in-progress': { label: 'In progress', c: '#9a6512', bg: '#fbf0db' },
  complete: { label: 'Complete', c: '#1f7a4d', bg: '#e7f3ec' },
};

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function fmt(d: string | null): string {
  if (!d) return 'TBD';
  const p = String(d).split('-');
  return MONTHS[(+p[1] || 1) - 1] + ' ' + p[0];
}

export function toX(d: string): number {
  const p = String(d).split('-');
  const v = +p[0] + ((+p[1] || 1) - 1) / 12;
  return Math.max(0, Math.min(100, (v - 2016) / 12 * 100));
}

// --- timeline events, shared by desktop's plot and mobile's vertical list ---
// Desktop derives per-standard marker x-positions directly from
// s.versions/relationships (fused with pixel-layout concerns: toX(),
// doc-marker pixel-proximity bucketing for the plot). Mobile needs a
// flat, chronologically-sorted feed instead. Rather than force both
// through one shape (risking the desktop-pixel-parity bar for a
// refactor with no behavioural upside), this is the one place genuinely
// shared: which versions/relationships count as a timeline event and
// what their date/label are. Both renderers read directly from
// s.versions / relationships (the real source data) beyond this, so
// there's no risk of the underlying facts drifting between them even
// though the presentation code paths are separate.
export interface TimelineEvent { date: string; kind: 'version' | 'sunset' | 'transition'; slug: string; short: string; label: string; }

export function buildTimelineEvents(standards: StdData[], relationships: RelData[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  standards.forEach(s => {
    const short = GRAPH_LABEL[s.slug] ?? s.name;
    s.versions.forEach(v => {
      if (v.published) events.push({ date: v.published, kind: 'version', slug: s.slug, short, label: `Version ${v.version} published` });
      if (v.retired) events.push({ date: v.retired, kind: 'sunset', slug: s.slug, short, label: `v${v.version}${v.status === 'retired' ? ' retired' : ' sunset'}` });
    });
  });
  relationships.forEach(r => {
    if (!r.effective_date) return;
    const from = standards.find(s => s.slug === r.from);
    if (!from) return;
    const tos = (Array.isArray(r.to) ? r.to : [r.to]).map(t => GRAPH_LABEL[t] ?? standards.find(s => s.slug === t)?.name ?? t).join(' + ');
    const verb = r.type === 'converge' ? 'Converges into ' : r.type === 'supersede' ? 'Superseded by ' : 'Aligns with ';
    events.push({ date: r.effective_date, kind: 'transition', slug: r.from, short: GRAPH_LABEL[from.slug] ?? from.name, label: verb + tos });
  });
  return events;
}

export function monthsAway(d: string): number {
  const p = String(d).split('-');
  const now = new Date();
  return (+p[0] - now.getFullYear()) * 12 + ((+p[1] || 1) - (now.getMonth() + 1));
}

export function relTime(d: string): string {
  const ma = monthsAway(d);
  return ma > 0 ? `in ${ma} mo` : ma < 0 ? `${Math.abs(ma)} mo ago` : 'this month';
}

export function firstSentence(text?: string): string {
  if (!text) return '';
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}

// --- radar / feed events, shared by desktop RadarStrip and mobile Today ---
// link is optional; when set, clicking the card navigates to that URL instead of opening a drawer.
export interface RadarEvent { slug: string; name: string; type: string; date: string; note: string; link?: string; }

export const EV_META: Record<string, { c: string; bg: string }> = {
  'New version':  { c: '#1f5f5b', bg: '#e6f0ef' },
  'FAQ updates':  { c: '#7a4f8e', bg: '#f1ebf4' },
  'New guidance': { c: '#3a4f9e', bg: '#e9ecfb' }, 'New bulletin':{ c: '#9a6512', bg: '#fbf0db' },
  'Sunset':       { c: '#9a6512', bg: '#fbf0db' }, 'Convergence': { c: '#b5562f', bg: '#f7e7df' },
  'Superseded':   { c: '#6b6760', bg: '#ece9e3' }, 'Alignment':   { c: '#3a4f9e', bg: '#e9ecfb' },
  'Under review': { c: '#3a4f9e', bg: '#e9ecfb' },
};

export function buildRadar(standards: StdData[], relationships: RelData[]): RadarEvent[] {
  const now = new Date();
  const cutoff = `${now.getFullYear() - 2}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const events: RadarEvent[] = [];

  standards.forEach(s => {
    s.versions.forEach(v => {
      if (v.published) events.push({ slug: s.slug, name: s.name, type: 'New version', date: v.published, note: `Version ${v.version} published.` });
      if (v.retired && v.status === 'sunset-scheduled') events.push({ slug: s.slug, name: s.name, type: 'Sunset', date: v.retired, note: `v${v.version} scheduled to sunset.` });
    });
    if (s.status === 'under-review') events.push({ slug: s.slug, name: s.name, type: 'Under review', date: s.last_verified || '', note: 'Standard under active development and review.' });
    // FAQs are excluded here; they are aggregated below to avoid flooding the radar.
    const nd = s.documents.filter(d => d.published && d.published >= cutoff && d.type !== 'faq')
      .sort((a, b) => String(b.published).localeCompare(String(a.published)))[0];
    if (nd?.published) {
      const t = nd.type === 'guidance' ? 'New guidance' : nd.type === 'bulletin' ? 'New bulletin' : null;
      if (t) events.push({ slug: s.slug, name: s.name, type: t, date: nd.published, note: nd.title.slice(0, 82) + (nd.title.length > 82 ? '…' : '') });
    }
  });

  relationships.forEach(r => {
    if (!r.effective_date) return;
    const t = r.type === 'converge' ? 'Convergence' : r.type === 'supersede' ? 'Superseded' : 'Alignment';
    events.push({ slug: r.from, name: standards.find(s => s.slug === r.from)?.name ?? r.from, type: t, date: r.effective_date, note: r.description ? r.description.split(/;|\.\s/)[0] + '.' : '' });
  });

  // Aggregate all recent FAQ documents across standards into a single card.
  const recentFaqs = standards.flatMap(s =>
    s.documents.filter(d => d.type === 'faq' && d.published && d.published >= cutoff)
  );
  if (recentFaqs.length > 0) {
    const latest = recentFaqs.slice().sort((a, b) => String(b.published).localeCompare(String(a.published)))[0]!;
    events.push({
      slug: '_faqs',
      name: 'FAQ activity',
      type: 'FAQ updates',
      date: latest.published!,
      note: `${recentFaqs.length} FAQ${recentFaqs.length > 1 ? 's' : ''} updated in this period.`,
      link: '/faqs',
    });
  }

  const seen = new Set<string>();
  return events.filter(e => e.date >= cutoff).sort((a, b) => b.date.localeCompare(a.date))
    .filter(e => { const k = e.slug + e.type + e.date; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 12);
}

// --- DetailDrawer (desktop) ---
export function DetailDrawer({ std, relationships, standards, onClose }: { std: StdData; relationships: RelData[]; standards: StdData[]; onClose: () => void }) {
  const m = SM[std.status] || SM['active'];
  const versions = std.versions.slice().sort((a, b) => String(b.published||'0').localeCompare(String(a.published||'0')));
  const rels = relationships.filter(r => r.from === std.slug || (Array.isArray(r.to) ? r.to.includes(std.slug) : r.to === std.slug));
  const groups: Record<string, Doc[]> = {};
  std.documents.forEach(d => { (groups[d.type] = groups[d.type] || []).push(d); });
  const docGroups = Object.keys(groups).sort((a, b) => (DT[a]?.order ?? 9) - (DT[b]?.order ?? 9)).map(type => ({
    type, label: DT[type]?.label ?? type, meta: DT[type] || { c: '#6b6760', bg: '#ece9e3' },
    items: groups[type].slice().sort((a, b) => String(b.published||'0').localeCompare(String(a.published||'0'))),
  }));
  const tagMap: Record<string, { t: string; c: string; bg: string }> = {
    active: { t: 'current', c: '#1f7a4d', bg: '#e7f3ec' },
    'sunset-scheduled': { t: 'sunset', c: '#9a6512', bg: '#fbf0db' },
    retired: { t: 'retired', c: '#6b6760', bg: '#ece9e3' },
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'var(--color-scrim)', zIndex: 40, animation: 'fadeIn .2s ease' }} />
      <aside role="dialog" aria-label={`Details for ${std.name}`} style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(500px, 95vw)', background: '#f7f2e8', zIndex: 50, boxShadow: '-24px 0 60px rgba(0,0,0,.18)', animation: 'drawerIn .26s cubic-bezier(.2,.8,.2,1)', overflowY: 'auto' }}>
        <div style={{ padding: '26px 30px 22px', borderBottom: '1px solid #e7e0d2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '.07em', color: '#8a8377', marginBottom: 6 }}>{std.status.replace(/-/g, ' ')}</div>
              <h2 style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 24, fontWeight: 600, margin: '0 0 4px', letterSpacing: '-.01em' }}>{std.name}</h2>
            </div>
            <button onClick={onClose} aria-label="Close drawer" className="si-drawer-close" style={{ borderRadius: 8, border: '1px solid #e0d9cb', background: '#fbf7ee', color: '#6b655b', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: m.c, background: m.bg, padding: '5px 12px', borderRadius: 7, display: 'inline-block' }}>{m.label}</span>
        </div>
        <div style={{ padding: '24px 30px 60px' }}>
          {std.notes && <p style={{ fontSize: 14, lineHeight: 1.6, color: '#3f3a31', margin: '0 0 22px' }}>{std.notes}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e7e0d2', border: '1px solid #e7e0d2', borderRadius: 11, overflow: 'hidden', marginBottom: 28 }}>
            {[
              { label: 'Current version', value: std.current_version ? `v${std.current_version}` : 'In development', mono: true, color: undefined },
              { label: 'Verification', value: std.verified ? '✓ Verified' : 'Provisional', mono: false, color: std.verified ? '#1f7a4d' : '#a08f6a' },
              { label: 'Last verified', value: fmt(std.last_verified), mono: false, color: undefined },
              { label: 'Documents', value: String(std.documents.length), mono: true, color: undefined },
            ].map(f => (
              <div key={f.label} style={{ background: '#fbf7ee', padding: '13px 16px' }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: '#a08f6a', marginBottom: 5 }}>{f.label}</div>
                <div style={{ ...(f.mono ? { fontFamily: "'IBM Plex Mono',monospace", fontSize: 14 } : { fontSize: 13.5 }), color: f.color ?? '#211e19', ...(f.color ? { fontWeight: 500 } : {}) }}>{f.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8a8377', marginBottom: 16 }}>Version lineage</div>
          {versions.length > 0 ? (
            <div style={{ position: 'relative', paddingLeft: 4, marginBottom: 30 }}>
              {versions.map((v, i) => {
                const tg = tagMap[v.status] || tagMap['active'], isCur = v.status === 'active', dot = SM[v.status]?.dot ?? '#2a9d63';
                return (
                  <div key={v.version} style={{ display: 'flex', gap: 15, paddingBottom: 18 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: isCur ? dot : '#fff', border: `2px solid ${isCur ? dot : '#cfc6b4'}`, flexShrink: 0, marginTop: 2 }} />
                      {i < versions.length - 1 && <div style={{ width: 2, flex: 1, background: '#e2dac9', marginTop: 4, minHeight: 12 }} />}
                    </div>
                    <div style={{ paddingTop: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13.5, fontWeight: 500, color: '#211e19' }}>v{v.version}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: '#a08f6a' }}>{fmt(v.published)}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: tg.c, background: tg.bg, padding: '2px 7px', borderRadius: 5 }}>{tg.t}</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: '#6b655b', marginTop: 3, lineHeight: 1.45 }}>
                        {v.retired ? `Retired ${fmt(v.retired)}${v.verified ? ' · verified' : ''}` : isCur ? `Current version${v.verified ? ' · verified' : ''}` : v.verified ? 'Verified' : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#a08f6a', marginBottom: 30, padding: '14px 16px', background: '#fbf7ee', border: '1px dashed #e0d9cb', borderRadius: 10 }}>No published versions yet. Standard still in development.</div>
          )}
          {rels.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8a8377', marginBottom: 14 }}>Transitions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rels.map(r => {
                  const isFrom = r.from === std.slug;
                  const others = (isFrom ? (Array.isArray(r.to) ? r.to : [r.to]) : [r.from]).map(t => standards.find(s => s.slug === t)?.name ?? t).join(', ');
                  const phrase = r.type === 'supersede' ? (isFrom ? 'Superseded by' : 'Supersedes') : r.type === 'converge' ? (isFrom ? 'Converges into' : 'Convergence from') : 'Aligns with';
                  const rt = RT[r.type] || RT.associate;
                  return (
                    <div key={r.id} style={{ background: '#fbf7ee', border: '1px solid #ece4d4', borderRadius: 10, padding: '13px 15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: rt.c, background: rt.bg, padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>{phrase}</span>
                        <span style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 14, fontWeight: 600 }}>{others}</span>
                        <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#a08f6a' }}>{r.effective_date ? fmt(r.effective_date) : 'TBD'}</span>
                      </div>
                      {r.description && <div style={{ fontSize: 12.5, color: '#6b655b', lineHeight: 1.45 }}>{r.description}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#8a8377' }}>Supporting documents</div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#a08f6a' }}>{std.documents.length} total</div>
          </div>
          {docGroups.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 24 }}>
              {docGroups.map(g => (
                <div key={g.type}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: g.meta.c, background: g.meta.bg, padding: '3px 9px', borderRadius: 6 }}>{g.label}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#b3aa99' }}>{g.items.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: '#ece4d4', border: '1px solid #ece4d4', borderRadius: 9, overflow: 'hidden' }}>
                    {g.items.map(doc => (
                      <a key={doc.slug} href={doc.source_url ?? '#'} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fbf7ee', padding: '10px 13px', textDecoration: 'none', transition: 'background 100ms' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fffdf8'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fbf7ee'}
                      >
                        <span style={{ flexShrink: 0, width: 15, textAlign: 'center', fontSize: 11, color: doc.verified ? '#1f7a4d' : '#cabfa9' }}>{doc.verified ? '✓' : '·'}</span>
                        <span style={{ flex: 1, fontSize: 12.5, color: '#3f3a31', lineHeight: 1.35, minWidth: 0 }}>{doc.title}</span>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#b3aa99', whiteSpace: 'nowrap' }}>{fmt(doc.published)}</span>
                        <span style={{ color: '#bdb4a2', fontSize: 11 }}>↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <a href={std.source_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: ACCENT, textDecoration: 'none', border: '1px solid #cfe0dd', background: '#eef5f4', padding: '9px 15px', borderRadius: 9 }}>
            View official standard page ↗
          </a>
        </div>
      </aside>
    </>
  );
}
