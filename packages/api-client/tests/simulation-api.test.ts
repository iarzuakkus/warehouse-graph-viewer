import { describe, expect, it, vi } from "vitest";

import {
  ApiContractError,
  SimulationApiClient,
  mapSimulationMoveBatchListResponse,
  mapSimulationMoveListResponse,
  mapSimulationScenarioResponse,
  type FetchSimulation,
} from "../src/index.js";
import type { SimulationScenarioInput } from "@warehouse/domain";

const metricResponse = {
  total_dispatch_distance: "145.50",
  average_dispatch_distance: "18.19",
  weight_utilization_percent: "46.25",
  volume_utilization_percent: "62.75",
  used_location_count: 8,
  split_sku_count: 2,
  moved_carton_count: 4,
  unplaced_carton_count: 0,
  objective_score: "81.40",
};

const scenarioResponse = {
  id: 12,
  name: "Haftalik yeniden yerlesim",
  seed: 42,
  algorithm_name: "deterministic_slotting_v1",
  status: "completed",
  progress_percent: "100.00",
  parameters: {
    group_same_sku: true,
    prefer_lower_levels_for_heavy_cartons: true,
    minimize_dispatch_distance: true,
    minimize_moves: true,
    improve_volume_utilization: true,
    equipment_type: "cart",
    max_batch_weight_kg: "250",
    max_batch_volume_m3: "1.2",
    max_cartons_per_batch: 12,
    objective_weights: {
      same_sku_location: "8",
      same_rack: "4",
      nearby_aisle: "2",
      lower_level_for_heavy: "5",
      dispatch_distance: "7",
      co_shipment_proximity: "3",
      location_consolidation: "4",
      split_sku: "6",
      moves: "5",
      volume_utilization: "4",
    },
    aisle_filter: ["SYN-A001"],
    level_filter: null,
  },
  result: {
    current: metricResponse,
    proposed: {
      ...metricResponse,
      total_dispatch_distance: "112.20",
      average_dispatch_distance: "14.03",
      split_sku_count: 1,
      objective_score: "92.10",
    },
    objective_improvement_percent: "13.14",
    estimated_duration_seconds: "96.50",
    total_movement_distance_m: "38.25",
  },
  started_at: "2026-07-21T08:00:00Z",
  completed_at: "2026-07-21T08:01:36Z",
  error_message: null,
  created_at: "2026-07-21T07:58:00Z",
  updated_at: "2026-07-21T08:01:36Z",
};

const moveResponse = {
  id: 31,
  sequence: 1,
  result_status: "placed",
  carton_id: 205,
  carton_number: "SYN-CARTON-0000205",
  product_id: 17,
  sku: "SYN-SKU-0017",
  from_location_id: 10,
  to_location_id: 22,
  from_position_x_cm: "0",
  from_position_y_cm: "10",
  from_position_z_cm: "0",
  from_rotation_degrees: 0,
  proposed_position_x_cm: "20",
  proposed_position_y_cm: "0",
  proposed_position_z_cm: "0",
  proposed_rotation_degrees: 90,
  assignment_score: "18.75",
  estimated_duration_seconds: "24.50",
  travel_distance_m: "12.75",
  path: [
    { sequence: 0, node_id: "L-10", x: "1.25", y: "2.50" },
    { sequence: 1, node_id: "L-22", x: "4.00", y: "6.00" },
  ],
  reasons: ["same_sku_location", "dispatch_distance"],
  unplaced_reason: null,
};

const moveBatchItemResponse = {
  move_sequence: 1,
  carton_id: 205,
  carton_number: "SYN-CARTON-0000205",
  sku: "SYN-SKU-0017",
  weight_kg: "42.50",
  volume_m3: "0.125",
  from_location_id: 10,
  to_location_id: 22,
};

const moveBatchResponse = {
  sequence: 1,
  equipment_type: "cart",
  carton_count: 1,
  total_weight_kg: "42.50",
  total_volume_m3: "0.125",
  estimated_distance_m: "25.50",
  estimated_duration_seconds: "31.25",
  capacity_utilization_percent: "17.00",
  move_sequences: [1],
  items: [moveBatchItemResponse],
  stops: [
    { sequence: 1, type: "pickup", location_id: 10, carton_ids: [205] },
    { sequence: 2, type: "dropoff", location_id: 22, carton_ids: [205] },
  ],
  reasons: ["same_sku_grouped"],
  requires_staging_buffer: false,
};

