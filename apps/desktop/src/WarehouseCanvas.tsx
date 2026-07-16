import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from "react";

import type {
  Rack,
  StorageHierarchy,
  WarehouseMap,
} from "@warehouse/domain";
import {
  createStorageSchematic,
  createViewportTransform,
  findStorageBayAtPoint,
  rackToScreenRect,
  screenToWorld,
  worldToScreen,
  type StorageBayBlock,
  type ViewportTransform,
} from "@warehouse/rendering-2d";

interface WarehouseCanvasProps {
  readonly map: WarehouseMap;
  readonly hierarchy: StorageHierarchy | null;
  readonly selectedBayKey: string | null;
  readonly onBaySelect: (aisleCode: string, bayCode: string) => void;
}

const VIEWPORT_PADDING = 42;

export function WarehouseCanvas({
  map,
  hierarchy,
  selectedBayKey,
  onBaySelect,
}: WarehouseCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (container === null || canvas === null) return;

    const draw = () =>
      drawContent(canvas, container, map, hierarchy, selectedBayKey);
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(container);
    draw();

    return () => resizeObserver.disconnect();
  }, [hierarchy, map, selectedBayKey]);

  const handleCanvasClick = (
    event: ReactMouseEvent<HTMLCanvasElement>,
  ): void => {
    if (hierarchy === null) return;

    const canvas = canvasRef.current;
    if (canvas === null) return;

    const bounds = canvas.getBoundingClientRect();
    const schematic = createStorageSchematic(hierarchy);
    const transform = createViewportTransform(
      schematic.width,
      schematic.depth,
      bounds.width,
      bounds.height,
      VIEWPORT_PADDING,
    );
    const point = screenToWorld(
      {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      },
      transform,
    );
    const block = findStorageBayAtPoint(schematic, point);

    if (block !== null) {
      onBaySelect(block.aisleCode, block.bayCode);
    }
  };

  return (
    <section className="canvas-panel" aria-label="2D depo haritasi">
      <div className="canvas-container" ref={containerRef}>
        <canvas
          className="warehouse-canvas"
          ref={canvasRef}
          onClick={handleCanvasClick}
        />
      </div>
      <div className="canvas-status">
        {hierarchy === null ? (
          <>
            <span>{map.width} × {map.depth} m</span>
            <span>{map.racks.length} raf</span>
          </>
        ) : (
          <>
            <span>Sematik raf yerlesimi</span>
            <span>{hierarchy.aisles.length} koridor · {hierarchy.locationCount} lokasyon</span>
          </>
        )}
      </div>
    </section>
  );
}

function drawContent(
  canvas: HTMLCanvasElement,
  container: HTMLDivElement,
  map: WarehouseMap,
  hierarchy: StorageHierarchy | null,
  selectedBayKey: string | null,
): void {
  const bounds = container.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return;

  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * pixelRatio);
  canvas.height = Math.round(bounds.height * pixelRatio);
  canvas.style.width = `${bounds.width}px`;
  canvas.style.height = `${bounds.height}px`;

  const context = canvas.getContext("2d");
  if (context === null) return;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, bounds.width, bounds.height);
  context.fillStyle = "#e8edf4";
  context.fillRect(0, 0, bounds.width, bounds.height);

  if (hierarchy !== null) {
    drawStorageSchematic(
      context,
      hierarchy,
      bounds.width,
      bounds.height,
      selectedBayKey,
    );
    return;
  }

  const transform = createViewportTransform(
    map.width,
    map.depth,
    bounds.width,
    bounds.height,
    VIEWPORT_PADDING,
  );

  drawWarehouseFloor(context, map, transform);
  drawGrid(context, map, transform);

  for (const rack of map.racks) {
    drawRack(context, rack, transform);
  }
}

