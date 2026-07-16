import {
  getRackFootprint,
  type Point2D,
  type Rack,
} from "@warehouse/domain";

export interface ViewportTransform {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly worldOriginX: number;
  readonly worldOriginY: number;
}

export interface ScreenRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export class ViewportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ViewportValidationError";
  }
}

export function createViewportTransform(
  worldWidth: number,
  worldDepth: number,
  screenWidth: number,
  screenHeight: number,
  padding: number,
): ViewportTransform {
  const dimensions = [worldWidth, worldDepth, screenWidth, screenHeight];
  if (dimensions.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new ViewportValidationError(
      "World and screen dimensions must be positive and finite.",
    );
  }

  if (!Number.isFinite(padding) || padding < 0) {
    throw new ViewportValidationError(
      "Viewport padding must be non-negative and finite.",
    );
  }

  const availableWidth = screenWidth - padding * 2;
  const availableHeight = screenHeight - padding * 2;
  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new ViewportValidationError(
      "Viewport padding leaves no drawable screen area.",
    );
  }

  const scale = Math.min(
    availableWidth / worldWidth,
    availableHeight / worldDepth,
  );

  return {
    scale,
    offsetX: (screenWidth - worldWidth * scale) / 2,
    offsetY: (screenHeight - worldDepth * scale) / 2,
    worldOriginX: 0,
    worldOriginY: 0,
  };
}

export function worldToScreen(
  point: Point2D,
  transform: ViewportTransform,
): Point2D {
  return {
    x:
      transform.offsetX +
      (point.x - transform.worldOriginX) * transform.scale,
    y:
      transform.offsetY +
      (point.y - transform.worldOriginY) * transform.scale,
  };
}

export function screenToWorld(
  point: Point2D,
  transform: ViewportTransform,
): Point2D {
  return {
    x:
      (point.x - transform.offsetX) / transform.scale +
      transform.worldOriginX,
    y:
      (point.y - transform.offsetY) / transform.scale +
      transform.worldOriginY,
  };
}

export function rackToScreenRect(
  rack: Rack,
  transform: ViewportTransform,
): ScreenRect {
  const position = worldToScreen(rack.position, transform);
  const footprint = getRackFootprint(rack);

  return {
    x: position.x,
    y: position.y,
    width: footprint.width * transform.scale,
    height: footprint.depth * transform.scale,
  };
}
