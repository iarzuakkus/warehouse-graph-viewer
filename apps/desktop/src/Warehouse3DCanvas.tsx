import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import type {
  SimulationEquipmentType,
  StorageHierarchy,
  WarehouseRackScene,
  WarehouseRackSceneCarton,
  WarehouseRackSceneLocation,
  WarehouseRackSummary,
} from "@warehouse/domain";
import {
  createWarehouseSceneModel,
  type RackSceneNode,
  type SimulationEquipmentPose,
  type WarehouseSceneModel,
} from "@warehouse/rendering-3d";

interface Warehouse3DCanvasProps {
  readonly hierarchy: StorageHierarchy | null;
  readonly rackSummaries: readonly WarehouseRackSummary[];
  readonly rackScene?: readonly WarehouseRackScene[];
  readonly equipmentPose?: SimulationEquipmentPose | null;
  readonly equipmentRoute?: readonly Warehouse3DRoutePoint[];
  readonly equipmentType?: SimulationEquipmentType;
  readonly onSelect?: (selection: Warehouse3DSelection | null) => void;
}

export interface Warehouse3DRoutePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Warehouse3DCartonSelection {
  readonly kind: "carton";
  readonly aisleCode: string;
  readonly bayCode: string;
  readonly locationId: number;
  readonly level: string;
  readonly slot: string;
  readonly cartonId: number;
  readonly cartonNumber: string;
  readonly cartonTypeCode: string;
}

export interface Warehouse3DRackSelection {
  readonly kind: "rack";
  readonly rackId: string;
  readonly aisleCode: string;
  readonly bayCode: string;
}

export type Warehouse3DSelection =
  | Warehouse3DCartonSelection
  | Warehouse3DRackSelection;

const CENTIMETERS_PER_METER = 100;

interface PhysicalRackLayout {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly clearLevelHeight: number;
  readonly frameThickness: number;
  readonly levelCount: number;
  readonly slotsPerLevel: number;
}

interface CameraViewState {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
}

