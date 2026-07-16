import { describe, expect, it } from "vitest";

import {
  WarehouseMapValidationError,
  getRackFootprint,
  validateWarehouseMap,
  type Rack,
  type WarehouseMap,
} from "../src/index.js";

function createRack(overrides: Partial<Rack> = {}): Rack {
  return {
    id: "rack-1",
    name: "Raf 1",
    position: { x: 2, y: 2 },
    size: { width: 6, depth: 1, height: 3 },
    rotation: 0,
    locationIds: [101, 102],
    ...overrides,
  };
}

function createValidMap(overrides: Partial<WarehouseMap> = {}): WarehouseMap {
  return {
    id: "warehouse-1",
    name: "Ana Depo",
    version: 1,
    unit: "meter",
    width: 30,
    depth: 20,
    racks: [createRack()],
    ...overrides,
  };
}

describe("validateWarehouseMap", () => {
  it("accepts a valid warehouse map", () => {
    expect(() => validateWarehouseMap(createValidMap())).not.toThrow();
  });

  it("rejects non-positive warehouse dimensions", () => {
    const map = createValidMap({ width: 0 });

    expect(() => validateWarehouseMap(map)).toThrow(
      WarehouseMapValidationError,
    );
    expect(() => validateWarehouseMap(map)).toThrow(
      "Warehouse dimensions must be positive and finite.",
    );
  });

  it("rejects duplicate rack ids", () => {
    const map = createValidMap({
      racks: [
        createRack(),
        createRack({ position: { x: 12, y: 2 }, locationIds: [201] }),
      ],
    });

    expect(() => validateWarehouseMap(map)).toThrow(
      "Duplicate rack id: rack-1",
    );
  });

  it("rejects one API location assigned to different racks", () => {
    const map = createValidMap({
      racks: [
        createRack(),
        createRack({
          id: "rack-2",
          name: "Raf 2",
          position: { x: 12, y: 2 },
          locationIds: [102, 201],
        }),
      ],
    });

    expect(() => validateWarehouseMap(map)).toThrow(
      "Location id 102 is assigned to both rack-1 and rack-2.",
    );
  });

  it("uses rotated dimensions when checking warehouse boundaries", () => {
    const rotatedRack = createRack({
      position: { x: 28, y: 10 },
      rotation: 90,
    });
    const map = createValidMap({ racks: [rotatedRack] });

    expect(getRackFootprint(rotatedRack)).toEqual({ width: 1, depth: 6 });
    expect(() => validateWarehouseMap(map)).not.toThrow();

    const outsideMap = createValidMap({
      racks: [
        {
          ...rotatedRack,
          position: { x: 28, y: 15 },
        },
      ],
    });
    expect(() => validateWarehouseMap(outsideMap)).toThrow(
      "Rack is outside warehouse boundaries: rack-1",
    );
  });

  it("rejects overlapping racks but allows racks whose edges only touch", () => {
    const firstRack = createRack();
    const touchingRack = createRack({
      id: "rack-2",
      name: "Raf 2",
      position: { x: 8, y: 2 },
      locationIds: [201],
    });
    const touchingMap = createValidMap({
      racks: [firstRack, touchingRack],
    });

    expect(() => validateWarehouseMap(touchingMap)).not.toThrow();

    const overlappingMap = createValidMap({
      racks: [
        firstRack,
        {
          ...touchingRack,
          position: { x: 7.5, y: 2 },
        },
      ],
    });
    expect(() => validateWarehouseMap(overlappingMap)).toThrow(
      "Racks overlap: rack-1 and rack-2",
    );
  });
});
