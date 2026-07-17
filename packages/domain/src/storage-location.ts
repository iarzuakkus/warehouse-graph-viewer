export interface StorageLocation {
  readonly id: number;
  readonly aisle: string;
  readonly bay: string;
  readonly level: string;
  readonly slot: string;
  readonly maxWeightKg: number | null;
  readonly distanceFromDispatchM: number;
  readonly isActive: boolean;
}

export interface StorageLevel {
  readonly code: string;
  readonly locations: readonly StorageLocation[];
}

export interface StorageBay {
  readonly code: string;
  readonly levels: readonly StorageLevel[];
}

export interface StorageAisle {
  readonly code: string;
  readonly bays: readonly StorageBay[];
}

export interface StorageHierarchy {
  readonly aisles: readonly StorageAisle[];
  readonly locationCount: number;
}

export interface WarehouseRackDetail {
  readonly aisle: string;
  readonly bay: string;
  readonly locationCount: number;
  readonly activeLocationCount: number;
  readonly locations: readonly StorageLocation[];
}

export class StorageLocationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageLocationValidationError";
  }
}

export function buildStorageHierarchy(
  locations: readonly StorageLocation[],
): StorageHierarchy {
  const ids = new Set<number>();
  const coordinates = new Set<string>();
  const aisleMap = new Map<
    string,
    Map<string, Map<string, StorageLocation[]>>
  >();

  for (const location of locations) {
    validateStorageLocation(location);

    if (ids.has(location.id)) {
      throw new StorageLocationValidationError(
        `Duplicate storage location id: ${location.id}`,
      );
    }
    ids.add(location.id);

    const coordinateKey = [
      location.aisle,
      location.bay,
      location.level,
      location.slot,
    ].join("/");
    if (coordinates.has(coordinateKey)) {
      throw new StorageLocationValidationError(
        `Duplicate storage coordinates: ${coordinateKey}`,
      );
    }
    coordinates.add(coordinateKey);

    const bayMap = getOrCreate(aisleMap, location.aisle, () => new Map());
    const levelMap = getOrCreate(bayMap, location.bay, () => new Map());
    const levelLocations = getOrCreate(
      levelMap,
      location.level,
      (): StorageLocation[] => [],
    );
    levelLocations.push(location);
  }

  const aisles = [...aisleMap.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([aisleCode, bayMap]) => ({
      code: aisleCode,
      bays: [...bayMap.entries()]
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([bayCode, levelMap]) => ({
          code: bayCode,
          levels: [...levelMap.entries()]
            .sort(([first], [second]) => first.localeCompare(second))
            .map(([levelCode, levelLocations]) => ({
              code: levelCode,
              locations: [...levelLocations].sort((first, second) =>
                first.slot.localeCompare(second.slot),
              ),
            })),
        })),
    }));

  return {
    aisles,
    locationCount: locations.length,
  };
}

export function filterStorageHierarchy(
  hierarchy: StorageHierarchy,
  query: string,
): StorageHierarchy {
  const normalizedQuery = query.trim().toLocaleUpperCase("tr-TR");
  if (normalizedQuery.length === 0) return hierarchy;

  const aisles = hierarchy.aisles.filter((aisle) =>
    aisle.code.toLocaleUpperCase("tr-TR").includes(normalizedQuery),
  );
  const locationCount = aisles.reduce(
    (aisleTotal, aisle) =>
      aisleTotal +
      aisle.bays.reduce(
        (bayTotal, bay) =>
          bayTotal +
          bay.levels.reduce(
            (levelTotal, level) => levelTotal + level.locations.length,
            0,
          ),
        0,
      ),
    0,
  );

  return { aisles, locationCount };
}

function validateStorageLocation(location: StorageLocation): void {
  if (!Number.isInteger(location.id) || location.id <= 0) {
    throw new StorageLocationValidationError(
      `Storage location id must be a positive integer: ${location.id}`,
    );
  }

  const coordinates = [
    location.aisle,
    location.bay,
    location.level,
    location.slot,
  ];
  if (coordinates.some((value) => value.trim().length === 0)) {
    throw new StorageLocationValidationError(
      "Storage location coordinates cannot be empty.",
    );
  }

  if (
    location.maxWeightKg !== null &&
    (!Number.isFinite(location.maxWeightKg) || location.maxWeightKg <= 0)
  ) {
    throw new StorageLocationValidationError(
      "Maximum storage weight must be positive and finite or null.",
    );
  }

  if (
    !Number.isFinite(location.distanceFromDispatchM) ||
    location.distanceFromDispatchM < 0
  ) {
    throw new StorageLocationValidationError(
      "Dispatch distance must be non-negative and finite.",
    );
  }
}

function getOrCreate<Key, Value>(
  map: Map<Key, Value>,
  key: Key,
  create: () => Value,
): Value {
  const existing = map.get(key);
  if (existing !== undefined) return existing;

  const value = create();
  map.set(key, value);
  return value;
}
