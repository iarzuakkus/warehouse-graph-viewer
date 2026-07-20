import type {
  WarehouseCartonStatus,
  WarehouseRackCarton,
  WarehouseRackDetail,
  WarehouseRackLocationDetail,
  WarehouseRackScene,
  WarehouseRackSceneCarton,
  WarehouseRackSceneLocation,
  WarehouseRackSummary,
} from "@warehouse/domain";

import {
  ApiContractError,
  ApiRequestError,
  type FetchGraph,
} from "./warehouse-graph-api.js";
import { mapWarehouseLocationsResponse } from "./warehouse-locations-api.js";

export class WarehouseRacksApiClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetchRack: FetchGraph,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getRackDetail(aisle: string, bay: string): Promise<WarehouseRackDetail> {
    const response = await this.fetchRack(
      `${this.baseUrl}/warehouse-racks/${encodeURIComponent(aisle)}/${encodeURIComponent(bay)}`,
    );
    if (!response.ok) throw new ApiRequestError(response.status);

    return mapWarehouseRackResponse(await response.json());
  }

  async getAllRackSummaries(
    pageSize = 100,
  ): Promise<readonly WarehouseRackSummary[]> {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new RangeError("Rack summary page size must be between 1 and 100.");
    }

    const summaries: WarehouseRackSummary[] = [];
    let offset = 0;
    while (true) {
      const response = await this.fetchRack(
        `${this.baseUrl}/warehouse-racks?offset=${offset}&limit=${pageSize}`,
      );
      if (!response.ok) throw new ApiRequestError(response.status);

      const page = mapWarehouseRackSummariesResponse(await response.json());
      summaries.push(...page);
      if (page.length < pageSize) return summaries;
      offset += pageSize;
    }
  }

  async getWarehouseScene(
    pageSize = 100,
  ): Promise<readonly WarehouseRackScene[]> {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new RangeError("Rack scene page size must be between 1 and 100.");
    }

    const racks: WarehouseRackScene[] = [];
    let offset = 0;
    while (true) {
      const response = await this.fetchRack(
        `${this.baseUrl}/warehouse-racks/scene?offset=${offset}&limit=${pageSize}`,
      );
      if (!response.ok) throw new ApiRequestError(response.status);

      const page = mapWarehouseRackSceneResponse(await response.json());
      racks.push(...page);
      if (page.length < pageSize) return racks;
      offset += pageSize;
    }
  }
}

export function mapWarehouseRackSummariesResponse(
  value: unknown,
): readonly WarehouseRackSummary[] {
  return requireArray(value, "Warehouse rack summaries response").map(
    (summary, index) => mapRackSummary(summary, `racks[${index}]`),
  );
}

export function mapWarehouseRackResponse(value: unknown): WarehouseRackDetail {
  const response = requireRecord(value, "Warehouse rack response");
  const locations = requireArray(response.locations, "locations").map(
    mapRackLocation,
  );
  const detail: WarehouseRackDetail = {
    ...mapRackSummary(response, "rack"),
    locations,
  };

  validateRackCounts(detail);
  return detail;
}

export function mapWarehouseRackSceneResponse(
  value: unknown,
): readonly WarehouseRackScene[] {
  return requireArray(value, "Warehouse rack scene response").map(
    (rack, index) => mapRackScene(rack, `racks[${index}]`),
  );
}

