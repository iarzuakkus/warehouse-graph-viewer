import type { GraphLayout } from "@warehouse/domain";

import {
  createViewportTransform,
  type ViewportTransform,
} from "./viewport.js";

export interface WorldBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export class GraphBoundsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphBoundsError";
  }
}

export function getGraphBounds(
  graph: GraphLayout,
  marginMeters = 2,
): WorldBounds {
  if (graph.nodes.length === 0) {
    throw new GraphBoundsError("Graph must contain at least one node.");
  }

  if (!Number.isFinite(marginMeters) || marginMeters < 0) {
    throw new GraphBoundsError(
      "Graph margin must be non-negative and finite.",
    );
  }

  const xValues = graph.nodes.map((node) => node.x);
  const yValues = graph.nodes.map((node) => node.y);
  let minX = Math.min(...xValues);
  let maxX = Math.max(...xValues);
  let minY = Math.min(...yValues);
  let maxY = Math.max(...yValues);

  if (minX === maxX) {
    minX -= 0.5;
    maxX += 0.5;
  }
  if (minY === maxY) {
    minY -= 0.5;
    maxY += 0.5;
  }

  return {
    minX: minX - marginMeters,
    minY: minY - marginMeters,
    maxX: maxX + marginMeters,
    maxY: maxY + marginMeters,
  };
}

export function createGraphViewportTransform(
  bounds: WorldBounds,
  screenWidth: number,
  screenHeight: number,
  padding: number,
): ViewportTransform {
  const worldWidth = bounds.maxX - bounds.minX;
  const worldDepth = bounds.maxY - bounds.minY;

  if (worldWidth <= 0 || worldDepth <= 0) {
    throw new GraphBoundsError("Graph bounds must have a positive area.");
  }

  return {
    ...createViewportTransform(
      worldWidth,
      worldDepth,
      screenWidth,
      screenHeight,
      padding,
    ),
    worldOriginX: bounds.minX,
    worldOriginY: bounds.minY,
  };
}
