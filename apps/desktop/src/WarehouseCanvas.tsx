import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import type {
  Rack,
  StorageHierarchy,
  WarehouseMap,
} from "@warehouse/domain";
import {
  createNavigatedViewportTransform,
  createStorageSchematic,
  createViewportTransform,
  findStorageBayAtPoint,
  rackToScreenRect,
  screenToWorld,
  worldToScreen,
  type ScreenPan,
  type StorageBayBlock,
  type ViewportTransform,
} from "@warehouse/rendering-2d";

interface WarehouseCanvasProps {
  readonly map: WarehouseMap;
  readonly hierarchy: StorageHierarchy | null;
  readonly selectedBayKey: string | null;
  readonly onBaySelect: (aisleCode: string, bayCode: string) => void;
}

interface ViewState {
  readonly zoom: number;
  readonly pan: ScreenPan;
}

interface DragState {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly originPan: ScreenPan;
  moved: boolean;
}

const VIEWPORT_PADDING = 42;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const DEFAULT_VIEW: ViewState = { zoom: 1, pan: { x: 0, y: 0 } };

export function WarehouseCanvas({
  map,
  hierarchy,
  selectedBayKey,
  onBaySelect,
}: WarehouseCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setView(DEFAULT_VIEW);
  }, [hierarchy]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (container === null || canvas === null) return;

    const draw = () =>
      drawContent(canvas, container, map, hierarchy, selectedBayKey, view);
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(container);
    draw();

    return () => resizeObserver.disconnect();
  }, [hierarchy, map, selectedBayKey, view]);

  const changeZoom = (factor: number): void => {
    setView((current) => ({
      ...current,
      zoom: clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM),
    }));
  };

  const handleWheel = (event: ReactWheelEvent<HTMLCanvasElement>): void => {
    if (hierarchy === null) return;
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): void => {
    if (hierarchy === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originPan: view.pan,
      moved: false,
    };
    setDragging(true);
  };

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): void => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) drag.moved = true;

    setView((current) => ({
      ...current,
      pan: {
        x: drag.originPan.x + deltaX,
        y: drag.originPan.y + deltaY,
      },
    }));
  };

  const handlePointerUp = (
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): void => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;

    if (!drag.moved) selectBayAtPointer(event, hierarchy, view, onBaySelect);
    dragRef.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <section className="canvas-panel" aria-label="2D depo haritasi">
      <div className="canvas-container" ref={containerRef}>
        <div className="canvas-toolbar" aria-label="Harita kontrolleri">
          <button type="button" onClick={() => changeZoom(1 / 1.2)}>−</button>
          <span>{Math.round(view.zoom * 100)}%</span>
          <button type="button" onClick={() => changeZoom(1.2)}>+</button>
          <button type="button" onClick={() => setView(DEFAULT_VIEW)}>
            Sığdır
          </button>
        </div>
        <canvas
          className={`warehouse-canvas${dragging ? " is-dragging" : ""}`}
          ref={canvasRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            dragRef.current = null;
            setDragging(false);
          }}
        />
        {hierarchy !== null && hierarchy.aisles.length === 0 ? (
          <div className="canvas-empty">Aramayla eşleşen koridor bulunamadı.</div>
        ) : null}
      </div>
      <div className="canvas-status">
        {hierarchy === null ? (
          <>
            <span>{map.width} × {map.depth} m</span>
            <span>{map.racks.length} raf</span>
          </>
        ) : (
          <>
            <span>Şematik raf yerleşimi</span>
            <span>{hierarchy.aisles.length} koridor · {hierarchy.locationCount} lokasyon</span>
          </>
        )}
      </div>
    </section>
  );
}