function mapRackScene(value: unknown, field: string): WarehouseRackScene {
  const response = requireRecord(value, field);
  const scene: WarehouseRackScene = {
    aisle: requireString(response.aisle, `${field}.aisle`),
    bay: requireString(response.bay, `${field}.bay`),
    widthCm: requirePositiveNumber(response.width_cm, `${field}.width_cm`),
    depthCm: requirePositiveNumber(response.depth_cm, `${field}.depth_cm`),
    totalHeightCm: requirePositiveNumber(
      response.total_height_cm,
      `${field}.total_height_cm`,
    ),
    levelClearHeightCm: requirePositiveNumber(
      response.level_clear_height_cm,
      `${field}.level_clear_height_cm`,
    ),
    levelCount: requirePositiveInteger(
      response.level_count,
      `${field}.level_count`,
    ),
    slotsPerLevel: requirePositiveInteger(
      response.slots_per_level,
      `${field}.slots_per_level`,
    ),
    locationCount: requireNonNegativeInteger(
      response.location_count,
      `${field}.location_count`,
    ),
    activeLocationCount: requireNonNegativeInteger(
      response.active_location_count,
      `${field}.active_location_count`,
    ),
    locations: requireArray(response.locations, `${field}.locations`).map(
      (location, index) =>
        mapRackSceneLocation(location, `${field}.locations[${index}]`),
    ),
  };

  validateRackSceneCounts(scene, field);
  return scene;
}

function mapRackSceneLocation(
  value: unknown,
  field: string,
): WarehouseRackSceneLocation {
  const location = requireRecord(value, field);
  return {
    id: requirePositiveInteger(location.id, `${field}.id`),
    level: requireString(location.level, `${field}.level`),
    slot: requireString(location.slot, `${field}.slot`),
    isActive: requireBoolean(location.is_active, `${field}.is_active`),
    usableWidthCm: requirePositiveNumber(
      location.usable_width_cm,
      `${field}.usable_width_cm`,
    ),
    usableDepthCm: requirePositiveNumber(
      location.usable_depth_cm,
      `${field}.usable_depth_cm`,
    ),
    usableHeightCm: requirePositiveNumber(
      location.usable_height_cm,
      `${field}.usable_height_cm`,
    ),
    maxWeightKg: requireNullablePositiveNumber(
      location.max_weight_kg,
      `${field}.max_weight_kg`,
    ),
    usedWeightKg: requireNullableNonNegativeNumber(
      location.used_weight_kg,
      `${field}.used_weight_kg`,
    ),
    weightUtilizationPercent: requireNullableNonNegativeNumber(
      location.weight_utilization_percent,
      `${field}.weight_utilization_percent`,
    ),
    volumeUtilizationPercent: requireNonNegativeNumber(
      location.volume_utilization_percent,
      `${field}.volume_utilization_percent`,
    ),
    cartons: requireArray(location.cartons, `${field}.cartons`).map(
      (carton, index) =>
        mapRackSceneCarton(carton, `${field}.cartons[${index}]`),
    ),
  };
}

function mapRackSceneCarton(
  value: unknown,
  field: string,
): WarehouseRackSceneCarton {
  const carton = requireRecord(value, field);
  return {
    id: requirePositiveInteger(carton.id, `${field}.id`),
    cartonNumber: requireString(
      carton.carton_number,
      `${field}.carton_number`,
    ),
    cartonTypeCode: requireString(
      carton.carton_type_code,
      `${field}.carton_type_code`,
    ),
    outerLengthCm: requirePositiveNumber(
      carton.outer_length_cm,
      `${field}.outer_length_cm`,
    ),
    outerWidthCm: requirePositiveNumber(
      carton.outer_width_cm,
      `${field}.outer_width_cm`,
    ),
    outerHeightCm: requirePositiveNumber(
      carton.outer_height_cm,
      `${field}.outer_height_cm`,
    ),
    positionXCm: requireNonNegativeNumber(
      carton.position_x_cm,
      `${field}.position_x_cm`,
    ),
    positionYCm: requireNonNegativeNumber(
      carton.position_y_cm,
      `${field}.position_y_cm`,
    ),
    positionZCm: requireNonNegativeNumber(
      carton.position_z_cm,
      `${field}.position_z_cm`,
    ),
    rotationDegrees: requirePlacementRotation(
      carton.rotation_degrees,
      `${field}.rotation_degrees`,
    ),
  };
}

