import { useState, useEffect, useRef } from 'react';
import { tokens } from '../../lib/tokens';
import type { Status } from '../../lib/schema';

interface DocData {
  slug: string;
  title: string;
  type: string;
  sourceUrl: string | null;
}

interface GraphNode {
  data: {
    id: string;
    label: string;
    status?: Status;
    type: 'standard' | 'external';
    sourceUrl?: string;
    docCount?: number;
    documents?: DocData[];
  };
}

interface GraphEdge {
  data: {
    id: string;
    source: string;
    target: string;
    targets?: string[];
    type: 'associate' | 'supersede' | 'converge';
    state: 'planned' | 'in-progress' | 'complete';
    description?: string | null;
    sourceUrl?: string;
  };
}

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface SelectedNode {
  id: string;
  label: string;
  docCount: number;
  expanded: boolean;
}

const edgeColors: Record<string, string> = {
  supersede: tokens.status['sunset-scheduled'],
  converge: tokens.status['under-review'],
  associate: tokens.color.accent,
};

const edgeDash: Record<string, number[] | undefined> = {
  planned: [6, 4],
  'in-progress': [3, 3],
  complete: undefined,
};

function graphLabel(name: string): string {
  const acronym = name.match(/\(([A-Z0-9][^)]{0,12})\)$/);
  if (acronym) return acronym[1];
  const noPrefix = name.replace(/^PCI /, '');
  if (noPrefix.length <= 28) return noPrefix;
  return noPrefix.slice(0, 25) + '...';
}

