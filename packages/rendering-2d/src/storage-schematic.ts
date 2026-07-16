import type { Point2D, StorageHierarchy } from "@warehouse/domain";

export interface StorageAisleLabel {
  readonly code: string;
  readonly centerX: number;
}

export interface StorageBayBlock {
  readonly aisleCode: string;
  readonly bayCode: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly locationCount: number;
  readonly activeLocationCount: number;
  readonly levelCount: number;
  readonly slotCount: number;
}

export interface StorageSchematic {
  readonly width: number;
  readonly depth: number;
  readonly aisleLabels: readonly StorageAisleLabel[];
  readonly bayBlocks: readonly StorageBayBlock[];
}

const OUTER_MARGIN = 2;
const LABEL_SPACE = 2;
const RACK_WIDTH = 6;
const BAY_DEPTH = 2.4;
const AISLE_GAP = 4;
const BAY_GAP = 0.6;

export function createStorageSchematic(
  hierarchy: StorageHierarchy,
): StorageSchematic {
  const aisleLabels: StorageAisleLabel[] = [];
  const bayBlocks: StorageBayBlock[] = [];
  let maximumBayCount = 0;

  hierarchy.aisles.forEach((aisle, aisleIndex) => {
    const x = OUTER_MARGIN + aisleIndex * (RACK_WIDTH + AISLE_GAP);
    aisleLabels.push({
      code: aisle.code,
      centerX: x + RACK_WIDTH / 2,
    });
    maximumBayCount = Math.max(maximumBayCount, aisle.bays.length);

    aisle.bays.forEach((bay, bayIndex) => {
      const locations = bay.levels.flatMap((level) => level.locations);
      const slotCodes = new Set(locations.map((location) => location.slot));

      bayBlocks.push({
        aisleCode: aisle.code,
        bayCode: bay.code,
        x,
        y: OUTER_MARGIN + LABEL_SPACE + bayIndex * (BAY_DEPTH + BAY_GAP),
        width: RACK_WIDTH,
        depth: BAY_DEPTH,
        locationCount: locations.length,
        activeLocationCount: locations.filter((location) => location.isActive)
          .length,
        levelCount: bay.levels.length,
        slotCount: slotCodes.size,
      });
    });
  });

  const aisleCount = Math.max(1, hierarchy.aisles.length);
  const bayCount = Math.max(1, maximumBayCount);

  return {
    width:
      OUTER_MARGIN * 2 +
      aisleCount * RACK_WIDTH +
      (aisleCount - 1) * AISLE_GAP,
    depth:
      OUTER_MARGIN * 2 +
      LABEL_SPACE +
      bayCount * BAY_DEPTH +
      (bayCount - 1) * BAY_GAP,
    aisleLabels,
    bayBlocks,
  };
}

export function findStorageBayAtPoint(
  schematic: StorageSchematic,
  point: Point2D,
): StorageBayBlock | null {
  return (
    schematic.bayBlocks.find(
      (block) =>
        point.x >= block.x &&
        point.x <= block.x + block.width &&
        point.y >= block.y &&
        point.y <= block.y + block.depth,
    ) ?? null
  );
}
