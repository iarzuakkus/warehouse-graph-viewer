import type { StorageLocation } from "@warehouse/domain";

import {
  ApiContractError,
  ApiRequestError,
  type FetchGraph,
} from "./warehouse-graph-api.js";

export class WarehouseLocationsApiClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetchLocations: FetchGraph,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async getAllLocations(pageSize = 100): Promise<readonly StorageLocation[]> {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new RangeError("Location page size must be between 1 and 100.");
    }

    const locations: StorageLocation[] = [];
    let offset = 0;

    while (true) {
      const response = await this.fetchLocations(
        `${this.baseUrl}/warehouse-locations?offset=${offset}&limit=${pageSize}`,
      );
      if (!response.ok) {
        throw new ApiRequestError(response.status);
      }

      const page = mapWarehouseLocationsResponse(await response.json());
      locations.push(...page);

      if (page.length < pageSize) return locations;
      offset += pageSize;
    }
  }
}

export function mapWarehouseLocationsResponse(
  value: unknown,
): readonly StorageLocation[] {
  if (!Array.isArray(value)) {
    throw new ApiContractError("Warehouse locations response must be an array.");
  }

  return value.map((item, index) => mapStorageLocation(item, index));
}

function mapStorageLocation(value: unknown, index: number): StorageLocation {
  const item = requireRecord(value, `locations[${index}]`);

  return {
    id: requirePositiveInteger(item.id, `locations[${index}].id`),
    aisle: requireString(item.aisle, `locations[${index}].aisle`),
    bay: requireString(item.bay, `locations[${index}].bay`),
    level: requireString(item.level, `locations[${index}].level`),
    slot: requireString(item.slot, `locations[${index}].slot`),
    maxWeightKg: requireNullablePositiveNumber(
      item.max_weight_kg,
      `locations[${index}].max_weight_kg`,
    ),
    distanceFromDispatchM: requireNonNegativeNumber(
      item.distance_from_dispatch_m,
      `locations[${index}].distance_from_dispatch_m`,
    ),
    isActive: requireBoolean(item.is_active, `locations[${index}].is_active`),
  };
}

function requireRecord(
  value: unknown,
  fieldName: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiContractError(`${fieldName} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiContractError(`${fieldName} must be a non-empty string.`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new ApiContractError(`${fieldName} must be a positive integer.`);
  }
  return value;
}

function requireBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new ApiContractError(`${fieldName} must be a boolean.`);
  }
  return value;
}

function requireNullablePositiveNumber(
  value: unknown,
  fieldName: string,
): number | null {
  if (value === null) return null;
  const number = parseNumericValue(value, fieldName);
  if (number <= 0) {
    throw new ApiContractError(`${fieldName} must be greater than zero or null.`);
  }
  return number;
}

function requireNonNegativeNumber(value: unknown, fieldName: string): number {
  const number = parseNumericValue(value, fieldName);
  if (number < 0) {
    throw new ApiContractError(`${fieldName} must be non-negative.`);
  }
  return number;
}

function parseNumericValue(value: unknown, fieldName: string): number {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(number)) {
    throw new ApiContractError(`${fieldName} must be numeric.`);
  }
  return number;
}