const moveBatchListResponse = {
  scenario_id: 12,
  equipment_type: "cart",
  batch_count: 1,
  carton_move_count: 1,
  operational_distance_m: "25.50",
  individual_distance_m: "38.25",
  estimated_duration_seconds: "31.25",
  capacity_utilization_percent: "17.00",
  requires_staging_buffer: false,
  staging_move_sequences: [],
  batches: [moveBatchResponse],
  unbatched_items: [],
  validation_errors: [],
};

const scenarioInput: SimulationScenarioInput = {
  name: "Haftalik yeniden yerlesim",
  seed: 42,
  algorithmName: "deterministic_slotting_v1",
  groupSameSku: true,
  preferLowerLevelsForHeavyCartons: true,
  minimizeDispatchDistance: true,
  minimizeMoves: true,
  improveVolumeUtilization: true,
  equipmentType: "cart",
  maxBatchWeightKg: 250,
  maxBatchVolumeM3: 1.2,
  maxCartonsPerBatch: 12,
  objectiveWeights: {
    sameSkuLocation: 8,
    sameRack: 4,
    nearbyAisle: 2,
    lowerLevelForHeavy: 5,
    dispatchDistance: 7,
    coShipmentProximity: 3,
    locationConsolidation: 4,
    splitSku: 6,
    moves: 5,
    volumeUtilization: 4,
  },
  aisleFilter: ["SYN-A001"],
  levelFilter: null,
};

describe("simulation response mapping", () => {
  it("maps scenario parameters, decimal metrics and result", () => {
    expect(mapSimulationScenarioResponse(scenarioResponse)).toMatchObject({
      id: 12,
      status: "completed",
      progressPercent: 100,
      parameters: {
        groupSameSku: true,
        equipmentType: "cart",
        maxBatchWeightKg: 250,
        maxBatchVolumeM3: 1.2,
        maxCartonsPerBatch: 12,
        aisleFilter: ["SYN-A001"],
        objectiveWeights: { sameSkuLocation: 8, dispatchDistance: 7 },
      },
      result: {
        objectiveImprovementPercent: 13.14,
        estimatedDurationSeconds: 96.5,
        current: { averageDispatchDistance: 18.19 },
        proposed: { averageDispatchDistance: 14.03 },
      },
    });
  });

  it("maps move positions, path and reasons", () => {
    expect(mapSimulationMoveListResponse({
      scenario_id: 12,
      move_count: 1,
      unplaced_count: 0,
      moves: [moveResponse],
    })).toMatchObject({
      scenarioId: 12,
      moveCount: 1,
      moves: [{
        sequence: 1,
        travelDistanceM: 12.75,
        proposedRotationDegrees: 90,
        path: [
          { nodeId: "L-10", x: 1.25 },
          { nodeId: "L-22", x: 4 },
        ],
        reasons: ["same_sku_location", "dispatch_distance"],
      }],
    });
  });

  it("maps operational move batches, items and stops", () => {
    expect(mapSimulationMoveBatchListResponse(moveBatchListResponse)).toMatchObject({
      scenarioId: 12,
      equipmentType: "cart",
      batchCount: 1,
      cartonMoveCount: 1,
      operationalDistanceM: 25.5,
      individualDistanceM: 38.25,
      capacityUtilizationPercent: 17,
      batches: [{
        sequence: 1,
        cartonCount: 1,
        totalWeightKg: 42.5,
        totalVolumeM3: 0.125,
        moveSequences: [1],
        items: [{
          moveSequence: 1,
          cartonId: 205,
          fromLocationId: 10,
          toLocationId: 22,
        }],
        stops: [
          { sequence: 1, type: "pickup", locationId: 10 },
          { sequence: 2, type: "dropoff", locationId: 22 },
        ],
      }],
    });
  });

  it("rejects unsupported batch values and inconsistent counts", () => {
    expect(() => mapSimulationMoveBatchListResponse({
      ...moveBatchListResponse,
      equipment_type: "crane",
    })).toThrow(ApiContractError);
    expect(() => mapSimulationMoveBatchListResponse({
      ...moveBatchListResponse,
      batch_count: 2,
    })).toThrow("batch_count does not match batches length");
    expect(() => mapSimulationMoveBatchListResponse({
      ...moveBatchListResponse,
      carton_move_count: 2,
    })).toThrow("carton_move_count does not match");
    expect(() => mapSimulationMoveBatchListResponse({
      ...moveBatchListResponse,
      batches: [{
        ...moveBatchResponse,
        stops: [{
          sequence: 1,
          type: "wait",
          location_id: 10,
          carton_ids: [205],
        }],
      }],
    })).toThrow(ApiContractError);
    expect(() => mapSimulationMoveBatchListResponse({
      ...moveBatchListResponse,
      validation_errors: [{
        move_sequence: 1,
        carton_id: 205,
        code: "unsupported_limit",
        message: "Unsupported validation",
      }],
    })).toThrow(ApiContractError);
  });

  it("rejects unsupported statuses and inconsistent move counts", () => {
    expect(() => mapSimulationScenarioResponse({
      ...scenarioResponse,
      status: "unknown",
    })).toThrow(ApiContractError);
    expect(() => mapSimulationMoveListResponse({
      scenario_id: 12,
      move_count: 2,
      unplaced_count: 0,
      moves: [moveResponse],
    })).toThrow("move_count does not match moves length");
  });
});

