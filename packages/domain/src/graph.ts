export type GraphNodeType = "dispatch" | "pickup" | "location";

export interface GraphNode {
  readonly id: string;
  readonly nodeType: GraphNodeType;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly locationId: number | null;
}

export interface GraphEdge {
  readonly source: string;
  readonly target: string;
  readonly distanceM: number;
}

export interface GraphLayout {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export class GraphValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphValidationError";
  }
}

export function validateGraphLayout(layout: GraphLayout): void {
  if (layout.nodeCount !== layout.nodes.length) {
    throw new GraphValidationError(
      `Node count is ${layout.nodeCount}, but ${layout.nodes.length} nodes were provided.`,
    );
  }

  if (layout.edgeCount !== layout.edges.length) {
    throw new GraphValidationError(
      `Edge count is ${layout.edgeCount}, but ${layout.edges.length} edges were provided.`,
    );
  }

  const nodeIds = new Set<string>();

  for (const node of layout.nodes) {
    if (nodeIds.has(node.id)) {
      throw new GraphValidationError(`Duplicate node id: ${node.id}`);
    }

    nodeIds.add(node.id);
  }

  for (const edge of layout.edges) {
    if (!nodeIds.has(edge.source)) {
      throw new GraphValidationError(
        `Edge source does not exist: ${edge.source}`,
      );
    }

    if (!nodeIds.has(edge.target)) {
      throw new GraphValidationError(
        `Edge target does not exist: ${edge.target}`,
      );
    }
  }
}
