import { describe, expect, it, vi } from "vitest";

import {
  WarehouseRacksApiClient,
  mapWarehouseRackResponse,
  type FetchGraph,
} from "../src/index.js";

const rackResponse = {
  aisle: "A003",
  bay: "B001",
  location_count: 1,
  active_location_count: 1,
  locations: [
    {
      id: 17,
      aisle: "A003",
      bay: "B001",
      level: "L01",
      slot: "S01",
      max_weight_kg: "750.000",
      distance_from_dispatch_m: "12.50",
      is_active: true,
    },
  ],
};

describe("mapWarehouseRackResponse", () => {
  it("maps a rack and its locations", () => {
    expect(mapWarehouseRackResponse(rackResponse)).toMatchObject({
      aisle: "A003",
      bay: "B001",
      locationCount: 1,
      activeLocationCount: 1,
      locations: [{ id: 17, maxWeightKg: 750 }],
    });
  });

  it("rejects a location count mismatch", () => {
    expect(() => mapWarehouseRackResponse({
      ...rackResponse,
      location_count: 2,
    })).toThrow("location_count must match");
  });
});

describe("WarehouseRacksApiClient", () => {
  it("requests the selected rack with encoded coordinates", async () => {
    const fetchRack = vi.fn<FetchGraph>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => rackResponse,
    });
    const client = new WarehouseRacksApiClient("/api/", fetchRack);

    await client.getRackDetail("SYN A003", "B/001");

    expect(fetchRack).toHaveBeenCalledWith(
      "/api/warehouse-racks/SYN%20A003/B%2F001",
    );
  });
});