export function Warehouse3DCanvas({
  hierarchy,
  rackSummaries,
  rackScene = [],
  equipmentPose = null,
  equipmentRoute = [],
  equipmentType = "cart",
  onSelect,
}: Warehouse3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraViewRef = useRef<CameraViewState | null>(null);
  const equipmentGroupRef = useRef<THREE.Group | null>(null);
  const equipmentCargoSignatureRef = useRef("");

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || hierarchy === null) return;

    const sceneModel = createNavigationAlignedSceneModel(
      hierarchy,
      rackSummaries,
      rackScene,
    );
    const sceneRacksByKey = new Map(
      rackScene.map((rack) => [rackKey(rack.aisle, rack.bay), rack]),
    );
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f6fb);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.append(renderer.domElement);

    const camera = createCamera(sceneModel.bounds);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 3;
    controls.maxDistance = Math.max(
      20,
      Math.max(sceneModel.bounds.width, sceneModel.bounds.depth) * 4,
    );
    controls.target.set(
      sceneModel.bounds.width / 2,
      sceneModel.bounds.height / 3,
      sceneModel.bounds.depth / 2,
    );
    const savedCameraView = cameraViewRef.current;
    if (savedCameraView !== null) {
      camera.position.fromArray(savedCameraView.position);
      controls.target.fromArray(savedCameraView.target);
      controls.update();
    }

    addLighting(scene);
    addFloor(scene, sceneModel.bounds.width, sceneModel.bounds.depth);
    addEquipmentRoute(scene, equipmentRoute);
    sceneModel.racks.forEach((rack) =>
      addRack(
        scene,
        rack,
        sceneRacksByKey.get(rackKey(rack.aisleCode, rack.bayCode)),
      ),
    );
    const equipmentGroup = createEquipmentModel(equipmentType);
    equipmentGroup.visible = false;
    equipmentGroupRef.current = equipmentGroup;
    equipmentCargoSignatureRef.current = "";
    scene.add(equipmentGroup);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPosition: { readonly x: number; readonly y: number } | null =
      null;

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      pointerDownPosition = { x: event.clientX, y: event.clientY };
    };

    const handlePointerUp = (event: PointerEvent): void => {
      if (event.button !== 0 || pointerDownPosition === null) return;

      const movement = Math.hypot(
        event.clientX - pointerDownPosition.x,
        event.clientY - pointerDownPosition.y,
      );
      pointerDownPosition = null;
      if (movement > 5) return;

      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);

      const selection = raycaster
        .intersectObjects(scene.children, true)
        .map((intersection) => intersection.object)
        .map(selectionFromObject)
        .find((candidate) => candidate !== null);

      onSelect?.(selection ?? null);
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    const keyboardMoveDistance = Math.max(
      0.25,
      Math.max(sceneModel.bounds.width, sceneModel.bounds.depth) * 0.015,
    );
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const key = event.key.toLocaleLowerCase("tr-TR");
      if (!["w", "a", "s", "d", "q", "e"].includes(key)) return;

      const distance = keyboardMoveDistance * (event.shiftKey ? 2.5 : 1);
      const forward = new THREE.Vector3()
        .subVectors(controls.target, camera.position)
        .setY(0)
        .normalize();
      const right = new THREE.Vector3()
        .crossVectors(forward, camera.up)
        .normalize();
      const movement = new THREE.Vector3();

      if (key === "w") movement.addScaledVector(forward, distance);
      if (key === "s") movement.addScaledVector(forward, -distance);
      if (key === "a") movement.addScaledVector(right, -distance);
      if (key === "d") movement.addScaledVector(right, distance);
      if (key === "q") movement.y -= distance;
      if (key === "e") movement.y += distance;

      event.preventDefault();
      camera.position.add(movement);
      controls.target.add(movement);
      controls.update();
    };

    window.addEventListener("keydown", handleKeyDown);

    const resize = (): void => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      cameraViewRef.current = {
        position: camera.position.toArray(),
        target: controls.target.toArray(),
      };
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("keydown", handleKeyDown);
      resizeObserver.disconnect();
      controls.dispose();
      if (equipmentGroupRef.current === equipmentGroup) {
        equipmentGroupRef.current = null;
        equipmentCargoSignatureRef.current = "";
      }
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [
    equipmentRoute,
    equipmentType,
    hierarchy,
    onSelect,
    rackScene,
    rackSummaries,
  ]);

  useEffect(() => {
    const equipmentGroup = equipmentGroupRef.current;
    if (equipmentGroup === null) return;
    const position = equipmentPose?.position;
    if (position === null || position === undefined) {
      equipmentGroup.visible = false;
      return;
    }

    equipmentGroup.visible = true;
    equipmentGroup.position.set(
      position.x,
      position.y,
      position.z,
    );
    equipmentGroup.rotation.y = equipmentPose?.headingRadians ?? 0;
  }, [equipmentPose, equipmentType]);

  useEffect(() => {
    const equipmentGroup = equipmentGroupRef.current;
    if (equipmentGroup === null) return;
    const cartonIds = equipmentPose?.carriedCartonIds ?? [];
    const signature = `${equipmentType}:${cartonIds.join(",")}`;
    if (equipmentCargoSignatureRef.current === signature) return;

    const cargoGroup = equipmentGroup.getObjectByName("equipment-cargo");
    if (!(cargoGroup instanceof THREE.Group)) return;
    updateEquipmentCargo(cargoGroup, cartonIds, equipmentType);
    equipmentCargoSignatureRef.current = signature;
  }, [equipmentPose?.carriedCartonIds, equipmentType]);

  return (
    <div
      ref={containerRef}
      className="warehouse-3d-canvas"
      aria-label="Üç boyutlu depo görünümü"
    />
  );
}

