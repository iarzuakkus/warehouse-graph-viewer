import { describe, expect, it } from "vitest";

import type { SimulationBatchAnimation } from "@warehouse/domain";

import {
  calculateSimulationEquipmentPose,
} from "../src/index.js";

const animation: SimulationBatchAnimation = {
  scenarioId: 12,
  batchSequence: 3,
  equipmentType: "forklift",
  sourceSceneStep: 2,
  targetSceneStep: 3,
  routeDistanceM: 22,
  estimatedDurationSeconds: 20,
  events: [
    {
      sequence: 1,
      type: "travel",
      startSeconds: 0,
      endSeconds: 10,
      locationId: null,
      cartonIds: [],
      waypoints: [
        {
          sequence: 1,
          nodeId: "DISPATCH",
          xM: 0,
          yM: 2,
          zM: 0,
          cumulativeDistanceM: 0,
          elapsedSeconds: 0,
        },
        {
          sequence: 2,
          nodeId: "L-10",
          xM: 10,
          yM: 6,
          zM: 2,
          cumulativeDistanceM: 12,
          elapsedSeconds: 10,
        },
      ],
    },
    {
      sequence: 2,
      type: "pickup",
      startSeconds: 10,
      endSeconds: 15,
      locationId: 10,
      cartonIds: [205],
      waypoints: [],
    },
    {
      sequence: 3,
      type: "travel",
      startSeconds: 15,
      endSeconds: 20,
      locationId: null,
      cartonIds: [205],
      waypoints: [
        {
          sequence: 1,
          nodeId: "L-10",
          xM: 10,
          yM: 6,
          zM: 2,
          cumulativeDistanceM: 12,
          elapsedSeconds: 15,
        },
        {
          sequence: 2,
          nodeId: "L-22",
          xM: 10,
          yM: 16,
          zM: 2,
          cumulativeDistanceM: 22,
          elapsedSeconds: 20,
        },
      ],
    },
  ],
};

const loadAnimation: SimulationBatchAnimation = {
  ...animation,
  estimatedDurationSeconds: 8,
  events: [
    {
      sequence: 1,
      type: "travel",
      startSeconds: 0,
      endSeconds: 1,
      locationId: null,
      cartonIds: [],
      waypoints: [],
    },
    {
      sequence: 2,
      type: "pickup",
      startSeconds: 1,
      endSeconds: 2,
      locationId: 10,
      cartonIds: [101],
      waypoints: [],
    },
    {
      sequence: 3,
      type: "pickup",
      startSeconds: 2,
      endSeconds: 3,
      locationId: 11,
      cartonIds: [102, 103],
      waypoints: [],
    },
    {
      sequence: 4,
      type: "travel",
      startSeconds: 3,
      endSeconds: 4,
      locationId: null,
      cartonIds: [101, 102, 103],
      waypoints: [],
    },
    {
      sequence: 5,
      type: "dropoff",
      startSeconds: 4,
      endSeconds: 5,
      locationId: 20,
      cartonIds: [102],
      waypoints: [],
    },
    {
      sequence: 6,
      type: "staging_pickup",
      startSeconds: 5,
      endSeconds: 6,
      locationId: null,
      cartonIds: [104],
      waypoints: [],
    },
    {
      sequence: 7,
      type: "staging_dropoff",
      startSeconds: 6,
      endSeconds: 7,
      locationId: null,
      cartonIds: [101],
      waypoints: [],
    },
    {
      sequence: 8,
      type: "dropoff",
      startSeconds: 7,
      endSeconds: 8,
      locationId: 21,
      cartonIds: [103, 104],
      waypoints: [],
    },
  ],
};

describe("calculateSimulationEquipmentPose", () => {
  it("interpolates the position and converts backend axes to scene axes", () => {
    const pose = calculateSimulationEquipmentPose(animation, 5);

    expect(pose.position).toEqual({ x: 5, y: 1, z: 4 });
    expect(pose.headingRadians).toBeCloseTo(Math.atan2(10, 4));
    expect(pose.eventType).toBe("travel");
    expect(pose.progressPercent).toBe(25);
    expect(pose.isComplete).toBe(false);
  });

  it("holds the last travel pose during pickup and dropoff events", () => {
    const pose = calculateSimulationEquipmentPose(animation, 12);

    expect(pose.position).toEqual({ x: 10, y: 2, z: 6 });
    expect(pose.headingRadians).toBeCloseTo(Math.atan2(10, 4));
    expect(pose.eventSequence).toBe(2);
    expect(pose.eventType).toBe("pickup");
    expect(pose.cartonIds).toEqual([205]);
  });

  it("clamps negative time to the animation start", () => {
    const pose = calculateSimulationEquipmentPose(animation, -5);

    expect(pose.elapsedSeconds).toBe(0);
    expect(pose.position).toEqual({ x: 0, y: 0, z: 2 });
    expect(pose.progressPercent).toBe(0);
    expect(pose.isComplete).toBe(false);
  });

  it("clamps excess time to the final waypoint and completes", () => {
    const pose = calculateSimulationEquipmentPose(animation, 25);

    expect(pose.elapsedSeconds).toBe(20);
    expect(pose.position).toEqual({ x: 10, y: 2, z: 16 });
    expect(pose.headingRadians).toBeCloseTo(0);
    expect(pose.progressPercent).toBe(100);
    expect(pose.isComplete).toBe(true);
  });

  it("accumulates cartons across pickup events and keeps the travel load", () => {
    expect(
      calculateSimulationEquipmentPose(loadAnimation, 0.5).carriedCartonIds,
    ).toEqual([]);
    expect(
      calculateSimulationEquipmentPose(loadAnimation, 1.5).carriedCartonIds,
    ).toEqual([101]);
    expect(
      calculateSimulationEquipmentPose(loadAnimation, 2.5).carriedCartonIds,
    ).toEqual([101, 102, 103]);
    expect(
      calculateSimulationEquipmentPose(loadAnimation, 3.5).carriedCartonIds,
    ).toEqual([101, 102, 103]);
  });

  it("removes delivered cartons and supports staging load events", () => {
    expect(
      calculateSimulationEquipmentPose(loadAnimation, 4.5).carriedCartonIds,
    ).toEqual([101, 103]);
    expect(
      calculateSimulationEquipmentPose(loadAnimation, 5.5).carriedCartonIds,
    ).toEqual([101, 103, 104]);
    expect(
      calculateSimulationEquipmentPose(loadAnimation, 6.5).carriedCartonIds,
    ).toEqual([103, 104]);
    expect(
      calculateSimulationEquipmentPose(loadAnimation, 7.5).carriedCartonIds,
    ).toEqual([]);
  });

  it("rejects non-finite time and an empty timeline", () => {
    expect(() =>
      calculateSimulationEquipmentPose(animation, Number.NaN)
    ).toThrow(RangeError);
    expect(() =>
      calculateSimulationEquipmentPose({ ...animation, events: [] }, 0)
    ).toThrow("Animation must contain at least one event");
  });
});
