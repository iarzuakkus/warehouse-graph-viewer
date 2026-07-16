export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface Size3D {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

export type RightAngleRotation = 0 | 90 | 180 | 270;

export interface Rack {
  readonly id: string;
  readonly name: string;
  readonly position: Point2D;
  readonly size: Size3D;
  readonly rotation: RightAngleRotation;
  readonly locationIds: readonly number[];
}

export class RackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RackValidationError";
  }
}

export function validateRack(rack: Rack): void {
  if (rack.id.trim().length === 0) {
    throw new RackValidationError("Rack id cannot be empty.");
  }

  if (rack.name.trim().length === 0) {
    throw new RackValidationError("Rack name cannot be empty.");
  }

  if (!Number.isFinite(rack.position.x) || !Number.isFinite(rack.position.y)) {
    throw new RackValidationError("Rack position must be finite.");
  }

  const dimensions = [rack.size.width, rack.size.depth, rack.size.height];
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new RackValidationError("Rack dimensions must be positive and finite.");
  }

  const allowedRotations: readonly number[] = [0, 90, 180, 270];
  if (!allowedRotations.includes(rack.rotation)) {
    throw new RackValidationError("Rack rotation must be 0, 90, 180, or 270.");
  }

  const uniqueLocationIds = new Set<number>();
  for (const locationId of rack.locationIds) {
    if (!Number.isInteger(locationId) || locationId <= 0) {
      throw new RackValidationError(
        `Location id must be a positive integer: ${locationId}`,
      );
    }

    if (uniqueLocationIds.has(locationId)) {
      throw new RackValidationError(`Duplicate location id: ${locationId}`);
    }

    uniqueLocationIds.add(locationId);
  }
}
