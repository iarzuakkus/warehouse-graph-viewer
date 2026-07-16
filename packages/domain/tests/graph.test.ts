import { describe, expect, it } from "vitest";

import {
  GraphValidationError,
  validateGraphLayout,
  type GraphLayout,
} from "../src/index.js";

function createValidLayout(): GraphLayout {
  return {
    nodeCount: 2,
    edgeCount: 1,
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
        id: "pickup:A001:B001",
        nodeType: "pickup",
        label: "A001-B001",
        x: 0,
        y: 3,
        locationId: null,
      },
    ],
    edges: [
      {
        source: "dispatch",
        target: "pickup:A001:B001",
        distanceM: 23,
      },
    ],
  };
}

describe("validateGraphLayout", () => {
  it("accepts a graph whose counts and references are correct", () => {
    expect(() => validateGraphLayout(createValidLayout())).not.toThrow();
  });

  it("rejects a node count that does not match the node array", () => {
    const layout = {
      ...createValidLayout(),
      nodeCount: 3,
    };

    expect(() => validateGraphLayout(layout)).toThrow(GraphValidationError);
    expect(() => validateGraphLayout(layout)).toThrow("Node count is 3");
  });

  it("rejects duplicate node ids", () => {
    const layout = createValidLayout();
    const duplicateLayout: GraphLayout = {
      ...layout,
      nodeCount: 3,
      nodes: [...layout.nodes, layout.nodes[0]!],
    };

    expect(() => validateGraphLayout(duplicateLayout)).toThrow(
      "Duplicate node id: dispatch",
    );
  });

  it("rejects an edge whose target node does not exist", () => {
    const layout = createValidLayout();
    const invalidLayout: GraphLayout = {
      ...layout,
      edges: [
        {
          source: "dispatch",
          target: "pickup:unknown",
          distanceM: 10,
        },
      ],
    };

    expect(() => validateGraphLayout(invalidLayout)).toThrow(
      "Edge target does not exist: pickup:unknown",
    );
  });
});
