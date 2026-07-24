export type SimulationScenarioStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type SimulationAssignmentStatus = "placed" | "unplaced";

export type SimulationEquipmentType = "cart" | "pallet_jack" | "forklift";

export type SimulationMoveBatchStopType = "pickup" | "dropoff";

export type SimulationBatchAnimationEventType =
  | "travel"
  | "pickup"
  | "dropoff"
  | "staging_pickup"
  | "staging_dropoff";

export type SimulationMoveBatchValidationCode =
  | "max_batch_weight_exceeded"
  | "max_batch_volume_exceeded";

export interface SimulationObjectiveWeights {
  readonly sameSkuLocation: number;
  readonly sameRack: number;
  readonly nearbyAisle: number;
  readonly lowerLevelForHeavy: number;
  readonly dispatchDistance: number;
  readonly coShipmentProximity: number;
  readonly locationConsolidation: number;
  readonly splitSku: number;
  readonly moves: number;
  readonly volumeUtilization: number;
}

export interface SimulationScenarioParameters {
  readonly groupSameSku: boolean;
  readonly preferLowerLevelsForHeavyCartons: boolean;
  readonly minimizeDispatchDistance: boolean;
  readonly minimizeMoves: boolean;
  readonly improveVolumeUtilization: boolean;
  readonly equipmentType: SimulationEquipmentType;
  readonly maxBatchWeightKg: number;
  readonly maxBatchVolumeM3: number;
  readonly maxCartonsPerBatch: number;
  readonly objectiveWeights: SimulationObjectiveWeights;
  readonly aisleFilter: readonly string[] | null;
  readonly levelFilter: readonly string[] | null;
}

export interface SimulationScenarioInput extends SimulationScenarioParameters {
  readonly name: string;
  readonly seed: number;
  readonly algorithmName: string;
}

export interface SimulationMetricSet {
  readonly totalDispatchDistance: number;
  readonly averageDispatchDistance: number;
  readonly weightUtilizationPercent: number | null;
  readonly volumeUtilizationPercent: number;
  readonly usedLocationCount: number;
  readonly splitSkuCount: number;
  readonly movedCartonCount: number;
  readonly unplacedCartonCount: number;
  readonly objectiveScore: number;
}

export interface SimulationScenarioResult {
  readonly current: SimulationMetricSet;
  readonly proposed: SimulationMetricSet;
  readonly objectiveImprovementPercent: number | null;
  readonly estimatedDurationSeconds: number;
  readonly totalMovementDistanceM: number;
}

export interface SimulationScenario {
  readonly id: number;
  readonly name: string;
  readonly seed: number;
  readonly algorithmName: string;
  readonly status: SimulationScenarioStatus;
  readonly progressPercent: number;
  readonly parameters: SimulationScenarioParameters;
  readonly result: SimulationScenarioResult | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly errorMessage: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SimulationPathPoint {
  readonly sequence: number;
  readonly nodeId: string;
  readonly x: number;
  readonly y: number;
}

export interface SimulationMove {
  readonly id: number;
  readonly sequence: number;
  readonly resultStatus: SimulationAssignmentStatus;
  readonly cartonId: number;
  readonly cartonNumber: string;
  readonly productId: number;
  readonly sku: string;
  readonly fromLocationId: number | null;
  readonly toLocationId: number | null;
  readonly fromPositionXCm: number | null;
  readonly fromPositionYCm: number | null;
  readonly fromPositionZCm: number | null;
  readonly fromRotationDegrees: number | null;
  readonly proposedPositionXCm: number | null;
  readonly proposedPositionYCm: number | null;
  readonly proposedPositionZCm: number | null;
  readonly proposedRotationDegrees: number | null;
  readonly assignmentScore: number | null;
  readonly estimatedDurationSeconds: number | null;
  readonly travelDistanceM: number | null;
  readonly path: readonly SimulationPathPoint[];
  readonly reasons: readonly string[];
  readonly unplacedReason: string | null;
}

export interface SimulationMoveList {
  readonly scenarioId: number;
  readonly moveCount: number;
  readonly unplacedCount: number;
  readonly moves: readonly SimulationMove[];
}

export interface SimulationMoveBatchStop {
  readonly sequence: number;
  readonly type: SimulationMoveBatchStopType;
  readonly locationId: number;
  readonly cartonIds: readonly number[];
}

export interface SimulationMoveBatchItem {
  readonly moveSequence: number;
  readonly cartonId: number;
  readonly cartonNumber: string;
  readonly sku: string;
  readonly weightKg: number;
  readonly volumeM3: number;
  readonly fromLocationId: number | null;
  readonly toLocationId: number;
}

export interface SimulationMoveBatchValidation {
  readonly moveSequence: number;
  readonly cartonId: number;
  readonly code: SimulationMoveBatchValidationCode;
  readonly message: string;
}

export interface SimulationMoveBatch {
  readonly sequence: number;
  readonly equipmentType: SimulationEquipmentType;
  readonly cartonCount: number;
  readonly totalWeightKg: number;
  readonly totalVolumeM3: number;
  readonly estimatedDistanceM: number;
  readonly estimatedDurationSeconds: number;
  readonly capacityUtilizationPercent: number;
  readonly moveSequences: readonly number[];
  readonly items: readonly SimulationMoveBatchItem[];
  readonly stops: readonly SimulationMoveBatchStop[];
  readonly reasons: readonly string[];
  readonly requiresStagingBuffer: boolean;
}

export interface SimulationMoveBatchList {
  readonly scenarioId: number;
  readonly equipmentType: SimulationEquipmentType;
  readonly batchCount: number;
  readonly cartonMoveCount: number;
  readonly operationalDistanceM: number;
  readonly individualDistanceM: number;
  readonly estimatedDurationSeconds: number;
  readonly capacityUtilizationPercent: number;
  readonly requiresStagingBuffer: boolean;
  readonly stagingMoveSequences: readonly number[];
  readonly batches: readonly SimulationMoveBatch[];
  readonly unbatchedItems: readonly SimulationMoveBatchItem[];
  readonly validationErrors: readonly SimulationMoveBatchValidation[];
}

export interface SimulationBatchAnimationWaypoint {
  readonly sequence: number;
  readonly nodeId: string;
  readonly xM: number;
  readonly yM: number;
  readonly zM: number;
  readonly cumulativeDistanceM: number;
  readonly elapsedSeconds: number;
}

export interface SimulationBatchAnimationEvent {
  readonly sequence: number;
  readonly type: SimulationBatchAnimationEventType;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly locationId: number | null;
  readonly cartonIds: readonly number[];
  readonly waypoints: readonly SimulationBatchAnimationWaypoint[];
}

export interface SimulationBatchAnimation {
  readonly scenarioId: number;
  readonly batchSequence: number;
  readonly equipmentType: SimulationEquipmentType;
  readonly sourceSceneStep: number;
  readonly targetSceneStep: number;
  readonly routeDistanceM: number;
  readonly estimatedDurationSeconds: number;
  readonly events: readonly SimulationBatchAnimationEvent[];
}
