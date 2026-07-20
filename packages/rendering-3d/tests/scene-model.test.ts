import { describe, expect, it } from "vitest";

import {
  buildStorageHierarchy,
  type StorageLocation,
  type WarehouseRackSummary,
} from "@warehouse/domain";

import {
  SceneModelValidationError,
  createWarehouseSceneModel,
} from "../src/index.js";

function createLocation(
  id: number,
  aisle: string,
  bay: string,
  level: string,
  isActive = true,
): StorageLocation {
  return {
    id,
    aisle,
    bay,
    level,
    slot: "S01",
    maxWeightKg: 1_000,
    distanceFromDispatchM: 0,
    isActive,
  };
}

function createSummary(
  overrides: Partial<WarehouseRackSummary> = {},
): WarehouseRackSummary {
  return {
    aisle: "SYN-A001",
    bay: "B001",
    levelCount: 1,
    locationCount: 1,
    activeLocationCount: 1,
    cartonCount: 3,
    productCount: 2,
    totalMaxWeightKg: 1_000,
    totalUsedWeightKg: 470,
    weightUtilizationPercent: 47,
    ...overrides,
  };
}

describe("createWarehouseSceneModel", () => {
  it("creates one 3D scene node for each rack", () => {
    const hierarchy = buildStorageHierarchy([
      createLocation(1, "SYN-A001", "B001", "L01"),
      createLocation(2, "SYN-A001", "B002", "L01"),
      createLocation(3, "SYN-A002", "B001", "L01"),
    ]);

    const scene = createWarehouseSceneModel(hierarchy);

    expect(scene.racks).toHaveLength(3);
    expect(scene.racks.map((rack) => rack.id)).toEqual([
      "SYN-A001/B001",
      "SYN-A001/B002",
      "SYN-A002/B001",
    ]);
  });

  it("places aisles on x and bays on z with visible gaps", () => {
    const hierarchy = buildStorageHierarchy([
      createLocation(1, "SYN-A001", "B001", "L01"),
      createLocation(2, "SYN-A001", "B002", "L01"),
      createLocation(3, "SYN-A002", "B001", "L01"),
    ]);

    const [first, secondBay, secondAisle] =
      createWarehouseSceneModel(hierarchy).racks;

    expect(secondBay!.position.z).toBeGreaterThan(
      first!.position.z + first!.size.depth,
    );
    expect(secondAisle!.position.x).toBeGreaterThan(
      first!.position.x + first!.size.width,
    );
  });

  it("calculates rack height from its level count", () => {
    const hierarchy = buildStorageHierarchy([
      createLocation(1, "SYN-A001", "B001", "L01"),
      createLocation(2, "SYN-A001", "B001", "L02"),
    ]);

    const rack = createWarehouseSceneModel(hierarchy, [], {
      levelHeight: 1.2,
    }).racks[0]!;

    expect(rack.levelCount).toBe(2);
    expect(rack.size.height).toBe(2.4);
    expect(rack.position.y).toBe(1.2);
  });

  it("adds occupancy data without changing warehouse geometry", () => {
    const hierarchy = buildStorageHierarchy([
      createLocation(1, "SYN-A001", "B001", "L01"),
    ]);

    const rack = createWarehouseSceneModel(hierarchy, [
      createSummary({ aisle: "syn-a001", bay: "b001" }),
    ]).racks[0]!;

    expect(rack.occupancy).toEqual({
      cartonCount: 3,
      productCount: 2,
      weightUtilizationPercent: 47,
    });
  });

  it("keeps racks usable when a summary is unavailable", () => {
    const hierarchy = buildStorageHierarchy([
      createLocation(1, "SYN-A001", "B001", "L01", false),
    ]);

    const rack = createWarehouseSceneModel(hierarchy).racks[0]!;

    expect(rack.occupancy).toBeNull();
    expect(rack.activeLocationCount).toBe(0);
    expect(rack.locationCount).toBe(1);
  });

  it("creates finite floor bounds for an empty warehouse", () => {
    const scene = createWarehouseSceneModel({ aisles: [], locationCount: 0 });

    expect(scene.racks).toEqual([]);
    expect(scene.bounds).toEqual({ width: 3, depth: 3, height: 0 });
  });

  it("rejects invalid scene dimensions", () => {
    expect(() =>
      createWarehouseSceneModel({ aisles: [], locationCount: 0 }, [], {
        rackWidth: 0,
      }),
    ).toThrow(SceneModelValidationError);
  });
});
