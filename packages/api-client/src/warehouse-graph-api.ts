import {
  validateGraphLayout,
  type GraphEdge,
  type GraphLayout,
  type GraphNode,
  type GraphNodeType,
} from "@warehouse/domain";

interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type FetchGraph = (url: string) => Promise<HttpResponse>;

export class ApiContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiContractError";
  }
}

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Warehouse graph request failed with status ${status}.`);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export class WarehouseGraphApiClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetchGraph: FetchGraph,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getLayout(): Promise<GraphLayout> {
    const response = await this.fetchGraph(
      `${this.baseUrl}/warehouse-graph/layout?include_locations=true`,
    );

    if (!response.ok) {
      throw new ApiRequestError(response.status);
    }

    return mapGraphLayoutResponse(await response.json());
  }
}

export function mapGraphLayoutResponse(value: unknown): GraphLayout {
  const response = requireRecord(value, "Graph layout response");
  const nodes = requireArray(response.nodes, "nodes").map(mapGraphNode);
  const edges = requireArray(response.edges, "edges").map(mapGraphEdge);

  const layout: GraphLayout = {
    nodeCount: requireInteger(response.node_count, "node_count"),
    edgeCount: requireInteger(response.edge_count, "edge_count"),
    nodes,
    edges,
  };

  validateGraphLayout(layout);
  return layout;
}

function mapGraphNode(value: unknown, index: number): GraphNode {
  const node = requireRecord(value, `nodes[${index}]`);

  return {
    id: requireString(node.id, `nodes[${index}].id`),
    nodeType: requireNodeType(node.node_type, `nodes[${index}].node_type`),
    label: requireString(node.label, `nodes[${index}].label`),
    x: requireFiniteNumber(node.x, `nodes[${index}].x`),
    y: requireFiniteNumber(node.y, `nodes[${index}].y`),
    locationId: requireNullablePositiveInteger(
      node.location_id,
      `nodes[${index}].location_id`,
    ),
  };
}

function mapGraphEdge(value: unknown, index: number): GraphEdge {
  const edge = requireRecord(value, `edges[${index}]`);
  const distanceM = requireFiniteNumber(
    edge.distance_m,
    `edges[${index}].distance_m`,
  );

  if (distanceM <= 0) {
    throw new ApiContractError(
      `edges[${index}].distance_m must be greater than zero.`,
    );
  }

  return {
    source: requireString(edge.source, `edges[${index}].source`),
    target: requireString(edge.target, `edges[${index}].target`),
    distanceM,
  };
}

function requireRecord(
  value: unknown,
  fieldName: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiContractError(`${fieldName} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, fieldName: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new ApiContractError(`${fieldName} must be an array.`);
  }
  return value;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiContractError(`${fieldName} must be a non-empty string.`);
  }
  return value;
}

function requireFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ApiContractError(`${fieldName} must be a finite number.`);
  }
  return value;
}

function requireInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ApiContractError(`${fieldName} must be a non-negative integer.`);
  }
  return value;
}

function requireNullablePositiveInteger(
  value: unknown,
  fieldName: string,
): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ApiContractError(
      `${fieldName} must be a positive integer or null.`,
    );
  }
  return value;
}

function requireNodeType(value: unknown, fieldName: string): GraphNodeType {
  if (value === "dispatch" || value === "pickup" || value === "location") {
    return value;
  }
  throw new ApiContractError(
    `${fieldName} must be dispatch, pickup, or location.`,
  );
}
