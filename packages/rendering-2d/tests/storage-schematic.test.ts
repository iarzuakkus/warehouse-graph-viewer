import { describe, expect, it } from "vitest";

import {
  buildStorageHierarchy,
  type StorageLocation,
} from "@warehouse/domain";

import {
  createStorageSchematic,
  findStorageBayAtPoint,
} from "../src/index.js";

function createLocation(
  id: number,
  aisle: string,
  bay: string,
  level: string,
  slot: string,
  isActive = true,
): StorageLocation {
  return {
    id,
    aisle,
    bay,
    level,
    slot,
    maxWeightKg: null,
    distanceFromDispatchM: 0,
    isActive,
  };
}

describe("createStorageSchematic", () => {
  it("creates one visual block for each aisle and bay pair", () => {
    const hierarchy = buildStorageHierarchy([
      createLocation(1, "A001", "B001", "L01", "S01"),
      createLocation(2, "A001", "B002", "L01", "S01"),
      createLocation(3, "A002", "B001", "L01", "S01"),
    ]);

    const schematic = createStorageSchematic(hierarchy);

    expect(schematic.aisleLabels).toHaveLength(2);
    expect(schematic.bayBlocks).toHaveLength(3);
  });

  it("places different aisles with a visible corridor gap", () => {
    const hierarchy = buildStorageHierarchy([
      createLocation(1, "A001", "B001", "L01", "S01"),
      createLocation(2, "A002", "B001", "L01", "S01"),
    ]);

    const schematic = createStorageSchematic(hierarchy);
    const first = schematic.bayBlocks[0]!;
    const second = schematic.bayBlocks[1]!;

    expect(second.x).toBeGreaterThan(first.x + first.width);
  });

  it("summarizes level, slot, and active location counts", () => {
    const hierarchy = buildStorageHierarchy([
      createLocation(1, "A001", "B001", "L01", "S01"),
      createLocation(2, "A001", "B001", "L01", "S02", false),
      createLocation(3, "A001", "B001", "L02", "S01"),
      createLocation(4, "A001", "B001", "L02", "S02"),
    ]);

    const block = createStorageSchematic(hierarchy).bayBlocks[0]!;

    expect(block).toMatchObject({
      locationCount: 4,
      activeLocationCount: 3,
      levelCount: 2,
      slotCount: 2,
    });
  });

  it("creates a drawable area for an empty hierarchy", () => {
    const schematic = createStorageSchematic({
      aisles: [],
      locationCount: 0,
    });

    expect(schematic.width).toBeGreaterThan(0);
    expect(schematic.depth).toBeGreaterThan(0);
    expect(schematic.bayBlocks).toEqual([]);
  });

  it("finds a bay block at a schematic point", () => {
    const hierarchy = buildStorageHierarchy([
      createLocation(1, "A001", "B001", "L01", "S01"),
    ]);
    const schematic = createStorageSchematic(hierarchy);
    const block = schematic.bayBlocks[0]!;

    expect(
      findStorageBayAtPoint(schematic, {
        x: block.x + block.width / 2,
        y: block.y + block.depth / 2,
      }),
    ).toMatchObject({ aisleCode: "A001", bayCode: "B001" });
  });

  it("returns null outside every bay block", () => {
    const hierarchy = buildStorageHierarchy([
      createLocation(1, "A001", "B001", "L01", "S01"),
    ]);
    const schematic = createStorageSchematic(hierarchy);

    expect(findStorageBayAtPoint(schematic, { x: 0, y: 0 })).toBeNull();
  });
});