function cartonSelection(object: THREE.Object3D): Warehouse3DCartonSelection {
  return {
    kind: "carton",
    aisleCode: String(object.userData.aisleCode),
    bayCode: String(object.userData.bayCode),
    locationId: Number(object.userData.locationId),
    level: String(object.userData.level),
    slot: String(object.userData.slot),
    cartonId: Number(object.userData.cartonId),
    cartonNumber: String(object.userData.cartonNumber),
    cartonTypeCode: String(object.userData.cartonTypeCode),
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

function rackSelection(object: THREE.Object3D): Warehouse3DRackSelection {
  return {
    kind: "rack",
    rackId: String(object.userData.rackId),
    aisleCode: String(object.userData.aisleCode),
    bayCode: String(object.userData.bayCode),
  };
}

function selectionFromObject(object: THREE.Object3D): Warehouse3DSelection | null {
  let current: THREE.Object3D | null = object;
  while (current !== null) {
    if (typeof current.userData.cartonId === "number") {
      return cartonSelection(current);
    }
    if (typeof current.userData.rackId === "string") {
      return rackSelection(current);
    }
    current = current.parent;
  }
  return null;
}

function createCamera(bounds: {
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1_000);
  const largestDimension = Math.max(bounds.width, bounds.depth, 8);
  camera.position.set(
    bounds.width / 2 + largestDimension * 0.48,
    Math.max(7, bounds.height + largestDimension * 0.48),
    bounds.depth / 2 + largestDimension * 0.76,
  );
  return camera;
}

function addLighting(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2.2));

  const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
  keyLight.position.set(12, 18, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2_048, 2_048);
  scene.add(keyLight);
}