export default function GraphIsland({ nodes, edges }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const cyRef = useRef<any>(null);
  const prefersReducedMotionRef = useRef(false);
  const minimapParamsRef = useRef<{ x1: number; y1: number; scale: number; ox: number; oy: number } | null>(null);
  const toggleExpandRef = useRef<((id: string) => void) | null>(null);

  const [showIsolated, setShowIsolated] = useState(false);
  const [zoomPct, setZoomPct] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; label: string }[]>([]);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);

  const connectedIds = new Set(edges.flatMap(e => [e.data.source, e.data.target]));

  const labeledConnected = nodes
    .filter(n => connectedIds.has(n.data.id))
    .map(n => ({
      ...n,
      data: { ...n.data, name: n.data.label, label: graphLabel(n.data.label) },
    }));

  const labeledIsolated = nodes
    .filter(n => !connectedIds.has(n.data.id))
    .map(n => ({
      ...n,
      data: { ...n.data, name: n.data.label, label: graphLabel(n.data.label) },
    }));

  const hasIsolated = labeledIsolated.length > 0;

  // prefers-reduced-motion setup
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { prefersReducedMotionRef.current = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Cytoscape init
  useEffect(() => {
    if (!containerRef.current) return;
    let cy: any = null;
    let minimapTimer: ReturnType<typeof setTimeout> | null = null;
    let zoomTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleMinimapUpdate = () => {
      if (minimapTimer) clearTimeout(minimapTimer);
      minimapTimer = setTimeout(drawMinimap, 120);
    };

    const drawMinimap = () => {
      const canvas = minimapRef.current;
      if (!canvas || !cy) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const allNodes = cy.nodes();
      if (!allNodes.length) return;

      let gx1 = Infinity, gy1 = Infinity, gx2 = -Infinity, gy2 = -Infinity;
      allNodes.forEach((n: any) => {
        const p = n.position();
        gx1 = Math.min(gx1, p.x - 70);
        gy1 = Math.min(gy1, p.y - 30);
        gx2 = Math.max(gx2, p.x + 70);
        gy2 = Math.max(gy2, p.y + 30);
      });

      const bbW = gx2 - gx1 || 1;
      const bbH = gy2 - gy1 || 1;
      const pad = 6;
      const scale = Math.min((W - pad * 2) / bbW, (H - pad * 2) / bbH);
      const ox = pad + ((W - pad * 2) - bbW * scale) / 2;
      const oy = pad + ((H - pad * 2) - bbH * scale) / 2;

      minimapParamsRef.current = { x1: gx1, y1: gy1, scale, ox, oy };

      const toMX = (gx: number) => ox + (gx - gx1) * scale;
      const toMY = (gy: number) => oy + (gy - gy1) * scale;

      // Draw relationship edges (skip doc-edges)
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 0.5;
      cy.edges().not('.doc-edge').forEach((e: any) => {
        const sp = e.source().position();
        const tp = e.target().position();
        ctx.beginPath();
        ctx.moveTo(toMX(sp.x), toMY(sp.y));
        ctx.lineTo(toMX(tp.x), toMY(tp.y));
        ctx.stroke();
      });

      // Draw nodes
      allNodes.forEach((n: any) => {
        const p = n.position();
        const mx = toMX(p.x);
        const my = toMY(p.y);
        if (n.hasClass('doc-satellite')) {
          ctx.fillStyle = tokens.color.border;
          ctx.beginPath();
          ctx.arc(mx, my, 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const st = n.data('status') as Status | undefined;
          ctx.fillStyle = st && tokens.status[st] ? tokens.status[st] : tokens.color.accent;
          ctx.beginPath();
          ctx.arc(mx, my, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Viewport rectangle
      const ext = cy.extent();
      const vx = toMX(ext.x1);
      const vy = toMY(ext.y1);
      const vw = ext.w * scale;
      const vh = ext.h * scale;
      ctx.strokeStyle = tokens.color.accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(vx, vy, Math.max(vw, 4), Math.max(vh, 4));
    };

    import('cytoscape').then(({ default: cytoscape }) => {
      if (!containerRef.current) return;

      const stylesheet = [
        {
          selector: 'node[type="standard"]',
          style: {
            'background-color': (ele: any) => {
              const status = ele.data('status') as Status | undefined;
              return status ? tokens.status[status] : tokens.color.accent;
            },
            'label': 'data(label)',
            'color': '#fff',
            'text-valign': 'center' as const,
            'text-halign': 'center' as const,
            'font-size': '11px',
            'font-family': tokens.font.ui,
            'width': '140px',
            'height': '52px',
            'shape': 'round-rectangle' as const,
            'text-wrap': 'wrap' as const,
            'text-max-width': '130px',
          },
        },
        {
          selector: 'node[type="external"]',
          style: {
            'background-color': tokens.color.border,
            'border-color': tokens.color.text,
            'border-width': '1px',
            'label': 'data(label)',
            'color': tokens.color.text,
            'text-valign': 'center' as const,
            'text-halign': 'center' as const,
            'font-size': '11px',
            'font-family': tokens.font.ui,
            'width': '80px',
            'height': '30px',
            'shape': 'ellipse' as const,
          },
        },
        {
          selector: 'node.doc-satellite',
          style: {
            'background-color': tokens.color.bg,
            'border-color': tokens.color.border,
            'border-width': '1px',
            'label': 'data(label)',
            'color': tokens.color.text,
            'text-valign': 'center' as const,
            'text-halign': 'center' as const,
            'font-size': '9px',
            'font-family': tokens.font.ui,
            'width': '120px',
            'height': '40px',
            'shape': 'round-rectangle' as const,
            'text-wrap': 'wrap' as const,
            'text-max-width': '112px',
          },
        },
        {
          selector: 'node.isolated',
          style: { 'opacity': 0.75 },
        },
        {
          selector: ':selected',
          style: {
            'border-width': '2px',
            'border-color': tokens.color.accent,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': (ele: any) => edgeColors[ele.data('type')] ?? tokens.color.border,
            'line-dash-pattern': (ele: any) => edgeDash[ele.data('state')] ?? [],
            'target-arrow-shape': 'triangle' as const,
            'target-arrow-color': (ele: any) => edgeColors[ele.data('type')] ?? tokens.color.border,
            'curve-style': 'bezier' as const,
            'label': 'data(type)',
            'font-size': '10px',
            'font-family': tokens.font.ui,
            'color': tokens.color.text,
            'text-rotation': 'autorotate' as const,
            'text-margin-y': '-8px',
          },
        },
        {
          selector: 'edge.doc-edge',
          style: {
            'width': 1,
            'line-color': tokens.color.border,
            'line-dash-pattern': [3, 3] as number[],
            'target-arrow-shape': 'none' as const,
            'curve-style': 'straight' as const,
            'opacity': 0.5,
            'label': '',
          },
        },
      ];

      cy = cytoscape({
        container: containerRef.current,
        elements: { nodes: labeledConnected, edges },
        style: stylesheet as Parameters<typeof cytoscape>[0]['style'],
        layout: {
          name: 'cose',
          animate: false,
          nodeDimensionsIncludeLabels: true,
          nodeRepulsion: () => 50000,
          idealEdgeLength: () => 220,
          nodeOverlap: 20,
          fit: true,
          padding: 48,
        },
      });

      cyRef.current = cy;

      // Zoom level readout (debounced)
      cy.on('zoom', () => {
        if (zoomTimer) clearTimeout(zoomTimer);
        zoomTimer = setTimeout(() => {
          setZoomPct(Math.round(cy.zoom() * 100));
        }, 60);
      });

      cy.on('zoom pan add remove', scheduleMinimapUpdate);

      // Tap edge: open source
      cy.on('tap', 'edge', (e: any) => {
        const url = e.target.data('sourceUrl');
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      });

      // Tap standard node: select and show panel
      cy.on('tap', 'node[type="standard"]', (e: any) => {
        const node = e.target;
        setSelectedNode({
          id: node.data('id'),
          label: node.data('name') || node.data('label'),
          docCount: node.data('docCount') || 0,
          expanded: !!node.data('expanded'),
        });
        e.stopPropagation();
      });

      // Tap doc satellite: open its source URL
      cy.on('tap', 'node.doc-satellite', (e: any) => {
        const url = e.target.data('sourceUrl');
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        e.stopPropagation();
      });

      // Tap background: deselect
      cy.on('tap', (e: any) => {
        if (e.target === cy) setSelectedNode(null);
      });

      // Expand/collapse document satellites
      const toggleExpandNode = (nodeId: string) => {
        const node = cy.getElementById(nodeId);
        if (!node.length) return;

        const isExpanded = !!node.data('expanded');

        if (isExpanded) {
          cy.remove(`.doc-of-${nodeId}`);
          node.data('expanded', false);
          setSelectedNode(prev => prev?.id === nodeId ? { ...prev, expanded: false } : prev);
        } else {
          const docs: DocData[] = node.data('documents') || [];
          const pos = node.position();
          const count = Math.min(docs.length, 10);
          const docNodes: any[] = [];
          const docEdges: any[] = [];

          for (let i = 0; i < count; i++) {
            const doc = docs[i];
            const angle = (2 * Math.PI * i) / count - Math.PI / 2;
            docNodes.push({
              group: 'nodes',
              classes: `doc-of-${nodeId} doc-satellite`,
              data: {
                id: `doc-${doc.slug}-${nodeId}`,
                label: doc.title,
                type: 'document',
                docType: doc.type,
                sourceUrl: doc.sourceUrl,
              },
              position: {
                x: pos.x + 190 * Math.cos(angle),
                y: pos.y + 130 * Math.sin(angle),
              },
            });
            docEdges.push({
              group: 'edges',
              classes: `doc-of-${nodeId} doc-edge`,
              data: {
                id: `doc-edge-${doc.slug}-${nodeId}`,
                source: nodeId,
                target: `doc-${doc.slug}-${nodeId}`,
                type: 'associate',
                state: 'complete',
              },
            });
          }

          cy.add([...docNodes, ...docEdges]);

          if (!prefersReducedMotionRef.current) {
            const added = cy.nodes(`.doc-of-${nodeId}`);
            added.style({ opacity: 0 });
            added.animate({ style: { opacity: 1 } }, { duration: 250 });
          }

          node.data('expanded', true);
          setSelectedNode(prev => prev?.id === nodeId ? { ...prev, expanded: true } : prev);
        }

        scheduleMinimapUpdate();
      };

      toggleExpandRef.current = toggleExpandNode;

      setTimeout(drawMinimap, 150);
    });

    // Minimap click: pan graph to that region
    const canvas = minimapRef.current;
    if (canvas) {
      canvas.addEventListener('click', (e: MouseEvent) => {
        const p = minimapParamsRef.current;
        const cy2 = cyRef.current;
        const cont = containerRef.current;
        if (!p || !cy2 || !cont) return;
        const rect = canvas.getBoundingClientRect();
        const graphX = p.x1 + (e.clientX - rect.left - p.ox) / p.scale;
        const graphY = p.y1 + (e.clientY - rect.top - p.oy) / p.scale;
        cy2.pan({
          x: -graphX * cy2.zoom() + cont.clientWidth / 2,
          y: -graphY * cy2.zoom() + cont.clientHeight / 2,
        });
      });
    }

    return () => {
      cy?.destroy();
      cyRef.current = null;
      toggleExpandRef.current = null;
      if (minimapTimer) clearTimeout(minimapTimer);
      if (zoomTimer) clearTimeout(zoomTimer);
    };
  }, []);

  // Add/remove isolated nodes
  useEffect(() => {
    const cy = cyRef.current as any;
    if (!cy) return;

    if (showIsolated) {
      cy.add(labeledIsolated.map((n: typeof labeledIsolated[0]) => ({ ...n, classes: 'isolated' })));
      const connectedEles = cy.nodes().not('.isolated');
      const bb = connectedEles.length > 0 ? connectedEles.boundingBox() : { x1: 0, y2: 0 };
      const cols = Math.max(1, Math.ceil(Math.sqrt(labeledIsolated.length)));
      labeledIsolated.forEach((node: typeof labeledIsolated[0], i: number) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        cy.getElementById(node.data.id).position({
          x: (bb.x1 as number) + col * 180,
          y: (bb.y2 as number) + 140 + row * 110,
        });
      });
      cy.fit(undefined, 48);
    } else {
      cy.remove('.isolated');
      cy.fit(undefined, 48);
    }
  }, [showIsolated]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); return; }
    const cy = cyRef.current as any;
    if (!cy) return;
    const q = query.toLowerCase();
    const matches: { id: string; label: string }[] = [];
    cy.nodes().not('.doc-satellite').forEach((n: any) => {
      const name = (n.data('name') || n.data('label') || '') as string;
      const id = (n.data('id') || '') as string;
      if (name.toLowerCase().includes(q) || id.replace(/-/g, ' ').includes(q)) {
        matches.push({ id, label: name });
      }
    });
    setSearchResults(matches.slice(0, 8));
  };

  const selectResult = (id: string) => {
    const cy = cyRef.current as any;
    if (!cy) return;
    const node = cy.getElementById(id);
    if (!node.length) return;
    cy.animate({
      center: { eles: node },
      zoom: Math.max(cy.zoom(), 1),
      duration: prefersReducedMotionRef.current ? 0 : 300,
      easing: 'ease-in-out-cubic',
    });
    cy.nodes().deselect();
    node.select();
    if (node.data('type') === 'standard') {
      setSelectedNode({
        id: node.data('id'),
        label: node.data('name') || node.data('label'),
        docCount: node.data('docCount') || 0,
        expanded: !!node.data('expanded'),
      });
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const zoomIn = () => { const cy = cyRef.current as any; if (cy) cy.zoom(Math.min(cy.zoom() * 1.3, 5)); };
  const zoomOut = () => { const cy = cyRef.current as any; if (cy) cy.zoom(Math.max(cy.zoom() / 1.3, 0.1)); };
  const fitGraph = () => { const cy = cyRef.current as any; if (cy) cy.fit(undefined, 48); };

  const btn: React.CSSProperties = {
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)',
    padding: '3px 8px',
    cursor: 'pointer',
    color: 'var(--color-accent)',
    fontSize: '0.8125rem',
    fontFamily: 'var(--font-ui)',
    lineHeight: '1.4',
  };

  const abs: React.CSSProperties = { position: 'absolute', zIndex: 10 };

  return (
    <div
      style={{ position: 'relative', height: '100%', width: '100%' }}
      aria-label="Relationship graph; tap nodes to select, tap edges to open source references"
    >
      {/* Search */}
      <div style={{ ...abs, top: 8, left: 8 }}>
        <div style={{ position: 'relative' }}>
          <input
            type="search"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            onBlur={() => setTimeout(() => setSearchResults([]), 200)}
            placeholder="Find a standard..."
            aria-label="Search standards in graph"
            style={{
              ...btn,
              color: 'var(--color-text)',
              padding: '4px 8px',
              width: '180px',
            }}
          />
          {searchResults.length > 0 && searchQuery && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              width: '220px',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              zIndex: 30,
              maxHeight: '200px',
              overflowY: 'auto',
            }}>
              {searchResults.map(r => (
                <button
                  key={r.id}
                  onMouseDown={() => selectResult(r.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--color-border)',
                    padding: '6px 8px',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-ui)',
                    color: 'var(--color-text)',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toggle isolated nodes */}
      {hasIsolated && (
        <div style={{ ...abs, top: 8, right: 8 }}>
          <button onClick={() => setShowIsolated(s => !s)} style={btn}>
            {showIsolated ? 'Connected only' : 'Show all standards'}
          </button>
        </div>
      )}

      {/* Selected node action panel */}
      {selectedNode && (
        <div style={{
          ...abs,
          top: 46,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          padding: '4px 10px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          fontSize: '0.8125rem',
          fontFamily: 'var(--font-ui)',
          whiteSpace: 'nowrap',
          maxWidth: 'calc(100% - 32px)',
        }}>
          <span style={{ fontWeight: 500, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
            {selectedNode.label}
          </span>
          {selectedNode.docCount > 0 && (
            <button
              onClick={() => toggleExpandRef.current?.(selectedNode.id)}
              style={{ ...btn, padding: '2px 6px' }}
              title={selectedNode.expanded ? 'Collapse documents' : 'Expand documents around this node'}
            >
              {selectedNode.expanded ? '− docs' : `+ ${selectedNode.docCount} docs`}
            </button>
          )}
          <a
            href={`/standard/${selectedNode.id}`}
            style={{ color: 'var(--color-accent)', textDecoration: 'none', fontSize: '0.8125rem', fontFamily: 'var(--font-ui)' }}
          >
            Open ↗
          </a>
          <button
            onClick={() => setSelectedNode(null)}
            aria-label="Dismiss"
            style={{ ...btn, padding: '2px 5px', color: 'var(--color-text-muted)' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Zoom controls */}
      <div style={{ ...abs, bottom: 8, right: 8, display: 'flex', gap: '3px', alignItems: 'center' }}>
        <button onClick={zoomOut} style={btn} aria-label="Zoom out">−</button>
        <span style={{ ...btn, cursor: 'default', minWidth: '44px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          {zoomPct}%
        </span>
        <button onClick={zoomIn} style={btn} aria-label="Zoom in">+</button>
        <button onClick={fitGraph} style={{ ...btn, marginLeft: '4px' }} aria-label="Fit graph to view">Fit</button>
      </div>

      {/* Minimap */}
      <canvas
        ref={minimapRef}
        width={160}
        height={100}
        style={{ ...abs, bottom: 8, left: 8, border: '1px solid var(--color-border)', borderRadius: '3px', background: 'var(--color-bg)', cursor: 'crosshair' }}
        aria-label="Graph minimap; click to pan"
        title="Click to pan to that area"
      />

      {/* Cytoscape container */}
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
}