function selectBayAtPointer(
  event: ReactPointerEvent<HTMLCanvasElement>,
  hierarchy: StorageHierarchy | null,
  view: ViewState,
  onBaySelect: (aisleCode: string, bayCode: string) => void,
): void {
  if (hierarchy === null) return;
  const bounds = event.currentTarget.getBoundingClientRect();
  const schematic = createStorageSchematic(hierarchy);
  const transform = getSchematicTransform(
    hierarchy,
    bounds.width,
    bounds.height,
    view,
  );
  const point = screenToWorld(
    { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
    transform,
  );
  const block = findStorageBayAtPoint(schematic, point);
  if (block !== null) onBaySelect(block.aisleCode, block.bayCode);
}

function drawContent(
  canvas: HTMLCanvasElement,
  container: HTMLDivElement,
  map: WarehouseMap,
  hierarchy: StorageHierarchy | null,
  selectedBayKey: string | null,
  view: ViewState,
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
  const background = context.createLinearGradient(0, 0, 0, bounds.height);
  background.addColorStop(0, "#fbfcfe");
  background.addColorStop(1, "#eef2f7");
  context.fillStyle = background;
  context.fillRect(0, 0, bounds.width, bounds.height);

  if (hierarchy !== null) {
    drawStorageSchematic(
      context,
      hierarchy,
      bounds.width,
      bounds.height,
      selectedBayKey,
      view,
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
  for (const rack of map.racks) drawRack(context, rack, transform);
}

function getSchematicTransform(
  hierarchy: StorageHierarchy,
  screenWidth: number,
  screenHeight: number,
  view: ViewState,
): ViewportTransform {
  const schematic = createStorageSchematic(hierarchy);
  const baseTransform = createViewportTransform(
    schematic.width,
    schematic.depth,
    screenWidth,
    screenHeight,
    VIEWPORT_PADDING,
  );
  return createNavigatedViewportTransform(
    baseTransform,
    schematic.width,
    schematic.depth,
    screenWidth,
    screenHeight,
    view.zoom,
    view.pan,
  );
}

function drawStorageSchematic(
  context: CanvasRenderingContext2D,
  hierarchy: StorageHierarchy,
  screenWidth: number,
  screenHeight: number,
  selectedBayKey: string | null,
  view: ViewState,
): void {
  const schematic = createStorageSchematic(hierarchy);
  const transform = getSchematicTransform(
    hierarchy,
    screenWidth,
    screenHeight,
    view,
  );

  context.save();
  context.shadowColor = "rgb(31 47 78 / 8%)";
  context.shadowBlur = 18;
  context.shadowOffsetY = 7;
  context.fillStyle = "#ffffff";
  context.fillRect(
    transform.offsetX,
    transform.offsetY,
    schematic.width * transform.scale,
    schematic.depth * transform.scale,
  );
  context.restore();

  for (const aisle of schematic.aisleLabels) {
    const labelPoint = worldToScreen({ x: aisle.centerX, y: 2.7 }, transform);
    const rackScreenWidth = 6 * transform.scale;
    const labelWidth = clamp(rackScreenWidth - 8, 24, 64);
    const labelHeight = labelWidth < 38 ? 19 : 25;
    context.save();
    context.shadowColor = "rgb(33 48 74 / 10%)";
    context.shadowBlur = 8;
    context.shadowOffsetY = 3;
    context.fillStyle = "#ffffff";
    roundedRect(
      context,
      labelPoint.x - labelWidth / 2,
      labelPoint.y - labelHeight / 2,
      labelWidth,
      labelHeight,
      6,
    );
    context.fill();
    context.restore();
    context.strokeStyle = "#e5e9f0";
    context.lineWidth = 1;
    roundedRect(
      context,
      labelPoint.x - labelWidth / 2,
      labelPoint.y - labelHeight / 2,
      labelWidth,
      labelHeight,
      6,
    );
    context.stroke();
    context.fillStyle = "#33415b";
    context.font = `700 ${labelWidth < 38 ? 8 : 11}px Inter, system-ui, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      fitCanvasText(
        context,
        aisle.code.replace(/^SYN-/i, ""),
        Math.max(10, labelWidth - 8),
      ),
      labelPoint.x,
      labelPoint.y,
    );
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

  context.save();
  context.shadowColor = selected
    ? "rgb(99 91 255 / 38%)"
    : "rgb(37 49 83 / 16%)";
  context.shadowBlur = selected ? 13 : 5;
  context.shadowOffsetY = 2;
  const rackGradient = context.createLinearGradient(
    position.x,
    position.y,
    position.x + width,
    position.y + height,
  );
  rackGradient.addColorStop(0, selected ? "#7a73ff" : "#6379a9");
  rackGradient.addColorStop(1, selected ? "#5148e5" : "#344a77");
  context.fillStyle = rackGradient;
  context.fillRect(position.x, position.y, width, height);
  context.restore();
  context.strokeStyle = selected ? "#635bff" : "#2b4069";
  context.lineWidth = selected ? 3 : 1.4;
  context.strokeRect(position.x, position.y, width, height);

  context.strokeStyle = "rgb(255 255 255 / 18%)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(position.x + 7, position.y + 3);
  context.lineTo(position.x + width - 4, position.y + 3);
  context.stroke();

  const statusWidth = clamp(width * 0.055, 3, 5);
  context.fillStyle =
    activeRatio === 1 ? "#20c779" : activeRatio === 0 ? "#eb5757" : "#f2a51a";
  context.fillRect(position.x, position.y, statusWidth, height);

  const textLeft = position.x + statusWidth;
  const textWidth = Math.max(0, width - statusWidth);
  const textCenterX = textLeft + textWidth / 2;
  const primaryFontSize = clamp(height * 0.27, 7, 11);
  const secondaryFontSize = clamp(height * 0.2, 6, 9);
  const fullDetail = `${block.levelCount} seviye · ${block.locationCount} lokasyon`;
  const compactDetail = `${block.levelCount}S · ${block.locationCount}L`;

  context.save();
  context.beginPath();
  context.rect(textLeft + 2, position.y, Math.max(0, textWidth - 4), height);
  context.clip();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `700 ${primaryFontSize}px Inter, system-ui, sans-serif`;

  const detailLabel = chooseBayDetailLabel(
    context,
    fullDetail,
    compactDetail,
    Math.max(0, textWidth - 10),
    height,
    secondaryFontSize,
  );
  context.fillStyle = "#ffffff";
  context.fillText(
    fitCanvasText(context, block.bayCode, Math.max(0, textWidth - 10)),
    textCenterX,
    position.y + height * (detailLabel === null ? 0.52 : 0.36),
  );

  if (detailLabel !== null) {
    context.fillStyle = "#e6ebff";
    context.font = `500 ${secondaryFontSize}px Inter, system-ui, sans-serif`;
    context.fillText(detailLabel, textCenterX, position.y + height * 0.7);
  }
  context.restore();
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
  context.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
  context.strokeStyle = "#1e3a8a";
  context.lineWidth = 1.5;
  context.strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.roundRect(x, y, width, height, safeRadius);
}

function chooseBayDetailLabel(
  context: CanvasRenderingContext2D,
  fullLabel: string,
  compactLabel: string,
  availableWidth: number,
  height: number,
  fontSize: number,
): string | null {
  if (height < 22 || availableWidth < 22) return null;

  context.save();
  context.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
  const result = height >= 30 && context.measureText(fullLabel).width <= availableWidth
    ? fullLabel
    : context.measureText(compactLabel).width <= availableWidth
      ? compactLabel
      : null;
  context.restore();
  return result;
}

function fitCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  availableWidth: number,
): string {
  if (availableWidth <= 0) return "";
  if (context.measureText(text).width <= availableWidth) return text;

  let shortened = text;
  while (
    shortened.length > 1 &&
    context.measureText(`${shortened}…`).width > availableWidth
  ) {
    shortened = shortened.slice(0, -1);
  }
  return shortened.length > 1 ? `${shortened}…` : "";
}