function addFloor(scene: THREE.Scene, width: number, depth: number): void {
  const floorGeometry = new THREE.PlaneGeometry(width, depth);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(width / 2, 0, depth / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  const gridSize = Math.max(width, depth);
  const grid = new THREE.GridHelper(
    gridSize,
    Math.max(2, Math.ceil(gridSize)),
    0xcbd5e1,
    0xe2e8f0,
  );
  grid.position.set(width / 2, 0.01, depth / 2);
  scene.add(grid);
}

function addEquipmentRoute(
  scene: THREE.Scene,
  route: readonly Warehouse3DRoutePoint[],
): void {
  const points = route
    .filter((point) =>
      Number.isFinite(point.x)
      && Number.isFinite(point.y)
      && Number.isFinite(point.z)
    )
    .map((point) => new THREE.Vector3(point.x, 0.07, point.z));
  if (points.length < 2) return;

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineDashedMaterial({
    color: 0x6c5cff,
    dashSize: 0.42,
    gapSize: 0.24,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const routeLine = new THREE.Line(geometry, material);
  routeLine.computeLineDistances();
  routeLine.renderOrder = 2;
  scene.add(routeLine);

  addRouteMarker(scene, points[0]!, 0x22c55e);
  addRouteMarker(scene, points[points.length - 1]!, 0x6c5cff);
}

function addRouteMarker(
  scene: THREE.Scene,
  position: THREE.Vector3,
  color: number,
): void {
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.14, 0.25, 28),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.copy(position);
  marker.position.y = 0.075;
  marker.renderOrder = 3;
  scene.add(marker);
}

function createEquipmentModel(
  equipmentType: SimulationEquipmentType,
): THREE.Group {
  const model = equipmentType === "forklift"
    ? createForkliftModel()
    : equipmentType === "pallet_jack"
      ? createPalletJackModel()
      : createCartModel();
  const cargoGroup = new THREE.Group();
  cargoGroup.name = "equipment-cargo";
  model.add(cargoGroup);
  return model;
}

function updateEquipmentCargo(
  cargoGroup: THREE.Group,
  cartonIds: readonly number[],
  equipmentType: SimulationEquipmentType,
): void {
  for (const child of [...cargoGroup.children]) {
    cargoGroup.remove(child);
    disposeObject(child);
  }

  const layout = equipmentCargoLayout(equipmentType);
  const cartonsPerLayer = layout.columns * layout.rows;
  cartonIds.forEach((cartonId, index) => {
    const layer = Math.floor(index / cartonsPerLayer);
    const indexInLayer = index % cartonsPerLayer;
    const column = indexInLayer % layout.columns;
    const row = Math.floor(indexInLayer / layout.columns);
    const x =
      (column - (layout.columns - 1) / 2)
      * (layout.cartonWidth + layout.gap);
    const z =
      layout.centerZ
      + (row - (layout.rows - 1) / 2)
        * (layout.cartonDepth + layout.gap);
    const y =
      layout.baseY
      + layout.cartonHeight / 2
      + layer * (layout.cartonHeight + layout.gap);
    const carton = addBox(
      cargoGroup,
      {
        width: layout.cartonWidth,
        height: layout.cartonHeight,
        depth: layout.cartonDepth,
      },
      { x, y, z },
      equipmentCartonColor(cartonId),
      false,
    );
    carton.userData = { cartonId, kind: "equipment-cargo" };
  });
}

function equipmentCargoLayout(
  equipmentType: SimulationEquipmentType,
): {
  readonly baseY: number;
  readonly centerZ: number;
  readonly columns: number;
  readonly rows: number;
  readonly cartonWidth: number;
  readonly cartonHeight: number;
  readonly cartonDepth: number;
  readonly gap: number;
} {
  if (equipmentType === "forklift") {
    return {
      baseY: 0.18,
      centerZ: 1.22,
      columns: 3,
      rows: 2,
      cartonWidth: 0.25,
      cartonHeight: 0.24,
      cartonDepth: 0.31,
      gap: 0.025,
    };
  }
  if (equipmentType === "pallet_jack") {
    return {
      baseY: 0.18,
      centerZ: 0.45,
      columns: 3,
      rows: 2,
      cartonWidth: 0.2,
      cartonHeight: 0.2,
      cartonDepth: 0.28,
      gap: 0.025,
    };
  }
  return {
    baseY: 0.39,
    centerZ: 0,
    columns: 3,
    rows: 2,
    cartonWidth: 0.24,
    cartonHeight: 0.22,
    cartonDepth: 0.3,
    gap: 0.025,
  };
}

function equipmentCartonColor(cartonId: number): number {
  const colors = [0xc98b45, 0xb97832, 0xd7a15d, 0xa96728] as const;
  return colors[cartonId % colors.length]!;
}

function createForkliftModel(): THREE.Group {
  const group = new THREE.Group();
  const yellow = 0xf2b705;
  const dark = 0x1f2937;
  const steel = 0x475569;

  addBox(
    group,
    { width: 1.1, height: 0.36, depth: 1.55 },
    { x: 0, y: 0.4, z: -0.1 },
    yellow,
    true,
  );
  addBox(
    group,
    { width: 0.95, height: 0.72, depth: 0.62 },
    { x: 0, y: 0.89, z: -0.52 },
    yellow,
    true,
  );
  for (const x of [-0.43, 0.43]) {
    addBox(
      group,
      { width: 0.07, height: 1.28, depth: 0.07 },
      { x, y: 1.16, z: 0.05 },
      dark,
      true,
    );
  }
  addBox(
    group,
    { width: 0.94, height: 0.08, depth: 0.82 },
    { x: 0, y: 1.82, z: -0.16 },
    dark,
    true,
  );
  for (const x of [-0.43, 0.43]) {
    addBox(
      group,
      { width: 0.09, height: 1.7, depth: 0.09 },
      { x, y: 1.02, z: 0.73 },
      steel,
      true,
    );
    addBox(
      group,
      { width: 0.12, height: 0.08, depth: 1.25 },
      { x: x * 0.65, y: 0.13, z: 1.25 },
      steel,
      true,
    );
  }
  addBox(
    group,
    { width: 0.95, height: 0.09, depth: 0.09 },
    { x: 0, y: 1.76, z: 0.73 },
    steel,
    true,
  );
  addVehicleWheels(group, 0.57, 0.5, 0.28);
  addVehicleWheels(group, 0.57, -0.58, 0.28);
  group.name = "simulation-forklift";
  return group;
}

function createPalletJackModel(): THREE.Group {
  const group = new THREE.Group();
  const yellow = 0xf2b705;
  const dark = 0x334155;

  for (const x of [-0.25, 0.25]) {
    addBox(
      group,
      { width: 0.16, height: 0.1, depth: 1.35 },
      { x, y: 0.12, z: 0.42 },
      yellow,
      true,
    );
  }
  addBox(
    group,
    { width: 0.68, height: 0.32, depth: 0.42 },
    { x: 0, y: 0.27, z: -0.45 },
    yellow,
    true,
  );
  addBox(
    group,
    { width: 0.08, height: 1.05, depth: 0.08 },
    { x: 0, y: 0.82, z: -0.68 },
    dark,
    true,
  );
  addBox(
    group,
    { width: 0.46, height: 0.08, depth: 0.08 },
    { x: 0, y: 1.33, z: -0.68 },
    dark,
    true,
  );
  addVehicleWheels(group, 0.33, -0.45, 0.15);
  group.name = "simulation-pallet-jack";
  return group;
}

function createCartModel(): THREE.Group {
  const group = new THREE.Group();
  const blue = 0x4f67d8;
  const dark = 0x334155;

  addBox(
    group,
    { width: 0.9, height: 0.16, depth: 1.25 },
    { x: 0, y: 0.3, z: 0 },
    blue,
    true,
  );
  for (const x of [-0.4, 0.4]) {
    addBox(
      group,
      { width: 0.06, height: 0.85, depth: 0.06 },
      { x, y: 0.76, z: -0.58 },
      dark,
      true,
    );
  }
  addBox(
    group,
    { width: 0.86, height: 0.06, depth: 0.06 },
    { x: 0, y: 1.17, z: -0.58 },
    dark,
    true,
  );
  addVehicleWheels(group, 0.43, 0.46, 0.14);
  addVehicleWheels(group, 0.43, -0.46, 0.14);
  group.name = "simulation-cart";
  return group;
}

function addVehicleWheels(
  group: THREE.Group,
  xOffset: number,
  zOffset: number,
  radius: number,
): void {
  for (const x of [-xOffset, xOffset]) {
    const geometry = new THREE.CylinderGeometry(radius, radius, 0.14, 18);
    const material = new THREE.MeshStandardMaterial({
      color: 0x111827,
      metalness: 0.18,
      roughness: 0.78,
    });
    const wheel = new THREE.Mesh(geometry, material);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, radius, zOffset);
    wheel.castShadow = true;
    wheel.receiveShadow = true;
    group.add(wheel);
  }
}

function addRack(
  scene: THREE.Scene,
  rack: RackSceneNode,
  sceneRack: WarehouseRackScene | undefined,
): void {
  const layout = createPhysicalRackLayout(rack, sceneRack);
  const frameColor = 0x526176;
  const rackGroup = new THREE.Group();
  rackGroup.userData = {
    rackId: rack.id,
    aisleCode: rack.aisleCode,
    bayCode: rack.bayCode,
  };

  const usableWidth = sceneRack?.locations[0]?.usableWidthCm === undefined
    ? (layout.width - layout.frameThickness * (layout.slotsPerLevel + 1)) /
      layout.slotsPerLevel
    : sceneRack.locations[0].usableWidthCm / CENTIMETERS_PER_METER;
  const rackLeft = rack.position.x - layout.width / 2;
  const uprightZOffset = layout.depth / 2 - layout.frameThickness / 2;
  for (let postIndex = 0; postIndex <= layout.slotsPerLevel; postIndex += 1) {
    const postX =
      rackLeft +
      layout.frameThickness / 2 +
      postIndex * (usableWidth + layout.frameThickness);
    for (const zDirection of [-1, 1]) {
      addBox(
        rackGroup,
        {
          width: layout.frameThickness,
          height: layout.height,
          depth: layout.frameThickness,
        },
        {
          x: postX,
          y: layout.height / 2,
          z: rack.position.z + uprightZOffset * zDirection,
        },
        frameColor,
        true,
      );
    }
  }

  for (let shelfIndex = 0; shelfIndex <= layout.levelCount; shelfIndex += 1) {
    addBox(
      rackGroup,
      {
        width: layout.width,
        height: layout.frameThickness,
        depth: layout.depth,
      },
      {
        x: rack.position.x,
        y:
          layout.frameThickness / 2 +
          shelfIndex * (layout.clearLevelHeight + layout.frameThickness),
        z: rack.position.z,
      },
      frameColor,
      true,
    );
  }

  if (sceneRack !== undefined) {
    addRackCartons(rackGroup, rack, sceneRack, layout);
  }

  for (const child of rackGroup.children) {
    child.position.x -= rack.position.x;
    child.position.z -= rack.position.z;
  }
  rackGroup.position.set(rack.position.x, 0, rack.position.z);
  rackGroup.rotation.y = Math.PI / 2;

  scene.add(rackGroup);
}

function addRackCartons(
  rackGroup: THREE.Group,
  rack: RackSceneNode,
  sceneRack: WarehouseRackScene,
  layout: PhysicalRackLayout,
): void {
  const levelCodes = uniqueSorted(
    sceneRack.locations.map((location) => location.level),
  );
  const slotCodes = uniqueSorted(
    sceneRack.locations.map((location) => location.slot),
  );
  const levelIndexes = new Map(
    levelCodes.map((code, index) => [code, index]),
  );
  const slotIndexes = new Map(
    slotCodes.map((code, index) => [code, index]),
  );

  for (const location of sceneRack.locations) {
    const levelIndex = levelIndexes.get(location.level);
    const slotIndex = slotIndexes.get(location.slot);
    if (
      levelIndex === undefined ||
      slotIndex === undefined ||
      levelIndex >= layout.levelCount ||
      slotIndex >= layout.slotsPerLevel
    ) {
      continue;
    }
    addLocationCartons(
      rackGroup,
      rack,
      location,
      levelIndex,
      slotIndex,
      layout,
    );
  }
}

function addLocationCartons(
  rackGroup: THREE.Group,
  rack: RackSceneNode,
  location: WarehouseRackSceneLocation,
  levelIndex: number,
  slotIndex: number,
  layout: PhysicalRackLayout,
): void {
  const usableWidth = location.usableWidthCm / CENTIMETERS_PER_METER;
  const usableDepth = location.usableDepthCm / CENTIMETERS_PER_METER;
  const rackLeft = rack.position.x - layout.width / 2;
  const rackFront = rack.position.z - layout.depth / 2;
  const locationOriginX =
    rackLeft +
    layout.frameThickness +
    slotIndex * (usableWidth + layout.frameThickness);
  const locationOriginY =
    layout.frameThickness +
    levelIndex * (layout.clearLevelHeight + layout.frameThickness);
  const locationOriginZ = rackFront + (layout.depth - usableDepth) / 2;

  for (const cartonData of location.cartons) {
    const cartonSize = cartonSizeInMeters(cartonData);

    const carton = addBox(
      rackGroup,
      cartonSize,
      {
        x:
          locationOriginX +
          cartonData.positionXCm / CENTIMETERS_PER_METER +
          cartonSize.width / 2,
        y:
          locationOriginY +
          cartonData.positionZCm / CENTIMETERS_PER_METER +
          cartonSize.height / 2,
        z:
          locationOriginZ +
          cartonData.positionYCm / CENTIMETERS_PER_METER +
          cartonSize.depth / 2,
      },
      cartonColor(cartonData.id),
      false,
    );
    carton.userData = {
      ...rackGroup.userData,
      locationId: location.id,
      level: location.level,
      slot: location.slot,
      cartonId: cartonData.id,
      cartonNumber: cartonData.cartonNumber,
      cartonTypeCode: cartonData.cartonTypeCode,
      rotationDegrees: cartonData.rotationDegrees,
    };

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(carton.geometry),
      new THREE.LineBasicMaterial({ color: 0x68431f }),
    );
    edges.position.copy(carton.position);
    edges.userData = carton.userData;
    rackGroup.add(edges);
  }
}

