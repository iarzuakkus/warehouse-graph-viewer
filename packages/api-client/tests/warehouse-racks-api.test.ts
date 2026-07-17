import { describe, expect, it, vi } from "vitest";

import {
  WarehouseRacksApiClient,
  mapWarehouseRackResponse,
  type FetchGraph,
} from "../src/index.js";

const rackResponse = {
  aisle: "SYN-A003",
  bay: "B001",
  level_count: 1,
  location_count: 1,
  active_location_count: 1,
  carton_count: 1,
  product_count: 1,
  total_max_weight_kg: "750.000",
  total_used_weight_kg: "437.500",
  weight_utilization_percent: "58.33",
  locations: [
    {
      id: 17,
      aisle: "SYN-A003",
      bay: "B001",
      level: "L01",
      slot: "S01",
      max_weight_kg: "750.000",
      used_weight_kg: "437.500",
      weight_utilization_percent: "58.33",
      distance_from_dispatch_m: "12.50",
      is_active: true,
      created_at: "2026-07-15T10:23:05.890279Z",
      updated_at: "2026-07-15T10:23:05.890279Z",
      cartons: [
        {
          id: 25,
          carton_number: "KOLI-00025",
          status: "available",
          capacity_qty: 500,
          current_qty: 350,
          reserved_qty: 25,
          available_qty: 325,
          expires_at: null,
          product: {
            id: 8,
            sku: "A003",
            name: "Somun M8",
            unit_weight_kg: "1.250",
          },
          packaging: {
            id: 4,
            units_per_carton: 500,
            carton_type_code: "KOLI-L",
          },
        },
      ],
    },
  ],
};

describe("mapWarehouseRackResponse", () => {
  it("maps rack utilization, cartons, products and packaging", () => {
    expect(mapWarehouseRackResponse(rackResponse)).toMatchObject({
      aisle: "SYN-A003",
      bay: "B001",
      levelCount: 1,
      cartonCount: 1,
      productCount: 1,
      totalUsedWeightKg: 437.5,
      weightUtilizationPercent: 58.33,
      locations: [{
        id: 17,
        usedWeightKg: 437.5,
        cartons: [{
          currentQty: 350,
          availableQty: 325,
          product: { sku: "A003", unitWeightKg: 1.25 },
          packaging: { cartonTypeCode: "KOLI-L" },
        }],
      }],
    });
  });

  it("accepts unknown weight and utilization values", () => {
    const mapped = mapWarehouseRackResponse({
      ...rackResponse,
      total_max_weight_kg: null,
      total_used_weight_kg: null,
      weight_utilization_percent: null,
      locations: [{
        ...rackResponse.locations[0],
        max_weight_kg: null,
        used_weight_kg: null,
        weight_utilization_percent: null,
      }],
    });

    expect(mapped.totalMaxWeightKg).toBeNull();
    expect(mapped.locations[0]?.weightUtilizationPercent).toBeNull();
  });

  it("rejects inconsistent carton quantities", () => {
    expect(() => mapWarehouseRackResponse({
      ...rackResponse,
      locations: [{
        ...rackResponse.locations[0],
        cartons: [{
          ...rackResponse.locations[0].cartons[0],
          available_qty: 999,
        }],
      }],
    })).toThrow("available_qty must equal");
  });

  it("rejects aggregate counts that do not match returned data", () => {
    expect(() => mapWarehouseRackResponse({
      ...rackResponse,
      carton_count: 2,
    })).toThrow("carton_count must match");
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
