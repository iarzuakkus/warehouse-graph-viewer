import { describe, expect, it } from "vitest";

import {
  StorageLocationValidationError,
  buildStorageHierarchy,
  type StorageLocation,
} from "../src/index.js";

function createLocation(
  overrides: Partial<StorageLocation> = {},
): StorageLocation {
  return {
    id: 1,
    aisle: "SYN-A001",
    bay: "B001",
    level: "L01",
    slot: "S01",
    maxWeightKg: 250,
    distanceFromDispatchM: 23,
    isActive: true,
    ...overrides,
  };
}

describe("buildStorageHierarchy", () => {
  it("groups and sorts locations by aisle, bay, level, and slot", () => {
    const hierarchy = buildStorageHierarchy([
      createLocation({ id: 4, aisle: "SYN-A002" }),
      createLocation({ id: 3, bay: "B002" }),
      createLocation({ id: 2, slot: "S02" }),
      createLocation(),
    ]);

    expect(hierarchy.locationCount).toBe(4);
    expect(hierarchy.aisles.map((aisle) => aisle.code)).toEqual([
      "SYN-A001",
      "SYN-A002",
    ]);
    expect(hierarchy.aisles[0]?.bays.map((bay) => bay.code)).toEqual([
      "B001",
      "B002",
    ]);
    expect(
      hierarchy.aisles[0]?.bays[0]?.levels[0]?.locations.map(
        (location) => location.slot,
      ),
    ).toEqual(["S01", "S02"]);
  });

  it("rejects duplicate database ids", () => {
    expect(() =>
      buildStorageHierarchy([
        createLocation(),
        createLocation({ slot: "S02" }),
      ]),
    ).toThrow("Duplicate storage location id: 1");
  });

  it("rejects duplicate physical coordinates", () => {
    expect(() =>
      buildStorageHierarchy([
        createLocation(),
        createLocation({ id: 2 }),
      ]),
    ).toThrow("Duplicate storage coordinates: SYN-A001/B001/L01/S01");
  });

  it("rejects invalid physical values", () => {
    const invalidLocation = createLocation({ maxWeightKg: -10 });

    expect(() => buildStorageHierarchy([invalidLocation])).toThrow(
      StorageLocationValidationError,
    );
  });
});
