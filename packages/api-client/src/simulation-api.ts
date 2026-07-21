import type {
  SimulationAssignmentStatus,
  SimulationMetricSet,
  SimulationMove,
  SimulationMoveList,
  SimulationObjectiveWeights,
  SimulationPathPoint,
  SimulationScenario,
  SimulationScenarioInput,
  SimulationScenarioParameters,
  SimulationScenarioResult,
  SimulationScenarioStatus,
  WarehouseRackScene,
} from "@warehouse/domain";

import { ApiContractError, ApiRequestError } from "./warehouse-graph-api.js";
import { mapWarehouseRackSceneResponse } from "./warehouse-racks-api.js";

interface SimulationHttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

interface SimulationRequestOptions {
  readonly method: "POST" | "DELETE";
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
}

export type FetchSimulation = (
  url: string,
  options?: SimulationRequestOptions,
) => Promise<SimulationHttpResponse>;

export class SimulationApiClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetchSimulation: FetchSimulation,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async listScenarios(
    offset = 0,
    limit = 100,
    status?: SimulationScenarioStatus,
  ): Promise<readonly SimulationScenario[]> {
    if (!Number.isInteger(offset) || offset < 0) {
      throw new RangeError("Scenario offset must be a non-negative integer.");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError("Scenario page size must be between 1 and 100.");
    }

    const statusQuery = status === undefined
      ? ""
      : `&status=${encodeURIComponent(status)}`;
    const response = await this.fetchSimulation(
      `${this.baseUrl}/simulation-scenarios?offset=${offset}&limit=${limit}${statusQuery}`,
    );
    ensureSuccessful(response);
    return mapSimulationScenariosResponse(await response.json());
  }

  async createScenario(
    input: SimulationScenarioInput,
  ): Promise<SimulationScenario> {
    const response = await this.fetchSimulation(
      `${this.baseUrl}/simulation-scenarios`,
      jsonPostOptions(mapScenarioInput(input)),
    );
    ensureSuccessful(response);
    return mapSimulationScenarioResponse(await response.json());
  }

  async getScenario(scenarioId: number): Promise<SimulationScenario> {
    requirePositiveId(scenarioId, "Scenario id");
    const response = await this.fetchSimulation(
      `${this.baseUrl}/simulation-scenarios/${scenarioId}`,
    );
    ensureSuccessful(response);
    return mapSimulationScenarioResponse(await response.json());
  }

  async runScenario(scenarioId: number): Promise<SimulationScenario> {
    requirePositiveId(scenarioId, "Scenario id");
    const response = await this.fetchSimulation(
      `${this.baseUrl}/simulation-scenarios/${scenarioId}/run`,
      { method: "POST" },
    );
    ensureSuccessful(response);
    return mapSimulationScenarioResponse(await response.json());
  }

  async getScenarioScene(
    scenarioId: number,
    step?: number,
  ): Promise<readonly WarehouseRackScene[]> {
    requirePositiveId(scenarioId, "Scenario id");
    if (step !== undefined && (!Number.isInteger(step) || step < 0)) {
      throw new RangeError("Simulation step must be a non-negative integer.");
    }
    const stepQuery = step === undefined ? "" : `?step=${step}`;
    const response = await this.fetchSimulation(
      `${this.baseUrl}/simulation-scenarios/${scenarioId}/scene${stepQuery}`,
    );
    ensureSuccessful(response);
    return mapWarehouseRackSceneResponse(await response.json());
  }

  async getMoves(scenarioId: number): Promise<SimulationMoveList> {
    requirePositiveId(scenarioId, "Scenario id");
    const response = await this.fetchSimulation(
      `${this.baseUrl}/simulation-scenarios/${scenarioId}/moves`,
    );
    ensureSuccessful(response);
    return mapSimulationMoveListResponse(await response.json());
  }

  async getMove(scenarioId: number, sequence: number): Promise<SimulationMove> {
    requirePositiveId(scenarioId, "Scenario id");
    requirePositiveId(sequence, "Move sequence");
    const response = await this.fetchSimulation(
      `${this.baseUrl}/simulation-scenarios/${scenarioId}/moves/${sequence}`,
    );
    ensureSuccessful(response);
    return mapSimulationMoveResponse(await response.json());
  }

  async deleteScenario(scenarioId: number): Promise<void> {
    requirePositiveId(scenarioId, "Scenario id");
    const response = await this.fetchSimulation(
      `${this.baseUrl}/simulation-scenarios/${scenarioId}`,
      { method: "DELETE" },
    );
    ensureSuccessful(response);
  }
}

