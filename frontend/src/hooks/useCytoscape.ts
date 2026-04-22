import { useRef, useEffect, useCallback } from 'react';
import cytoscape, { type Core } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import type { Meeseeks } from '../types';
import { useHiveStore, type RaceInfo } from '../stores/hive.store';
import { meeseeksName } from '../utils/nameUtils';

cytoscape.use(fcose);

function stressColor(stress: number): string {
  if (stress < 0.2) return '#22d3ee';
  if (stress < 0.4) return '#facc15';
  if (stress < 0.6) return '#fb923c';
  if (stress < 0.8) return '#ef4444';
  return '#dc2626';
}

function statusColor(status: string, stress: number, lostRace: boolean, deathReason?: string | null): string {
  if (status === 'dead' || status === 'dying') {
    if (lostRace) return '#dc2626';
    if (deathReason?.includes('WON')) return '#22c55e';
    if (status === 'dying') return '#f97316';
    return '#6b7280';
  }
  return stressColor(stress);
}

export function useCytoscape(containerRef: React.RefObject<HTMLDivElement | null>) {
  const cyRef = useRef<Core | null>(null);
  const meeseeks = useHiveStore((s) => s.meeseeks);
  const races = useHiveStore((s) => s.races);
  const memoryInjected = useHiveStore((s) => s.memoryInjected);
  const memoryChain = useHiveStore((s) => s.memoryChain);
  const setSelected = useHiveStore((s) => s.setSelected);

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'background-color': 'data(color)',
            'color': '#e5e7eb',
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'font-size': '10px',
            'width': 'data(size)',
            'height': 'data(size)',
            'border-width': 2,
            'border-color': 'data(borderColor)',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#22d3ee',
            'border-width': 3,
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 1,
            'line-color': '#4b5563',
            'target-arrow-color': '#4b5563',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'edge.inheritance',
          style: {
            'width': 2,
            'line-color': '#f59e0b',
            'target-arrow-color': '#f59e0b',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'line-style': 'dashed',
            'line-dash-pattern': [6, 3] as any,
            'label': '💡',
            'font-size': '14px',
            'text-rotation': 'autorotate',
            'color': '#f59e0b',
            'text-background-color': '#111827',
            'text-background-opacity': 0.85,
            'text-background-padding': 2 as any,
          },
        },
        {
          selector: 'edge.spawn',
          style: {
            'width': 1.5,
            'line-color': '#22d3ee',
            'target-arrow-color': '#22d3ee',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'line-style': 'solid',
            'label': '🆘',
            'font-size': '11px',
            'color': '#22d3ee',
            'text-background-color': '#111827',
            'text-background-opacity': 0.8,
            'text-background-padding': 2 as any,
          },
        },
        {
          selector: 'edge.race',
          style: {
            'width': 2,
            'line-color': '#f97316',
            'line-style': 'dashed',
            'target-arrow-shape': 'none',
            'label': 'VS',
            'font-size': '12px',
            'color': '#f97316',
            'text-background-color': '#111827',
            'text-background-opacity': 0.8,
            'text-background-padding': 4 as any,
          },
        },
        {
          selector: 'node[status="dying"]',
          style: {
            'border-style': 'dashed',
          },
        },
        {
          selector: 'node[status="dead"]',
          style: {
            'opacity': 0.5,
          },
        },
        {
          selector: 'node[?winner]',
          style: {
            'border-color': '#22c55e',
            'border-width': 4,
          },
        },
      ],
      layout: { name: 'fcose', animate: true, animationDuration: 500, nodeSeparation: 120 } as cytoscape.LayoutOptions,
      minZoom: 0.3,
      maxZoom: 3,
    });

    cy.on('tap', 'node', (evt) => {
      setSelected(evt.target.id());
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelected(null);
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [containerRef, setSelected]);

  const syncNodes = useCallback((data: Map<string, Meeseeks>, raceData: Map<string, RaceInfo>) => {
    const cy = cyRef.current;
    if (!cy) return;

    const existingIds = new Set(cy.nodes().map((n) => n.id()));
    const newIds = new Set(data.keys());

    for (const id of existingIds) {
      if (!newIds.has(id)) {
        cy.getElementById(id).remove();
      }
    }

    let needsLayout = false;

    for (const [id, m] of data) {
      const color = statusColor(m.status, m.stress, m.lost_race, m.death_reason);
      const size = 30 + m.stress * 30;
      const name = meeseeksName(id);
      const stressPct = Math.round(m.stress * 100);
      const stratTag = m.strategy?.includes('FAST') ? '⚡' : m.strategy?.includes('THOROUGH') ? '🔬' : '';
      const resultTag = m.lost_race ? '💀' : m.death_reason?.includes('WON') ? '🏆' : '';
      const inheritTag = memoryInjected.has(id) ? '💡' : '';
      const tag = resultTag || stratTag;
      const label = `${inheritTag}${tag}${name}\n${stressPct}%`;

      if (existingIds.has(id)) {
        const node = cy.getElementById(id);
        node.data('color', color);
        node.data('size', size);
        node.data('status', m.status);
        node.data('label', label);
        node.data('borderColor', m.role === 'manager' ? '#a855f7' : color);
      } else {
        cy.add({
          data: {
            id,
            label,
            color,
            size,
            status: m.status,
            borderColor: m.role === 'manager' ? '#a855f7' : color,
          },
        });
        needsLayout = true;
      }
    }

    // Parent → child spawn edges (cyan, solid)
    for (const [id, m] of data) {
      if (m.parent_id && data.has(m.parent_id)) {
        const edgeId = `edge-${m.parent_id}-${id}`;
        if (!cy.getElementById(edgeId).length) {
          cy.add({
            data: { id: edgeId, source: m.parent_id, target: id },
            classes: 'spawn',
          });
        }
      }
    }

    // Memory chain edges (amber dashed, aprendizaje entre agentes)
    for (const [learnerId, sourceId] of memoryChain) {
      if (data.has(learnerId) && data.has(sourceId)) {
        const edgeId = `memory-${sourceId}-${learnerId}`;
        if (!cy.getElementById(edgeId).length) {
          cy.add({
            data: { id: edgeId, source: sourceId, target: learnerId },
            classes: 'inheritance',
          });
          needsLayout = true;
        }
      }
    }

    // Race edges
    for (const [, race] of raceData) {
      if (race.competitors.length >= 2) {
        const edgeId = `race-${race.competitors[0]}-${race.competitors[1]}`;
        if (!cy.getElementById(edgeId).length && data.has(race.competitors[0]!) && data.has(race.competitors[1]!)) {
          cy.add({
            data: {
              id: edgeId,
              source: race.competitors[0],
              target: race.competitors[1],
            },
            classes: 'race',
          });
          needsLayout = true;
        }

        if (race.winnerId) {
          const winnerNode = cy.getElementById(race.winnerId);
          if (winnerNode.length) winnerNode.data('winner', true);
        }
      }
    }

    if (needsLayout) {
      cy.layout({ name: 'fcose', animate: true, animationDuration: 300 } as cytoscape.LayoutOptions).run();
    }
  }, [memoryInjected, memoryChain]);

  useEffect(() => {
    syncNodes(meeseeks, races);
  }, [meeseeks, races, memoryInjected, memoryChain, syncNodes]);

  return cyRef;
}
