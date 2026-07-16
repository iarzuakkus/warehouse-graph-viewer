import { describe, expect, it } from "vitest";

import type { GraphLayout } from "@warehouse/domain";

import {
  GraphBoundsError,
  createGraphViewportTransform,
  getGraphBounds,
  worldToScreen,
} from "../src/index.js";

function createGraph(): GraphLayout {
  return {
    nodeCount: 3,
    edgeCount: 2,
    nodes: [
      {
        id: "dispatch",
        nodeType: "dispatch",
        label: "Sevkiyat",
        x: -20,
        y: 0,
        locationId: null,
      },
      {
        id: "pickup-1",
        nodeType: "pickup",
        label: "A001-B001",
        x: 0,
        y: 3,
        locationId: null,
      },
      {
        id: "pickup-2",
        nodeType: "pickup",
        label: "A002-B001",
        x: 20,
        y: 3,
        locationId: null,
      },
    ],
    edges: [
      { source: "dispatch", target: "pickup-1", distanceM: 23 },
      { source: "pickup-1", target: "pickup-2", distanceM: 20 },
    ],
  };
}

describe("graph viewport calculations", () => {
  it("includes negative dispatch coordinates in graph bounds", () => {
    expect(getGraphBounds(createGraph(), 2)).toEqual({
      minX: -22,
      minY: -2,
      maxX: 22,
      maxY: 5,
    });
  });

  it("maps every graph boundary into the drawable screen area", () => {
    const bounds = getGraphBounds(createGraph(), 2);
    const transform = createGraphViewportTransform(bounds, 1000, 600, 40);
    const topLeft = worldToScreen(
      { x: bounds.minX, y: bounds.minY },
      transform,
    );
    const bottomRight = worldToScreen(
      { x: bounds.maxX, y: bounds.maxY },
      transform,
    );

    expect(topLeft.x).toBeGreaterThanOrEqual(40);
    expect(topLeft.y).toBeGreaterThanOrEqual(40);
    expect(bottomRight.x).toBeLessThanOrEqual(960);
    expect(bottomRight.y).toBeLessThanOrEqual(560);
  });

  it("rejects an empty graph", () => {
    const emptyGraph: GraphLayout = {
      nodeCount: 0,
      edgeCount: 0,
      nodes: [],
      edges: [],
    };

    expect(() => getGraphBounds(emptyGraph)).toThrow(GraphBoundsError);
  });
});