export function mapSimulationScenariosResponse(
  value: unknown,
): readonly SimulationScenario[] {
  return requireArray(value, "Simulation scenarios response").map(
    (scenario, index) => mapScenario(scenario, `scenarios[${index}]`),
  );
}

export function mapSimulationScenarioResponse(value: unknown): SimulationScenario {
  return mapScenario(value, "scenario");
}

export function mapSimulationMoveListResponse(value: unknown): SimulationMoveList {
  const response = requireRecord(value, "Simulation move list response");
  const moves = requireArray(response.moves, "moves").map((move, index) =>
    mapMove(move, `moves[${index}]`),
  );
  const result: SimulationMoveList = {
    scenarioId: requirePositiveInteger(response.scenario_id, "scenario_id"),
    moveCount: requireNonNegativeInteger(response.move_count, "move_count"),
    unplacedCount: requireNonNegativeInteger(
      response.unplaced_count,
      "unplaced_count",
    ),
    moves,
  };
  if (result.moveCount !== moves.length) {
    throw new ApiContractError("move_count does not match moves length.");
  }
  return result;
}

export function mapSimulationMoveResponse(value: unknown): SimulationMove {
  return mapMove(value, "move");
}

function mapScenario(value: unknown, field: string): SimulationScenario {
  const scenario = requireRecord(value, field);
  return {
    id: requirePositiveInteger(scenario.id, `${field}.id`),
    name: requireString(scenario.name, `${field}.name`),
    seed: requireNonNegativeInteger(scenario.seed, `${field}.seed`),
    algorithmName: requireString(
      scenario.algorithm_name,
      `${field}.algorithm_name`,
    ),
    status: requireScenarioStatus(scenario.status, `${field}.status`),
    progressPercent: requireRangeNumber(
      scenario.progress_percent,
      `${field}.progress_percent`,
      0,
      100,
    ),
    parameters: mapParameters(scenario.parameters, `${field}.parameters`),
    result: scenario.result === null
      ? null
      : mapResult(scenario.result, `${field}.result`),
    startedAt: requireNullableString(scenario.started_at, `${field}.started_at`),
    completedAt: requireNullableString(
      scenario.completed_at,
      `${field}.completed_at`,
    ),
    errorMessage: requireNullableString(
      scenario.error_message,
      `${field}.error_message`,
    ),
    createdAt: requireString(scenario.created_at, `${field}.created_at`),
    updatedAt: requireString(scenario.updated_at, `${field}.updated_at`),
  };
}

function mapParameters(
  value: unknown,
  field: string,
): SimulationScenarioParameters {
  const parameters = requireRecord(value, field);
  return {
    groupSameSku: requireBoolean(
      parameters.group_same_sku,
      `${field}.group_same_sku`,
    ),
    preferLowerLevelsForHeavyCartons: requireBoolean(
      parameters.prefer_lower_levels_for_heavy_cartons,
      `${field}.prefer_lower_levels_for_heavy_cartons`,
    ),
    minimizeDispatchDistance: requireBoolean(
      parameters.minimize_dispatch_distance,
      `${field}.minimize_dispatch_distance`,
    ),
    minimizeMoves: requireBoolean(
      parameters.minimize_moves,
      `${field}.minimize_moves`,
    ),
    improveVolumeUtilization: requireBoolean(
      parameters.improve_volume_utilization,
      `${field}.improve_volume_utilization`,
    ),
    objectiveWeights: mapObjectiveWeights(
      parameters.objective_weights,
      `${field}.objective_weights`,
    ),
    aisleFilter: requireNullableStringArray(
      parameters.aisle_filter,
      `${field}.aisle_filter`,
    ),
    levelFilter: requireNullableStringArray(
      parameters.level_filter,
      `${field}.level_filter`,
    ),
  };
}

