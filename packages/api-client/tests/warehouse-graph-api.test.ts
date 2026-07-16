import { describe, expect, it, vi } from "vitest";

import {
  ApiContractError,
  ApiRequestError,
  WarehouseGraphApiClient,
  mapGraphLayoutResponse,
  type FetchGraph,
} from "../src/index.js";

function createApiResponse(): unknown {
  return {
    node_count: 2,
    edge_count: 1,
    nodes: [
      {
        id: "dispatch",
        node_type: "dispatch",
        label: "Sevkiyat",
        x: -20,
        y: 0,
        location_id: null,
      },
      {
        id: "location:A001:B001:L01:S01",
        node_type: "location",
        label: "A001-B001-L01-S01",
        x: 0,
        y: 3,
        location_id: 101,
      },
    ],
    edges: [
      {
        source: "dispatch",
        target: "location:A001:B001:L01:S01",
        distance_m: 23.25,
      },
    ],
  };
}

describe("mapGraphLayoutResponse", () => {
  it("maps API snake_case fields to domain camelCase fields", () => {
    const layout = mapGraphLayoutResponse(createApiResponse());

    expect(layout.nodeCount).toBe(2);
    expect(layout.nodes[1]).toMatchObject({
      nodeType: "location",
      locationId: 101,
    });
    expect(layout.edges[0]?.distanceM).toBe(23.25);
  });

  it("rejects an unknown node type", () => {
    const response = createApiResponse() as {
      nodes: Array<Record<string, unknown>>;
    };
    response.nodes[0]!.node_type = "shelf";

    expect(() => mapGraphLayoutResponse(response)).toThrow(ApiContractError);
    expect(() => mapGraphLayoutResponse(response)).toThrow(
      "nodes[0].node_type must be dispatch, pickup, or location.",
    );
  });

  it("rejects an edge that references a missing node", () => {
    const response = createApiResponse() as {
      edges: Array<Record<string, unknown>>;
    };
    response.edges[0]!.target = "location:unknown";

    expect(() => mapGraphLayoutResponse(response)).toThrow(
      "Edge target does not exist: location:unknown",
    );
  });
});

describe("WarehouseGraphApiClient", () => {
  it("requests the detailed layout and returns the mapped graph", async () => {
    const fetchGraph = vi.fn<FetchGraph>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => createApiResponse(),
    });
    const client = new WarehouseGraphApiClient(
      "http://127.0.0.1:8000/",
      fetchGraph,
    );

    const layout = await client.getLayout();

    expect(fetchGraph).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/warehouse-graph/layout?include_locations=true",
    );
    expect(layout.nodeCount).toBe(2);
  });

  it("reports an unsuccessful HTTP status", async () => {
    const fetchGraph = vi.fn<FetchGraph>().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ detail: "Invalid graph" }),
    });
    const client = new WarehouseGraphApiClient(
      "http://127.0.0.1:8000",
      fetchGraph,
    );

    await expect(client.getLayout()).rejects.toBeInstanceOf(ApiRequestError);
    await expect(client.getLayout()).rejects.toMatchObject({ status: 409 });
  });
});