function createPhysicalRackLayout(
  rack: RackSceneNode,
  sceneRack: WarehouseRackScene | undefined,
): PhysicalRackLayout {
  if (sceneRack === undefined) {
    const levelCount = Math.max(1, rack.levelCount);
    return {
      width: rack.size.depth,
      depth: rack.size.width,
      height: rack.size.height,
      clearLevelHeight: rack.size.height / levelCount,
      frameThickness: 0.05,
      levelCount,
      slotsPerLevel: 1,
    };
  }

  const width = sceneRack.widthCm / CENTIMETERS_PER_METER;
  const depth = sceneRack.depthCm / CENTIMETERS_PER_METER;
  const height = sceneRack.totalHeightCm / CENTIMETERS_PER_METER;
  const clearLevelHeight =
    sceneRack.levelClearHeightCm / CENTIMETERS_PER_METER;
  const sampleLocation = sceneRack.locations[0];
  const inferredFrameSizes = [
    (height - clearLevelHeight * sceneRack.levelCount) /
      (sceneRack.levelCount + 1),
  ];
  if (sampleLocation !== undefined) {
    inferredFrameSizes.push(
      (width -
        (sampleLocation.usableWidthCm / CENTIMETERS_PER_METER) *
          sceneRack.slotsPerLevel) /
        (sceneRack.slotsPerLevel + 1),
      (depth - sampleLocation.usableDepthCm / CENTIMETERS_PER_METER) / 2,
    );
  }
  const validFrameSizes = inferredFrameSizes.filter(
    (value) => Number.isFinite(value) && value > 0,
  );

  return {
    width,
    depth,
    height,
    clearLevelHeight,
    frameThickness: Math.max(0.02, Math.min(...validFrameSizes, 0.08)),
    levelCount: sceneRack.levelCount,
    slotsPerLevel: sceneRack.slotsPerLevel,
  };
}

