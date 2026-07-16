import { validateRack, type Rack } from "./rack.js";

export interface WarehouseMap {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly unit: "meter";
  readonly width: number;
  readonly depth: number;
  readonly racks: readonly Rack[];
}

export interface RackFootprint {
  readonly width: number;
  readonly depth: number;
}

export class WarehouseMapValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WarehouseMapValidationError";
  }
}

export function getRackFootprint(rack: Rack): RackFootprint {
  const swapsAxes = rack.rotation === 90 || rack.rotation === 270;

  return swapsAxes
    ? { width: rack.size.depth, depth: rack.size.width }
    : { width: rack.size.width, depth: rack.size.depth };
}

export function validateWarehouseMap(map: WarehouseMap): void {
  if (map.id.trim().length === 0) {
    throw new WarehouseMapValidationError("Warehouse map id cannot be empty.");
  }

  if (map.name.trim().length === 0) {
    throw new WarehouseMapValidationError("Warehouse map name cannot be empty.");
  }

  if (!Number.isInteger(map.version) || map.version <= 0) {
    throw new WarehouseMapValidationError(
      "Warehouse map version must be a positive integer.",
    );
  }

  if (
    !Number.isFinite(map.width) ||
    !Number.isFinite(map.depth) ||
    map.width <= 0 ||
    map.depth <= 0
  ) {
    throw new WarehouseMapValidationError(
      "Warehouse dimensions must be positive and finite.",
    );
  }

  const rackIds = new Set<string>();
  const assignedLocationIds = new Map<number, string>();

  for (const rack of map.racks) {
    validateRack(rack);

    if (rackIds.has(rack.id)) {
      throw new WarehouseMapValidationError(`Duplicate rack id: ${rack.id}`);
    }
    rackIds.add(rack.id);

    for (const locationId of rack.locationIds) {
      const assignedRackId = assignedLocationIds.get(locationId);
      if (assignedRackId !== undefined) {
        throw new WarehouseMapValidationError(
          `Location id ${locationId} is assigned to both ${assignedRackId} and ${rack.id}.`,
        );
      }
      assignedLocationIds.set(locationId, rack.id);
    }

    const footprint = getRackFootprint(rack);
    const outsideMap =
      rack.position.x < 0 ||
      rack.position.y < 0 ||
      rack.position.x + footprint.width > map.width ||
      rack.position.y + footprint.depth > map.depth;

    if (outsideMap) {
      throw new WarehouseMapValidationError(
        `Rack is outside warehouse boundaries: ${rack.id}`,
      );
    }
  }

  for (let firstIndex = 0; firstIndex < map.racks.length; firstIndex += 1) {
    const first = map.racks[firstIndex]!;
    const firstFootprint = getRackFootprint(first);

    for (
      let secondIndex = firstIndex + 1;
      secondIndex < map.racks.length;
      secondIndex += 1
    ) {
      const second = map.racks[secondIndex]!;
      const secondFootprint = getRackFootprint(second);

      const overlaps =
        first.position.x < second.position.x + secondFootprint.width &&
        first.position.x + firstFootprint.width > second.position.x &&
        first.position.y < second.position.y + secondFootprint.depth &&
        first.position.y + firstFootprint.depth > second.position.y;

      if (overlaps) {
        throw new WarehouseMapValidationError(
          `Racks overlap: ${first.id} and ${second.id}`,
        );
      }
    }
  }
}
