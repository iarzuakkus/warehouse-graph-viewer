export type SimulationScenarioStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type SimulationAssignmentStatus = "placed" | "unplaced";

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