function drawStorageSchematic(
  context: CanvasRenderingContext2D,
  hierarchy: StorageHierarchy,
  screenWidth: number,
  screenHeight: number,
  selectedBayKey: string | null,
): void {
  const schematic = createStorageSchematic(hierarchy);
  const transform = createViewportTransform(
    schematic.width,
    schematic.depth,
    screenWidth,
    screenHeight,
    VIEWPORT_PADDING,
  );

  context.fillStyle = "#ffffff";
  context.fillRect(
    transform.offsetX,
    transform.offsetY,
    schematic.width * transform.scale,
    schematic.depth * transform.scale,
  );

  for (const aisle of schematic.aisleLabels) {
    const labelPoint = worldToScreen(
      { x: aisle.centerX, y: 2.7 },
      transform,
    );
    context.fillStyle = "#334155";
    context.font = "700 12px Inter, system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(aisle.code.replace("SYN-", ""), labelPoint.x, labelPoint.y);
  }

  for (const block of schematic.bayBlocks) {
    drawStorageBay(
      context,
      block,
      transform,
      `${block.aisleCode}/${block.bayCode}` === selectedBayKey,
    );
  }
}

function drawStorageBay(
  context: CanvasRenderingContext2D,
  block: StorageBayBlock,
  transform: ViewportTransform,
  selected: boolean,
): void {
  const position = worldToScreen({ x: block.x, y: block.y }, transform);
  const width = block.width * transform.scale;
  const height = block.depth * transform.scale;
  const activeRatio =
    block.locationCount === 0
      ? 0
      : block.activeLocationCount / block.locationCount;

  context.fillStyle = selected ? "#bfdbfe" : "#dbeafe";
  context.fillRect(position.x, position.y, width, height);
  context.strokeStyle = selected ? "#0f172a" : "#1d4ed8";
  context.lineWidth = selected ? 3 : 1.5;
  context.strokeRect(position.x, position.y, width, height);

  context.fillStyle = activeRatio === 1 ? "#22c55e" : "#f59e0b";
  context.fillRect(position.x, position.y, 5, height);

  context.fillStyle = "#1e3a8a";
  context.font = "700 11px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    block.bayCode,
    position.x + width / 2,
    position.y + height * 0.38,
  );

  context.fillStyle = "#64748b";
  context.font = "500 9px Inter, system-ui, sans-serif";
  context.fillText(
    `${block.levelCount} seviye · ${block.locationCount} lokasyon`,
    position.x + width / 2,
    position.y + height * 0.68,
  );
}

function drawWarehouseFloor(
  context: CanvasRenderingContext2D,
  map: WarehouseMap,
  transform: ViewportTransform,
): void {
  const width = map.width * transform.scale;
  const height = map.depth * transform.scale;

  context.fillStyle = "#ffffff";
  context.fillRect(transform.offsetX, transform.offsetY, width, height);
  context.strokeStyle = "#475569";
  context.lineWidth = 2;
  context.strokeRect(transform.offsetX, transform.offsetY, width, height);
}

function drawGrid(
  context: CanvasRenderingContext2D,
  map: WarehouseMap,
  transform: ViewportTransform,
): void {
  context.save();
  context.strokeStyle = "#dbe2ea";
  context.lineWidth = 1;

  for (let x = 1; x < map.width; x += 1) {
    const screenX = transform.offsetX + x * transform.scale;
    context.beginPath();
    context.moveTo(screenX, transform.offsetY);
    context.lineTo(screenX, transform.offsetY + map.depth * transform.scale);
    context.stroke();
  }

  for (let y = 1; y < map.depth; y += 1) {
    const screenY = transform.offsetY + y * transform.scale;
    context.beginPath();
    context.moveTo(transform.offsetX, screenY);
    context.lineTo(transform.offsetX + map.width * transform.scale, screenY);
    context.stroke();
  }

  context.restore();
}

function drawRack(
  context: CanvasRenderingContext2D,
  rack: Rack,
  transform: ViewportTransform,
): void {
  const rectangle = rackToScreenRect(rack, transform);

  context.fillStyle = "#2563eb";
  context.fillRect(
    rectangle.x,
    rectangle.y,
    rectangle.width,
    rectangle.height,
  );
  context.strokeStyle = "#1e3a8a";
  context.lineWidth = 1.5;
  context.strokeRect(
    rectangle.x,
    rectangle.y,
    rectangle.width,
    rectangle.height,
  );

  context.fillStyle = "#ffffff";
  context.font = "600 12px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    rack.name,
    rectangle.x + rectangle.width / 2,
    rectangle.y + rectangle.height / 2,
    Math.max(0, rectangle.width - 8),
  );
}
