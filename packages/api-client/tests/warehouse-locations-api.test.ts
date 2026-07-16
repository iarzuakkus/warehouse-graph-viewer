import { describe, expect, it, vi } from "vitest";

import {
  WarehouseLocationsApiClient,
  mapWarehouseLocationsResponse,
  type FetchGraph,
} from "../src/index.js";

function createApiLocation(id: number, slot: string): Record<string, unknown> {
  return {
    id,
    aisle: "SYN-A001",
    bay: "B001",
    level: "L01",
    slot,
    max_weight_kg: "250.000",
    distance_from_dispatch_m: "23.25",
    is_active: true,
  };
}

describe("mapWarehouseLocationsResponse", () => {
  it("maps decimal strings and snake_case fields", () => {
    const locations = mapWarehouseLocationsResponse([
      createApiLocation(1, "S01"),
    ]);

    expect(locations[0]).toMatchObject({
      id: 1,
      maxWeightKg: 250,
      distanceFromDispatchM: 23.25,
      isActive: true,
    });
  });

  it("rejects a response that is not an array", () => {
    expect(() => mapWarehouseLocationsResponse({ items: [] })).toThrow(
      "Warehouse locations response must be an array.",
    );
  });
});

describe("WarehouseLocationsApiClient", () => {
  it("loads every page until a short page is returned", async () => {
    const fetchLocations = vi
      .fn<FetchGraph>()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          createApiLocation(1, "S01"),
          createApiLocation(2, "S02"),
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [createApiLocation(3, "S03")],
      });
    const client = new WarehouseLocationsApiClient(
      "http://127.0.0.1:8000/",
      fetchLocations,
    );

    const locations = await client.getAllLocations(2);

    expect(locations).toHaveLength(3);
    expect(fetchLocations).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8000/warehouse-locations?offset=0&limit=2",
    );
    expect(fetchLocations).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8000/warehouse-locations?offset=2&limit=2",
    );
  });

  it("rejects a page size outside the API limit", async () => {
    const fetchLocations = vi.fn<FetchGraph>();
    const client = new WarehouseLocationsApiClient(
      "http://127.0.0.1:8000",
      fetchLocations,
    );

    await expect(client.getAllLocations(101)).rejects.toThrow(
      "Location page size must be between 1 and 100.",
    );
  });
});
