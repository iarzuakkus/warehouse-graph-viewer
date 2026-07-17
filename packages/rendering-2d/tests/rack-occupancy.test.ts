import { describe, expect, it } from "vitest";

import type { WarehouseRackSummary } from "@warehouse/domain";

import { getRackOccupancyState } from "../src/index.js";

function summary(
  changes: Partial<WarehouseRackSummary> = {},
): WarehouseRackSummary {
  return {
    aisle: "SYN-A001",
    bay: "B001",
    levelCount: 2,
    locationCount: 4,
    activeLocationCount: 4,
    cartonCount: 1,
    productCount: 1,
    totalMaxWeightKg: 4000,
    totalUsedWeightKg: 1000,
    weightUtilizationPercent: 25,
    ...changes,
  };
}

describe("getRackOccupancyState", () => {
  it("marks a rack without active locations as inactive", () => {
    expect(getRackOccupancyState(summary({ activeLocationCount: 0 }))).toBe(
      "inactive",
    );
  });

  it("marks an uncomputable utilization as unknown", () => {
    expect(
      getRackOccupancyState(summary({ weightUtilizationPercent: null })),
    ).toBe("unknown");
  });

  it("marks a rack without cartons as empty", () => {
    expect(getRackOccupancyState(summary({ cartonCount: 0 }))).toBe("empty");
  });

  it("marks utilization below eighty percent as partial", () => {
    expect(
      getRackOccupancyState(summary({ weightUtilizationPercent: 79.99 })),
    ).toBe("partial");
  });

  it("marks utilization from eighty percent as full", () => {
    expect(
      getRackOccupancyState(summary({ weightUtilizationPercent: 80 })),
    ).toBe("full");
  });
});