function mapObjectiveWeights(
  value: unknown,
  field: string,
): SimulationObjectiveWeights {
  const weights = requireRecord(value, field);
  return {
    sameSkuLocation: requireNonNegativeNumber(
      weights.same_sku_location,
      `${field}.same_sku_location`,
    ),
    sameRack: requireNonNegativeNumber(weights.same_rack, `${field}.same_rack`),
    nearbyAisle: requireNonNegativeNumber(
      weights.nearby_aisle,
      `${field}.nearby_aisle`,
    ),
    lowerLevelForHeavy: requireNonNegativeNumber(
      weights.lower_level_for_heavy,
      `${field}.lower_level_for_heavy`,
    ),
    dispatchDistance: requireNonNegativeNumber(
      weights.dispatch_distance,
      `${field}.dispatch_distance`,
    ),
    coShipmentProximity: requireNonNegativeNumber(
      weights.co_shipment_proximity,
      `${field}.co_shipment_proximity`,
    ),
    locationConsolidation: requireNonNegativeNumber(
      weights.location_consolidation,
      `${field}.location_consolidation`,
    ),
    splitSku: requireNonNegativeNumber(weights.split_sku, `${field}.split_sku`),
    moves: requireNonNegativeNumber(weights.moves, `${field}.moves`),
    volumeUtilization: requireNonNegativeNumber(
      weights.volume_utilization,
      `${field}.volume_utilization`,
    ),
  };
}

function mapResult(value: unknown, field: string): SimulationScenarioResult {
  const result = requireRecord(value, field);
  return {
    current: mapMetricSet(result.current, `${field}.current`),
    proposed: mapMetricSet(result.proposed, `${field}.proposed`),
    objectiveImprovementPercent: requireNullableNumber(
      result.objective_improvement_percent,
      `${field}.objective_improvement_percent`,
    ),
    estimatedDurationSeconds: requireNonNegativeNumber(
      result.estimated_duration_seconds,
      `${field}.estimated_duration_seconds`,
    ),
    totalMovementDistanceM: requireNonNegativeNumber(
      result.total_movement_distance_m,
      `${field}.total_movement_distance_m`,
    ),
  };
}

function mapMetricSet(value: unknown, field: string): SimulationMetricSet {
  const metrics = requireRecord(value, field);
  return {
    totalDispatchDistance: requireNonNegativeNumber(
      metrics.total_dispatch_distance,
      `${field}.total_dispatch_distance`,
    ),
    averageDispatchDistance: requireNonNegativeNumber(
      metrics.average_dispatch_distance,
      `${field}.average_dispatch_distance`,
    ),
    weightUtilizationPercent: requireNullableNonNegativeNumber(
      metrics.weight_utilization_percent,
      `${field}.weight_utilization_percent`,
    ),
    volumeUtilizationPercent: requireNonNegativeNumber(
      metrics.volume_utilization_percent,
      `${field}.volume_utilization_percent`,
    ),
    usedLocationCount: requireNonNegativeInteger(
      metrics.used_location_count,
      `${field}.used_location_count`,
    ),
    splitSkuCount: requireNonNegativeInteger(
      metrics.split_sku_count,
      `${field}.split_sku_count`,
    ),
    movedCartonCount: requireNonNegativeInteger(
      metrics.moved_carton_count,
      `${field}.moved_carton_count`,
    ),
    unplacedCartonCount: requireNonNegativeInteger(
      metrics.unplaced_carton_count,
      `${field}.unplaced_carton_count`,
    ),
    objectiveScore: requireNumber(metrics.objective_score, `${field}.objective_score`),
  };
}

