import { describe, expect, it } from "vitest";

import {
  RackValidationError,
  validateRack,
  type Rack,
} from "../src/index.js";

function createValidRack(): Rack {
  return {
    id: "rack-1",
    name: "Raf 1",
    position: {
      x: 10,
      y: 5,
    },
    size: {
      width: 8,
      depth: 1.2,
      height: 3,
    },
    rotation: 0,
    locationIds: [101, 102, 103],
  };
}

describe("validateRack", () => {
  it("accepts a rack with valid geometry and location mappings", () => {
    expect(() => validateRack(createValidRack())).not.toThrow();
  });

  it("rejects a rack whose dimensions are not positive", () => {
    const rack: Rack = {
      ...createValidRack(),
      size: {
        width: 0,
        depth: 1.2,
        height: 3,
      },
    };

    expect(() => validateRack(rack)).toThrow(RackValidationError);
    expect(() => validateRack(rack)).toThrow(
      "Rack dimensions must be positive and finite.",
    );
  });

  it("rejects a rotation that is not a right angle", () => {
    const rack = {
      ...createValidRack(),
      rotation: 45,
    } as unknown as Rack;

    expect(() => validateRack(rack)).toThrow(
      "Rack rotation must be 0, 90, 180, or 270.",
    );
  });

  it("rejects a location id mapped to the same rack more than once", () => {
    const rack: Rack = {
      ...createValidRack(),
      locationIds: [101, 102, 101],
    };

    expect(() => validateRack(rack)).toThrow("Duplicate location id: 101");
  });
});
