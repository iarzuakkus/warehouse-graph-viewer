import type { WarehouseRackSummary } from "@warehouse/domain";

export type RackOccupancyState =
  | "empty"
  | "partial"
  | "full"
  | "unknown"
  | "inactive";

export function getRackOccupancyState(
  summary: WarehouseRackSummary,
): RackOccupancyState {
  if (summary.activeLocationCount === 0) return "inactive";
  if (summary.weightUtilizationPercent === null) return "unknown";
  if (summary.cartonCount === 0 || summary.weightUtilizationPercent <= 0) {
    return "empty";
  }
  return summary.weightUtilizationPercent >= 80 ? "full" : "partial";
}
