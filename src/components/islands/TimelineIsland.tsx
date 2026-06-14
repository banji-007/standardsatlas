import { useEffect, useRef } from 'react';

interface TimelineEvent {
  id: string;
  content: string;
  start: Date;
  end?: Date;
  group?: string;
  className?: string;
}

interface TimelineGroup {
  id: string;
  content: string;
}

interface Props {
  events: (TimelineEvent | null)[];
  groups?: TimelineGroup[];
}

export default function TimelineIsland({ events, groups }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const validEvents = events.filter((e): e is TimelineEvent => e !== null);
    if (validEvents.length === 0) return;

    let timeline: { destroy: () => void } | null = null;

    import('vis-timeline/standalone').then(({ Timeline, DataSet }) => {
      if (!containerRef.current) return;

      const items = new DataSet(validEvents.map(e => ({
        id: e.id,
        content: e.content,
        start: e.start,
        end: e.end,
        group: e.group,
        className: e.className,
      })));

      const timelineGroups = groups
        ? new DataSet(groups.map(g => ({ id: g.id, content: g.content })))
        : undefined;

      const options = {
        stack: true,
        showMajorLabels: true,
        showMinorLabels: true,
        moveable: true,
        zoomable: true,
        orientation: { axis: 'top' as const },
        height: '100%',
        groupOrder: 'content' as const,
      };

      timeline = new Timeline(
        containerRef.current!,
        items,
        timelineGroups ?? undefined,
        options,
      );
    });

    return () => {
      timeline?.destroy();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', width: '100%' }}
      aria-label="Interactive timeline — use scroll and drag to navigate"
    />
  );
}