function mapMove(value: unknown, field: string): SimulationMove {
  const move = requireRecord(value, field);
  return {
    id: requirePositiveInteger(move.id, `${field}.id`),
    sequence: requirePositiveInteger(move.sequence, `${field}.sequence`),
    resultStatus: requireAssignmentStatus(
      move.result_status,
      `${field}.result_status`,
    ),
    cartonId: requirePositiveInteger(move.carton_id, `${field}.carton_id`),
    cartonNumber: requireString(move.carton_number, `${field}.carton_number`),
    productId: requirePositiveInteger(move.product_id, `${field}.product_id`),
    sku: requireString(move.sku, `${field}.sku`),
    fromLocationId: requireNullablePositiveInteger(
      move.from_location_id,
      `${field}.from_location_id`,
    ),
    toLocationId: requireNullablePositiveInteger(
      move.to_location_id,
      `${field}.to_location_id`,
    ),
    fromPositionXCm: requireNullableNumber(
      move.from_position_x_cm,
      `${field}.from_position_x_cm`,
    ),
    fromPositionYCm: requireNullableNumber(
      move.from_position_y_cm,
      `${field}.from_position_y_cm`,
    ),
    fromPositionZCm: requireNullableNumber(
      move.from_position_z_cm,
      `${field}.from_position_z_cm`,
    ),
    fromRotationDegrees: requireNullableInteger(
      move.from_rotation_degrees,
      `${field}.from_rotation_degrees`,
    ),
    proposedPositionXCm: requireNullableNumber(
      move.proposed_position_x_cm,
      `${field}.proposed_position_x_cm`,
    ),
    proposedPositionYCm: requireNullableNumber(
      move.proposed_position_y_cm,
      `${field}.proposed_position_y_cm`,
    ),
    proposedPositionZCm: requireNullableNumber(
      move.proposed_position_z_cm,
      `${field}.proposed_position_z_cm`,
    ),
    proposedRotationDegrees: requireNullableInteger(
      move.proposed_rotation_degrees,
      `${field}.proposed_rotation_degrees`,
    ),
    assignmentScore: requireNullableNumber(
      move.assignment_score,
      `${field}.assignment_score`,
    ),
    estimatedDurationSeconds: requireNullableNonNegativeNumber(
      move.estimated_duration_seconds,
      `${field}.estimated_duration_seconds`,
    ),
    travelDistanceM: requireNullableNonNegativeNumber(
      move.travel_distance_m,
      `${field}.travel_distance_m`,
    ),
    path: requireArray(move.path, `${field}.path`).map((point, index) =>
      mapPathPoint(point, `${field}.path[${index}]`),
    ),
    reasons: requireStringArray(move.reasons, `${field}.reasons`),
    unplacedReason: requireNullableString(
      move.unplaced_reason,
      `${field}.unplaced_reason`,
    ),
  };
}

function mapPathPoint(value: unknown, field: string): SimulationPathPoint {
  const point = requireRecord(value, field);
  return {
    sequence: requireNonNegativeInteger(point.sequence, `${field}.sequence`),
    nodeId: requireString(point.node_id, `${field}.node_id`),
    x: requireNumber(point.x, `${field}.x`),
    y: requireNumber(point.y, `${field}.y`),
  };
}

