import type {
  SimulationBatchAnimation,
  SimulationBatchAnimationEvent,
  SimulationBatchAnimationEventType,
  SimulationBatchAnimationWaypoint,
} from "@warehouse/domain";

import type { Point3D } from "./scene-model.js";

export interface SimulationEquipmentPose {
  readonly position: Point3D | null;
  readonly headingRadians: number;
  readonly elapsedSeconds: number;
  readonly progressPercent: number;
  readonly eventSequence: number;
  readonly eventType: SimulationBatchAnimationEventType;
  readonly cartonIds: readonly number[];
  readonly carriedCartonIds: readonly number[];
  readonly isComplete: boolean;
}

export function calculateSimulationEquipmentPose(
  animation: SimulationBatchAnimation,
  elapsedSeconds: number,
): SimulationEquipmentPose {
  if (!Number.isFinite(elapsedSeconds)) {
    throw new RangeError("Animation elapsed time must be finite.");
  }
  if (animation.events.length === 0) {
    throw new RangeError("Animation must contain at least one event.");
  }

  const duration = animation.estimatedDurationSeconds;
  const clampedElapsedSeconds = Math.min(
    Math.max(elapsedSeconds, 0),
    duration,
  );
  const eventIndex = activeEventIndex(
    animation.events,
    clampedElapsedSeconds,
  );
  const event = animation.events[eventIndex]!;
  const travelPose = event.type === "travel"
    ? poseAlongWaypoints(event.waypoints, clampedElapsedSeconds)
    : null;
  const stationaryPose = travelPose ?? stationaryEventPose(
    animation.events,
    eventIndex,
  );

  return {
    position: stationaryPose?.position ?? null,
    headingRadians: stationaryPose?.headingRadians ?? 0,
    elapsedSeconds: clampedElapsedSeconds,
    progressPercent: duration === 0
      ? 100
      : (clampedElapsedSeconds / duration) * 100,
    eventSequence: event.sequence,
    eventType: event.type,
    cartonIds: event.cartonIds,
    carriedCartonIds: carriedCartonsAtEvent(animation.events, eventIndex),
    isComplete: clampedElapsedSeconds >= duration,
  };
}

function carriedCartonsAtEvent(
  events: readonly SimulationBatchAnimationEvent[],
  eventIndex: number,
): readonly number[] {
  const carriedCartons = new Set<number>();
  for (let index = 0; index <= eventIndex; index += 1) {
    const event = events[index]!;
    if (event.type === "travel") {
      carriedCartons.clear();
      event.cartonIds.forEach((cartonId) => carriedCartons.add(cartonId));
      continue;
    }
    if (event.type === "pickup" || event.type === "staging_pickup") {
      event.cartonIds.forEach((cartonId) => carriedCartons.add(cartonId));
      continue;
    }
    if (event.type === "dropoff" || event.type === "staging_dropoff") {
      event.cartonIds.forEach((cartonId) => carriedCartons.delete(cartonId));
    }
  }
  return [...carriedCartons];
}

function activeEventIndex(
  events: readonly SimulationBatchAnimationEvent[],
  elapsedSeconds: number,
): number {
  let activeIndex = 0;
  for (const [index, event] of events.entries()) {
    if (event.startSeconds > elapsedSeconds) break;
    activeIndex = index;
  }
  return activeIndex;
}

function poseAlongWaypoints(
  waypoints: readonly SimulationBatchAnimationWaypoint[],
  elapsedSeconds: number,
): PositionedHeading | null {
  const first = waypoints[0];
  if (first === undefined) return null;
  if (waypoints.length === 1) {
    return { position: worldPosition(first), headingRadians: 0 };
  }

  if (elapsedSeconds <= first.elapsedSeconds) {
    return headingBetween(first, waypoints[1]!);
  }

  for (let index = 1; index < waypoints.length; index += 1) {
    const previous = waypoints[index - 1]!;
    const next = waypoints[index]!;
    if (elapsedSeconds > next.elapsedSeconds) continue;

    const segmentDuration = next.elapsedSeconds - previous.elapsedSeconds;
    const progress = segmentDuration === 0
      ? 1
      : (elapsedSeconds - previous.elapsedSeconds) / segmentDuration;
    return {
      position: interpolatePosition(previous, next, progress),
      headingRadians: headingRadians(previous, next),
    };
  }

  return headingBetween(
    waypoints[waypoints.length - 2]!,
    waypoints[waypoints.length - 1]!,
    true,
  );
}

function stationaryEventPose(
  events: readonly SimulationBatchAnimationEvent[],
  eventIndex: number,
): PositionedHeading | null {
  for (let index = eventIndex - 1; index >= 0; index -= 1) {
    const waypoints = events[index]!.waypoints;
    if (waypoints.length === 0) continue;
    return finalWaypointPose(waypoints);
  }

  for (let index = eventIndex + 1; index < events.length; index += 1) {
    const waypoints = events[index]!.waypoints;
    if (waypoints.length === 0) continue;
    return initialWaypointPose(waypoints);
  }

  return null;
}

interface PositionedHeading {
  readonly position: Point3D;
  readonly headingRadians: number;
}

function initialWaypointPose(
  waypoints: readonly SimulationBatchAnimationWaypoint[],
): PositionedHeading {
  const first = waypoints[0]!;
  const second = waypoints[1];
  return second === undefined
    ? { position: worldPosition(first), headingRadians: 0 }
    : headingBetween(first, second);
}

function finalWaypointPose(
  waypoints: readonly SimulationBatchAnimationWaypoint[],
): PositionedHeading {
  const last = waypoints[waypoints.length - 1]!;
  const previous = waypoints[waypoints.length - 2];
  return previous === undefined
    ? { position: worldPosition(last), headingRadians: 0 }
    : headingBetween(previous, last, true);
}

function headingBetween(
  from: SimulationBatchAnimationWaypoint,
  to: SimulationBatchAnimationWaypoint,
  useDestination = false,
): PositionedHeading {
  return {
    position: worldPosition(useDestination ? to : from),
    headingRadians: headingRadians(from, to),
  };
}

function interpolatePosition(
  from: SimulationBatchAnimationWaypoint,
  to: SimulationBatchAnimationWaypoint,
  progress: number,
): Point3D {
  return {
    x: interpolate(from.xM, to.xM, progress),
    y: interpolate(from.zM, to.zM, progress),
    z: interpolate(from.yM, to.yM, progress),
  };
}

function worldPosition(
  waypoint: SimulationBatchAnimationWaypoint,
): Point3D {
  return {
    x: waypoint.xM,
    y: waypoint.zM,
    z: waypoint.yM,
  };
}

function headingRadians(
  from: SimulationBatchAnimationWaypoint,
  to: SimulationBatchAnimationWaypoint,
): number {
  return Math.atan2(to.xM - from.xM, to.yM - from.yM);
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * Math.min(Math.max(progress, 0), 1);
}
