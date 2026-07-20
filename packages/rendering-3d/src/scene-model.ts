import type {
  Size3D,
  StorageHierarchy,
  WarehouseRackSummary,
} from "@warehouse/domain";

export interface Point3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface RackSceneOccupancy {
  readonly cartonCount: number;
  readonly productCount: number;
  readonly weightUtilizationPercent: number | null;
}

export interface RackSceneNode {
  readonly id: string;
  readonly aisleCode: string;
  readonly bayCode: string;
  readonly position: Point3D;
  readonly size: Size3D;
  readonly levelCount: number;
  readonly locationCount: number;
  readonly activeLocationCount: number;
  readonly occupancy: RackSceneOccupancy | null;
}

export interface WarehouseSceneBounds extends Size3D {}

export interface WarehouseSceneModel {
  readonly bounds: WarehouseSceneBounds;
  readonly racks: readonly RackSceneNode[];
}

export interface WarehouseSceneOptions {
  readonly rackWidth: number;
  readonly rackDepth: number;
  readonly levelHeight: number;
  readonly aisleGap: number;
  readonly bayGap: number;
  readonly outerMargin: number;
}

const DEFAULT_OPTIONS: WarehouseSceneOptions = {
  rackWidth: 2.4,
  rackDepth: 1.1,
  levelHeight: 0.75,
  aisleGap: 2.5,
  bayGap: 0.35,
  outerMargin: 1.5,
};

export class SceneModelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SceneModelValidationError";
  }
}

export function createWarehouseSceneModel(
  hierarchy: StorageHierarchy,
  summaries: readonly WarehouseRackSummary[] = [],
  optionOverrides: Partial<WarehouseSceneOptions> = {},
): WarehouseSceneModel {
  const options = { ...DEFAULT_OPTIONS, ...optionOverrides };
  validateOptions(options);

  const summariesByRack = new Map(
    summaries.map((summary) => [rackKey(summary.aisle, summary.bay), summary]),
  );
  const racks: RackSceneNode[] = [];
  let maximumBayCount = 0;
  let maximumHeight = 0;

  hierarchy.aisles.forEach((aisle, aisleIndex) => {
    maximumBayCount = Math.max(maximumBayCount, aisle.bays.length);

    aisle.bays.forEach((bay, bayIndex) => {
      const locations = bay.levels.flatMap((level) => level.locations);
      const levelCount = bay.levels.length;
      const height = Math.max(1, levelCount) * options.levelHeight;
      const summary = summariesByRack.get(rackKey(aisle.code, bay.code));

      maximumHeight = Math.max(maximumHeight, height);
      racks.push({
        id: `${aisle.code}/${bay.code}`,
        aisleCode: aisle.code,
        bayCode: bay.code,
        position: {
          x:
            options.outerMargin +
            options.rackWidth / 2 +
            aisleIndex * (options.rackWidth + options.aisleGap),
          y: height / 2,
          z:
            options.outerMargin +
            options.rackDepth / 2 +
            bayIndex * (options.rackDepth + options.bayGap),
        },
        size: {
          width: options.rackWidth,
          depth: options.rackDepth,
          height,
        },
        levelCount,
        locationCount: locations.length,
        activeLocationCount: locations.filter((location) => location.isActive)
          .length,
        occupancy:
          summary === undefined
            ? null
            : {
                cartonCount: summary.cartonCount,
                productCount: summary.productCount,
                weightUtilizationPercent: summary.weightUtilizationPercent,
              },
      });
    });
  });

  return {
    bounds: {
      width: calculateSpan(
        hierarchy.aisles.length,
        options.rackWidth,
        options.aisleGap,
        options.outerMargin,
      ),
      depth: calculateSpan(
        maximumBayCount,
        options.rackDepth,
        options.bayGap,
        options.outerMargin,
      ),
      height: maximumHeight,
    },
    racks,
  };
}

function calculateSpan(
  itemCount: number,
  itemSize: number,
  gap: number,
  outerMargin: number,
): number {
  if (itemCount === 0) return outerMargin * 2;
  return outerMargin * 2 + itemCount * itemSize + (itemCount - 1) * gap;
}

function rackKey(aisleCode: string, bayCode: string): string {
  return `${aisleCode.trim().toLocaleUpperCase("tr-TR")}/${bayCode.trim().toLocaleUpperCase("tr-TR")}`;
}

function validateOptions(options: WarehouseSceneOptions): void {
  for (const [name, value] of Object.entries(options)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new SceneModelValidationError(
        `Scene option ${name} must be positive and finite.`,
      );
    }
  }
}