function createNavigationAlignedSceneModel(
  hierarchy: StorageHierarchy,
  rackSummaries: readonly WarehouseRackSummary[],
  rackScene: readonly WarehouseRackScene[],
): WarehouseSceneModel {
  const driveAisleWidth = 3.5;
  const crossAisleWidth = 4;
  const rackGap = 0.2;
  const boundaryPadding = 1;
  const baseModel = createWarehouseSceneModel(hierarchy, rackSummaries);
  const physicalSizes = new Map(
    rackScene.map((rack) => [
      rackKey(rack.aisle, rack.bay),
      {
        width: rack.widthCm / CENTIMETERS_PER_METER,
        depth: rack.depthCm / CENTIMETERS_PER_METER,
        height: rack.totalHeightCm / CENTIMETERS_PER_METER,
      },
    ]),
  );
  const sizeByRack = new Map(
    baseModel.racks.map((rack) => [
      rack.id,
      physicalSizes.get(rackKey(rack.aisleCode, rack.bayCode)) ?? {
        width: rack.size.width,
        depth: rack.size.depth,
        height: rack.size.height,
      },
    ]),
  );
  const aisleCodes = naturalSortedUnique(
    baseModel.racks.map((rack) => rack.aisleCode),
  );
  const bayCodes = naturalSortedUnique(
    baseModel.racks.map((rack) => rack.bayCode),
  );
  const aisleDepths = new Map(
    aisleCodes.map((aisleCode) => [
      aisleCode,
      Math.max(
        ...baseModel.racks
          .filter((rack) => rack.aisleCode === aisleCode)
          .map((rack) => sizeByRack.get(rack.id)!.depth),
      ),
    ]),
  );
  const bayWidths = new Map(
    bayCodes.map((bayCode) => [
      bayCode,
      Math.max(
        ...baseModel.racks
          .filter((rack) => rack.bayCode === bayCode)
          .map((rack) => sizeByRack.get(rack.id)!.width),
      ),
    ]),
  );

  const aisleMinimums = new Map<string, number>();
  let nextX = driveAisleWidth;
  for (const aisleCode of aisleCodes) {
    aisleMinimums.set(aisleCode, nextX);
    nextX += aisleDepths.get(aisleCode)! + driveAisleWidth;
  }

  const bayMinimums = new Map<string, number>();
  let nextZ = crossAisleWidth;
  for (const bayCode of bayCodes) {
    bayMinimums.set(bayCode, nextZ);
    nextZ += bayWidths.get(bayCode)! + rackGap;
  }

  const racks = baseModel.racks.map((rack) => {
    const size = sizeByRack.get(rack.id)!;
    const aisleMinimum = aisleMinimums.get(rack.aisleCode)!;
    const bayMinimum = bayMinimums.get(rack.bayCode)!;
    const bayWidth = bayWidths.get(rack.bayCode)!;
    const rowOffset = (bayWidth - size.width) / 2;
    return {
      ...rack,
      position: {
        x: aisleMinimum + size.depth / 2,
        y: size.height / 2,
        z: bayMinimum + rowOffset + size.width / 2,
      },
      size: {
        width: size.depth,
        depth: size.width,
        height: size.height,
      },
    };
  });
  const lastAisle = aisleCodes[aisleCodes.length - 1];
  const lastBay = bayCodes[bayCodes.length - 1];

  return {
    racks,
    bounds: {
      width: lastAisle === undefined
        ? boundaryPadding * 2
        : aisleMinimums.get(lastAisle)!
          + aisleDepths.get(lastAisle)!
          + boundaryPadding,
      depth: lastBay === undefined
        ? crossAisleWidth * 2
        : bayMinimums.get(lastBay)!
          + bayWidths.get(lastBay)!
          + crossAisleWidth,
      height: Math.max(0, ...racks.map((rack) => rack.size.height)),
    },
  };
}