function mapScenarioInput(input: SimulationScenarioInput): unknown {
  return {
    name: input.name,
    seed: input.seed,
    algorithm_name: input.algorithmName,
    group_same_sku: input.groupSameSku,
    prefer_lower_levels_for_heavy_cartons:
      input.preferLowerLevelsForHeavyCartons,
    minimize_dispatch_distance: input.minimizeDispatchDistance,
    minimize_moves: input.minimizeMoves,
    improve_volume_utilization: input.improveVolumeUtilization,
    objective_weights: {
      same_sku_location: input.objectiveWeights.sameSkuLocation,
      same_rack: input.objectiveWeights.sameRack,
      nearby_aisle: input.objectiveWeights.nearbyAisle,
      lower_level_for_heavy: input.objectiveWeights.lowerLevelForHeavy,
      dispatch_distance: input.objectiveWeights.dispatchDistance,
      co_shipment_proximity: input.objectiveWeights.coShipmentProximity,
      location_consolidation: input.objectiveWeights.locationConsolidation,
      split_sku: input.objectiveWeights.splitSku,
      moves: input.objectiveWeights.moves,
      volume_utilization: input.objectiveWeights.volumeUtilization,
    },
    aisle_filter: input.aisleFilter,
    level_filter: input.levelFilter,
  };
}

function jsonPostOptions(value: unknown): SimulationRequestOptions {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  };
}

function ensureSuccessful(response: SimulationHttpResponse): void {
  if (!response.ok) throw new ApiRequestError(response.status);
}

function requirePositiveId(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive integer.`);
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

function requireNullableString(value: unknown, field: string): string | null {
  return value === null ? null : requireString(value, field);
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new ApiContractError(`${field} must be a boolean.`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  const number = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim().length > 0
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(number)) {
    throw new ApiContractError(`${field} must be a finite number.`);
  }
  return number;
}

function requireNonNegativeNumber(value: unknown, field: string): number {
  const number = requireNumber(value, field);
  if (number < 0) {
    throw new ApiContractError(`${field} must be non-negative.`);
  }
  return number;
}

function requireRangeNumber(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  const number = requireNumber(value, field);
  if (number < minimum || number > maximum) {
    throw new ApiContractError(
      `${field} must be between ${minimum} and ${maximum}.`,
    );
  }
  return number;
}

function requireNullableNumber(value: unknown, field: string): number | null {
  return value === null ? null : requireNumber(value, field);
}

function requireNullableNonNegativeNumber(
  value: unknown,
  field: string,
): number | null {
  return value === null ? null : requireNonNegativeNumber(value, field);
}

function requirePositiveInteger(value: unknown, field: string): number {
  const number = requireNumber(value, field);
  if (!Number.isInteger(number) || number <= 0) {
    throw new ApiContractError(`${field} must be a positive integer.`);
  }
  return number;
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  const number = requireNumber(value, field);
  if (!Number.isInteger(number) || number < 0) {
    throw new ApiContractError(`${field} must be a non-negative integer.`);
  }
  return number;
}

function requireNullablePositiveInteger(
  value: unknown,
  field: string,
): number | null {
  return value === null ? null : requirePositiveInteger(value, field);
}

function requireNullableInteger(value: unknown, field: string): number | null {
  if (value === null) return null;
  const number = requireNumber(value, field);
  if (!Number.isInteger(number)) {
    throw new ApiContractError(`${field} must be an integer.`);
  }
  return number;
}

function requireStringArray(value: unknown, field: string): readonly string[] {
  return requireArray(value, field).map((item, index) =>
    requireString(item, `${field}[${index}]`),
  );
}

function requireNullableStringArray(
  value: unknown,
  field: string,
): readonly string[] | null {
  return value === null ? null : requireStringArray(value, field);
}

function requireScenarioStatus(
  value: unknown,
  field: string,
): SimulationScenarioStatus {
  if (
    value !== "pending" &&
    value !== "running" &&
    value !== "completed" &&
    value !== "failed" &&
    value !== "cancelled"
  ) {
    throw new ApiContractError(`${field} has an unsupported value.`);
  }
  return value;
}

function requireAssignmentStatus(
  value: unknown,
  field: string,
): SimulationAssignmentStatus {
  if (value !== "placed" && value !== "unplaced") {
    throw new ApiContractError(`${field} has an unsupported value.`);
  }
  return value;
}
