import { describe, expect, it } from "vitest";

import type { Rack } from "@warehouse/domain";

import {
  ViewportValidationError,
  createNavigatedViewportTransform,
  createViewportTransform,
  rackToScreenRect,
  screenToWorld,
  worldToScreen,
} from "../src/index.js";

describe("2D viewport calculations", () => {
  it("converts warehouse meters to screen pixels", () => {
    const transform = createViewportTransform(30, 20, 800, 600, 50);

    expect(worldToScreen({ x: 0, y: 0 }, transform)).toEqual({
      x: transform.offsetX,
      y: transform.offsetY,
    });
    expect(worldToScreen({ x: 30, y: 20 }, transform)).toEqual({
      x: transform.offsetX + 30 * transform.scale,
      y: transform.offsetY + 20 * transform.scale,
    });
  });

  it("converts a screen point back to the same warehouse point", () => {
    const transform = createViewportTransform(30, 20, 800, 600, 50);
    const warehousePoint = { x: 12.5, y: 7.25 };

    const screenPoint = worldToScreen(warehousePoint, transform);
    const restoredPoint = screenToWorld(screenPoint, transform);

    expect(restoredPoint.x).toBeCloseTo(warehousePoint.x);
    expect(restoredPoint.y).toBeCloseTo(warehousePoint.y);
  });

  it("centers the warehouse while preserving its aspect ratio", () => {
    const transform = createViewportTransform(30, 20, 800, 600, 50);
    const drawnWidth = 30 * transform.scale;
    const drawnHeight = 20 * transform.scale;

    expect(transform.offsetX).toBeCloseTo((800 - drawnWidth) / 2);
    expect(transform.offsetY).toBeCloseTo((600 - drawnHeight) / 2);
    expect(drawnWidth / drawnHeight).toBeCloseTo(30 / 20);
  });

  it("adapts its scale when the screen size changes", () => {
    const small = createViewportTransform(30, 20, 600, 400, 40);
    const large = createViewportTransform(30, 20, 1200, 800, 40);

    expect(large.scale).toBeGreaterThan(small.scale);
  });

  it("uses the rotated rack footprint when creating a screen rectangle", () => {
    const rack: Rack = {
      id: "rack-1",
      name: "Raf 1",
      position: { x: 5, y: 4 },
      size: { width: 6, depth: 1, height: 3 },
      rotation: 90,
      locationIds: [101],
    };
    const transform = createViewportTransform(30, 20, 800, 600, 50);
    const rectangle = rackToScreenRect(rack, transform);

    expect(rectangle.width).toBeCloseTo(1 * transform.scale);
    expect(rectangle.height).toBeCloseTo(6 * transform.scale);
  });

  it("rejects padding that leaves no drawable screen area", () => {
    expect(() => createViewportTransform(30, 20, 100, 100, 50)).toThrow(
      ViewportValidationError,
    );
  });

  it("zooms around the center of the screen", () => {
    const base = createViewportTransform(30, 20, 800, 600, 50);
    const zoomed = createNavigatedViewportTransform(
      base,
      30,
      20,
      800,
      600,
      2,
      { x: 0, y: 0 },
    );

    expect(zoomed.scale).toBeCloseTo(base.scale * 2);
    expect(zoomed.offsetX + (30 * zoomed.scale) / 2).toBeCloseTo(400);
    expect(zoomed.offsetY + (20 * zoomed.scale) / 2).toBeCloseTo(300);
  });

  it("adds screen-space pan after fitting and zooming", () => {
    const base = createViewportTransform(30, 20, 800, 600, 50);
    const centered = createNavigatedViewportTransform(
      base, 30, 20, 800, 600, 1, { x: 0, y: 0 },
    );
    const panned = createNavigatedViewportTransform(
      base, 30, 20, 800, 600, 1, { x: 25, y: -10 },
    );

    expect(panned.offsetX).toBeCloseTo(centered.offsetX + 25);
    expect(panned.offsetY).toBeCloseTo(centered.offsetY - 10);
  });

  it("rejects a non-positive zoom", () => {
    const base = createViewportTransform(30, 20, 800, 600, 50);

    expect(() =>
      createNavigatedViewportTransform(
        base, 30, 20, 800, 600, 0, { x: 0, y: 0 },
      ),
    ).toThrow(ViewportValidationError);
  });
});