function validateRackSceneCounts(
  scene: WarehouseRackScene,
  field: string,
): void {
  if (scene.locationCount !== scene.locations.length) {
    throw new ApiContractError(
      `${field}.location_count must match the returned locations.`,
    );
  }
  const activeCount = scene.locations.filter((location) => location.isActive).length;
  if (scene.activeLocationCount !== activeCount) {
    throw new ApiContractError(
      `${field}.active_location_count must match the returned locations.`,
    );
  }
  const levelCount = new Set(scene.locations.map((location) => location.level)).size;
  if (scene.levelCount !== levelCount) {
    throw new ApiContractError(
      `${field}.level_count must match the returned locations.`,
    );
  }
}

function mapRackSummary(value: unknown, field: string): WarehouseRackSummary {
  const response = requireRecord(value, field);
  return {
    aisle: requireString(response.aisle, `${field}.aisle`),
    bay: requireString(response.bay, `${field}.bay`),
    levelCount: requirePositiveInteger(response.level_count, `${field}.level_count`),
    locationCount: requirePositiveInteger(
      response.location_count,
      `${field}.location_count`,
    ),
    activeLocationCount: requireNonNegativeInteger(
      response.active_location_count,
      `${field}.active_location_count`,
    ),
    cartonCount: requireNonNegativeInteger(
      response.carton_count,
      `${field}.carton_count`,
    ),
    productCount: requireNonNegativeInteger(
      response.product_count,
      `${field}.product_count`,
    ),
    totalMaxWeightKg: requireNullableNonNegativeNumber(
      response.total_max_weight_kg,
      `${field}.total_max_weight_kg`,
    ),
    totalUsedWeightKg: requireNullableNonNegativeNumber(
      response.total_used_weight_kg,
      `${field}.total_used_weight_kg`,
    ),
    weightUtilizationPercent: requireNullableNonNegativeNumber(
      response.weight_utilization_percent,
      `${field}.weight_utilization_percent`,
    ),
  };
}

function mapRackLocation(
  value: unknown,
  index: number,
): WarehouseRackLocationDetail {
  const field = `locations[${index}]`;
  const location = requireRecord(value, field);
  const baseLocation = mapWarehouseLocationsResponse([value])[0];
  if (baseLocation === undefined) {
    throw new ApiContractError(`${field} could not be mapped.`);
  }

  return {
    ...baseLocation,
    usedWeightKg: requireNullableNonNegativeNumber(
      location.used_weight_kg,
      `${field}.used_weight_kg`,
    ),
    weightUtilizationPercent: requireNullableNonNegativeNumber(
      location.weight_utilization_percent,
      `${field}.weight_utilization_percent`,
    ),
    createdAt: requireDateTime(location.created_at, `${field}.created_at`),
    updatedAt: requireDateTime(location.updated_at, `${field}.updated_at`),
    cartons: requireArray(location.cartons, `${field}.cartons`).map(
      (carton, cartonIndex) =>
        mapRackCarton(carton, `${field}.cartons[${cartonIndex}]`),
    ),
  };
}

function mapRackCarton(value: unknown, field: string): WarehouseRackCarton {
  const carton = requireRecord(value, field);
  const product = requireRecord(carton.product, `${field}.product`);
  const packaging = requireRecord(carton.packaging, `${field}.packaging`);
  const capacityQty = requirePositiveInteger(
    carton.capacity_qty,
    `${field}.capacity_qty`,
  );
  const currentQty = requireNonNegativeInteger(
    carton.current_qty,
    `${field}.current_qty`,
  );
  const reservedQty = requireNonNegativeInteger(
    carton.reserved_qty,
    `${field}.reserved_qty`,
  );
  const availableQty = requireNonNegativeInteger(
    carton.available_qty,
    `${field}.available_qty`,
  );

  if (currentQty > capacityQty || reservedQty > currentQty) {
    throw new ApiContractError(`${field} contains inconsistent quantities.`);
  }
  if (availableQty !== currentQty - reservedQty) {
    throw new ApiContractError(
      `${field}.available_qty must equal current_qty minus reserved_qty.`,
    );
  }

  return {
    id: requirePositiveInteger(carton.id, `${field}.id`),
    cartonNumber: requireString(carton.carton_number, `${field}.carton_number`),
    status: requireCartonStatus(carton.status, `${field}.status`),
    capacityQty,
    currentQty,
    reservedQty,
    availableQty,
    expiresAt: requireNullableDateTime(carton.expires_at, `${field}.expires_at`),
    product: {
      id: requirePositiveInteger(product.id, `${field}.product.id`),
      sku: requireString(product.sku, `${field}.product.sku`),
      name: requireString(product.name, `${field}.product.name`),
      unitWeightKg: requireNullablePositiveNumber(
        product.unit_weight_kg,
        `${field}.product.unit_weight_kg`,
      ),
    },
    packaging: {
      id: requirePositiveInteger(packaging.id, `${field}.packaging.id`),
      unitsPerCarton: requirePositiveInteger(
        packaging.units_per_carton,
        `${field}.packaging.units_per_carton`,
      ),
      cartonTypeCode: requireString(
        packaging.carton_type_code,
        `${field}.packaging.carton_type_code`,
      ),
    },
  };
}

