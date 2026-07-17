import type { WarehouseRackDetail } from "@warehouse/domain";

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
}

export function mapWarehouseRackResponse(value: unknown): WarehouseRackDetail {
  const response = requireRecord(value, "Warehouse rack response");
  const locations = mapWarehouseLocationsResponse(response.locations);
  const locationCount = requireNonNegativeInteger(
    response.location_count,
    "location_count",
  );
  const activeLocationCount = requireNonNegativeInteger(
    response.active_location_count,
    "active_location_count",
  );

  if (locationCount !== locations.length) {
    throw new ApiContractError(
      "location_count must match the number of returned locations.",
    );
  }
  if (activeLocationCount > locationCount) {
    throw new ApiContractError(
      "active_location_count cannot exceed location_count.",
    );
  }

  return {
    aisle: requireString(response.aisle, "aisle"),
    bay: requireString(response.bay, "bay"),
    locationCount,
    activeLocationCount,
    locations,
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

function requireNonNegativeInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ApiContractError(`${fieldName} must be a non-negative integer.`);
  }
  return value;
}
