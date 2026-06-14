import { useEffect, useRef } from 'react';
import { tokens, statusLabel } from '../../lib/tokens';
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

const edgeDash: Record<string, string | undefined> = {
  planned: '6 4',
  'in-progress': '3 3',
  complete: undefined,
};

export default function GraphIsland({ nodes, edges }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cy: { destroy: () => void } | null = null;

    import('cytoscape').then(({ default: cytoscape }) => {
      if (!containerRef.current) return;

      const stylesheet = [
        {
          selector: 'node[type="standard"]',
          style: {
            'background-color': (ele: { data: (k: string) => Status | undefined }) => {
              const status = ele.data('status') as Status | undefined;
              return status ? tokens.status[status] : tokens.color.accent;
            },
            'label': 'data(label)',
            'color': '#fff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '11px',
            'font-family': tokens.font.ui,
            'width': '120px',
            'height': '40px',
            'shape': 'round-rectangle',
            'text-wrap': 'wrap',
            'text-max-width': '110px',
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
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': (ele: { data: (k: string) => string }) => edgeColors[ele.data('type')] ?? tokens.color.border,
            'line-dash-pattern': (ele: { data: (k: string) => string }) => {
              const dash = edgeDash[ele.data('state')];
              return dash ? dash.split(' ').map(Number) : [];
            },
            'target-arrow-shape': 'triangle',
            'target-arrow-color': (ele: { data: (k: string) => string }) => edgeColors[ele.data('type')] ?? tokens.color.border,
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
            'border-width': 2,
            'border-color': tokens.color.accent,
          },
        },
      ];

      cy = cytoscape({
        container: containerRef.current,
        elements: { nodes, edges },
        style: stylesheet as Parameters<typeof cytoscape>[0]['style'],
        layout: {
          name: 'cose',
          animate: false,
          nodeDimensionsIncludeLabels: true,
          nodeRepulsion: () => 8000,
          idealEdgeLength: () => 150,
        },
      });

      (cy as unknown as { on: (event: string, selector: string, handler: (e: { target: { data: (k: string) => string } }) => void) => void })
        .on('tap', 'edge', (e) => {
          const url = e.target.data('sourceUrl');
          if (url) window.open(url, '_blank', 'noopener,noreferrer');
        });

      (cy as unknown as { on: (event: string, selector: string, handler: (e: { target: { data: (k: string) => string } }) => void) => void })
        .on('tap', 'node', (e) => {
          const url = e.target.data('sourceUrl');
          if (url) window.location.href = `/standard/${e.target.data('id')}`;
        });
    });

    return () => {
      cy?.destroy();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', width: '100%' }}
      aria-label="Relationship graph — click nodes to visit standard pages, click edges to open source references"
    />
  );
}