function validateRackCounts(detail: WarehouseRackDetail): void {
  if (detail.locationCount !== detail.locations.length) {
    throw new ApiContractError(
      "location_count must match the number of returned locations.",
    );
  }
  const activeCount = detail.locations.filter((location) => location.isActive).length;
  if (detail.activeLocationCount !== activeCount) {
    throw new ApiContractError(
      "active_location_count must match the returned locations.",
    );
  }
  const cartons = detail.locations.flatMap((location) => location.cartons);
  if (detail.cartonCount !== cartons.length) {
    throw new ApiContractError(
      "carton_count must match the number of returned cartons.",
    );
  }
  const productCount = new Set(cartons.map((carton) => carton.product.id)).size;
  if (detail.productCount !== productCount) {
    throw new ApiContractError(
      "product_count must match the distinct returned products.",
    );
  }
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiContractError(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new ApiContractError(`${field} must be an array.`);
  }
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiContractError(`${field} must be a non-empty string.`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ApiContractError(`${field} must be a positive integer.`);
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ApiContractError(`${field} must be a non-negative integer.`);
  }
  return value;
}

function requirePositiveNumber(value: unknown, field: string): number {
  const number = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim().length > 0
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(number) || number <= 0) {
    throw new ApiContractError(`${field} must be a positive number.`);
  }
  return number;
}

function requireNonNegativeNumber(value: unknown, field: string): number {
  const number = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim().length > 0
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(number) || number < 0) {
    throw new ApiContractError(`${field} must be a non-negative number.`);
  }
  return number;
}

function requirePlacementRotation(value: unknown, field: string): 0 | 90 {
  if (value !== 0 && value !== 90) {
    throw new ApiContractError(`${field} must be 0 or 90 degrees.`);
  }
  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new ApiContractError(`${field} must be a boolean.`);
  }
  return value;
}

function requireNullablePositiveNumber(value: unknown, field: string): number | null {
  const number = requireNullableNumber(value, field);
  if (number !== null && number <= 0) {
    throw new ApiContractError(`${field} must be positive or null.`);
  }
  return number;
}

function requireNullableNonNegativeNumber(
  value: unknown,
  field: string,
): number | null {
  const number = requireNullableNumber(value, field);
  if (number !== null && number < 0) {
    throw new ApiContractError(`${field} must be non-negative or null.`);
  }
  return number;
}

function requireNullableNumber(value: unknown, field: string): number | null {
  if (value === null) return null;
  const number = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim().length > 0
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(number)) {
    throw new ApiContractError(`${field} must be numeric or null.`);
  }
  return number;
}

function requireCartonStatus(
  value: unknown,
  field: string,
): WarehouseCartonStatus {
  if (
    value === "available" || value === "reserved" ||
    value === "depleted" || value === "quarantined"
  ) {
    return value;
  }
  throw new ApiContractError(`${field} contains an unsupported carton status.`);
}

function requireDateTime(value: unknown, field: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new ApiContractError(`${field} must be an ISO date-time string.`);
  }
  return value;
}

function requireNullableDateTime(value: unknown, field: string): string | null {
  return value === null ? null : requireDateTime(value, field);
}
