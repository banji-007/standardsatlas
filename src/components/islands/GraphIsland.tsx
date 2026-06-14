import { useState, useEffect, useRef } from 'react';
import { tokens } from '../../lib/tokens';
import type { Status } from '../../lib/schema';

interface GraphNode {
  data: {
    id: string;
    label: string;
    status?: Status;
    type: 'standard' | 'external';
    sourceUrl?: string;
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
  const cyRef = useRef<ReturnType<typeof import('cytoscape')['default']> | null>(null);
  const [showIsolated, setShowIsolated] = useState(false);

  const connectedIds = new Set(edges.flatMap(e => [e.data.source, e.data.target]));
  const labeledConnected = nodes
    .filter(n => connectedIds.has(n.data.id))
    .map(n => ({ ...n, data: { ...n.data, label: graphLabel(n.data.label) } }));
  const labeledIsolated = nodes
    .filter(n => !connectedIds.has(n.data.id))
    .map(n => ({ ...n, data: { ...n.data, label: graphLabel(n.data.label) } }));
  const hasIsolated = labeledIsolated.length > 0;

  useEffect(() => {
    if (!containerRef.current) return;

    let cy: any = null;

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
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '11px',
            'font-family': tokens.font.ui,
            'width': '140px',
            'height': '52px',
            'shape': 'round-rectangle',
            'text-wrap': 'wrap',
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
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '11px',
            'font-family': tokens.font.ui,
            'width': '80px',
            'height': '30px',
            'shape': 'ellipse',
          },
        },
        {
          selector: 'node.isolated',
          style: { 'opacity': 0.75 },
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': (ele: any) => edgeColors[ele.data('type')] ?? tokens.color.border,
            'line-dash-pattern': (ele: any) => edgeDash[ele.data('state')] ?? [],
            'target-arrow-shape': 'triangle',
            'target-arrow-color': (ele: any) => edgeColors[ele.data('type')] ?? tokens.color.border,
            'curve-style': 'bezier',
            'label': 'data(type)',
            'font-size': '10px',
            'font-family': tokens.font.ui,
            'color': tokens.color.text,
            'text-rotation': 'autorotate',
            'text-margin-y': '-8px',
          },
        },
        {
          selector: ':selected',
          style: {
            'border-width': '2px',
            'border-color': tokens.color.accent,
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

      (cy as any).on('tap', 'edge', (e: any) => {
        const url = e.target.data('sourceUrl');
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      });

      (cy as any).on('tap', 'node', (e: any) => {
        if (e.target.data('type') === 'standard') {
          window.location.href = `/standard/${e.target.data('id')}`;
        }
      });
    });

    return () => {
      (cy as any)?.destroy();
      cyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cy = cyRef.current as any;
    if (!cy) return;

    if (showIsolated) {
      cy.add(labeledIsolated.map((n: GraphNode) => ({ ...n, classes: 'isolated' })));

      const connectedEles = cy.nodes().not('.isolated');
      const bb = connectedEles.length > 0
        ? connectedEles.boundingBox()
        : { x1: 0, y2: 0 };

      const cols = Math.max(1, Math.ceil(Math.sqrt(labeledIsolated.length)));
      labeledIsolated.forEach((node: GraphNode, i: number) => {
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

  const btnStyle: React.CSSProperties = {
    position: 'absolute',
    top: '8px',
    right: '8px',
    zIndex: 10,
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius)',
    padding: '4px 10px',
    cursor: 'pointer',
    color: 'var(--color-accent)',
    fontSize: '0.8125rem',
    fontFamily: 'var(--font-ui)',
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {hasIsolated && (
        <button onClick={() => setShowIsolated(s => !s)} style={btnStyle}>
          {showIsolated ? 'Hide isolated standards' : 'Show all standards'}
        </button>
      )}
      <div
        ref={containerRef}
        style={{ height: '100%', width: '100%' }}
        aria-label="Relationship graph; click nodes to visit standard pages, click edges to open source references"
      />
    </div>
  );
}