function naturalSortedUnique(values: readonly string[]): readonly string[] {
  const collator = new Intl.Collator("en", {
    numeric: true,
    sensitivity: "base",
  });
  return [...new Set(values)].sort((first, second) =>
    collator.compare(first, second)
  );
}

function cartonSizeInMeters(carton: WarehouseRackSceneCarton): {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
} {
  const rotated = carton.rotationDegrees === 90;
  return {
    width:
      (rotated ? carton.outerWidthCm : carton.outerLengthCm) /
      CENTIMETERS_PER_METER,
    height: carton.outerHeightCm / CENTIMETERS_PER_METER,
    depth:
      (rotated ? carton.outerLengthCm : carton.outerWidthCm) /
      CENTIMETERS_PER_METER,
  };
}

function cartonColor(cartonId: number): THREE.ColorRepresentation {
  const colors = [0xc68a46, 0xb97836, 0xd39a56] as const;
  return colors[cartonId % colors.length] ?? colors[0];
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((first, second) =>
    first.localeCompare(second),
  );
}

function rackKey(aisleCode: string, bayCode: string): string {
  return `${aisleCode.trim().toLocaleUpperCase("tr-TR")}/${bayCode.trim().toLocaleUpperCase("tr-TR")}`;
}

function addBox(
  parent: THREE.Object3D,
  size: { readonly width: number; readonly height: number; readonly depth: number },
  position: { readonly x: number; readonly y: number; readonly z: number },
  color: THREE.ColorRepresentation,
  metallic: boolean,
): THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> {
  const geometry = new THREE.BoxGeometry(size.width, size.height, size.depth);
  const material = new THREE.MeshStandardMaterial({
    color,
    metalness: metallic ? 0.72 : 0.08,
    roughness: metallic ? 0.3 : 0.78,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position.x, position.y, position.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function disposeScene(scene: THREE.Scene): void {
  disposeObject(scene);
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (
      !(object instanceof THREE.Mesh) &&
      !(object instanceof THREE.Line)
    ) {
      return;
    }

    object.geometry.dispose();
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    materials.forEach((material) => material.dispose());
  });
}