describe("SimulationApiClient", () => {
  it("creates a scenario with a snake_case request body", async () => {
    const fetchSimulation = vi.fn<FetchSimulation>().mockResolvedValue(
      response(scenarioResponse, 201),
    );
    const client = new SimulationApiClient("/api/", fetchSimulation);

    await client.createScenario(scenarioInput);

    expect(fetchSimulation).toHaveBeenCalledOnce();
    const [url, options] = fetchSimulation.mock.calls[0] ?? [];
    expect(url).toBe("/api/simulation-scenarios");
    expect(options?.method).toBe("POST");
    expect(JSON.parse(options?.body ?? "{}")).toMatchObject({
      name: "Haftalik yeniden yerlesim",
      algorithm_name: "deterministic_slotting_v1",
      group_same_sku: true,
      equipment_type: "cart",
      max_batch_weight_kg: 250,
      max_batch_volume_m3: 1.2,
      max_cartons_per_batch: 12,
      objective_weights: {
        same_sku_location: 8,
        dispatch_distance: 7,
      },
      aisle_filter: ["SYN-A001"],
      level_filter: null,
    });
  });

  it("uses scenario, batch scene, move batch and delete endpoints", async () => {
    const fetchSimulation = vi
      .fn<FetchSimulation>()
      .mockResolvedValueOnce(response(scenarioResponse))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response({
        scenario_id: 12,
        move_count: 1,
        unplaced_count: 0,
        moves: [moveResponse],
      }))
      .mockResolvedValueOnce(response(moveResponse))
      .mockResolvedValueOnce(response(moveBatchListResponse))
      .mockResolvedValueOnce(response(moveBatchResponse))
      .mockResolvedValueOnce(response(null, 204));
    const client = new SimulationApiClient("/api", fetchSimulation);

    await client.runScenario(12);
    await client.getScenarioScene(12, 3);
    await client.getBatchScene(12, 2);
    await client.getMoves(12);
    await client.getMove(12, 1);
    await client.getMoveBatches(12);
    await client.getMoveBatch(12, 1);
    await client.deleteScenario(12);

    expect(fetchSimulation.mock.calls.map(([url]) => url)).toEqual([
      "/api/simulation-scenarios/12/run",
      "/api/simulation-scenarios/12/scene?step=3",
      "/api/simulation-scenarios/12/batch-scene?step=2",
      "/api/simulation-scenarios/12/moves",
      "/api/simulation-scenarios/12/moves/1",
      "/api/simulation-scenarios/12/move-batches",
      "/api/simulation-scenarios/12/move-batches/1",
      "/api/simulation-scenarios/12",
    ]);
    expect(fetchSimulation.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchSimulation.mock.calls[7]?.[1]?.method).toBe("DELETE");
  });

  it("rejects invalid pagination, ids and steps before requesting", async () => {
    const fetchSimulation = vi.fn<FetchSimulation>();
    const client = new SimulationApiClient("/api", fetchSimulation);

    await expect(client.listScenarios(-1)).rejects.toThrow(RangeError);
    await expect(client.listScenarios(0, 101)).rejects.toThrow(RangeError);
    await expect(client.getScenario(0)).rejects.toThrow(RangeError);
    await expect(client.getScenarioScene(1, -1)).rejects.toThrow(RangeError);
    await expect(client.getBatchScene(1, -1)).rejects.toThrow(RangeError);
    await expect(client.getMoveBatches(0)).rejects.toThrow(RangeError);
    await expect(client.getMoveBatch(1, 0)).rejects.toThrow(RangeError);
    expect(fetchSimulation).not.toHaveBeenCalled();
  });
});

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}
