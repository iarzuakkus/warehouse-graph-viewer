import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import type {
  StorageHierarchy,
  WarehouseRackScene,
  WarehouseRackSceneCarton,
  WarehouseRackSceneLocation,
  WarehouseRackSummary,
} from "@warehouse/domain";
import {
  createWarehouseSceneModel,
  type RackSceneNode,
} from "@warehouse/rendering-3d";

interface Warehouse3DCanvasProps {
  readonly hierarchy: StorageHierarchy | null;
  readonly rackSummaries: readonly WarehouseRackSummary[];
  readonly rackScene?: readonly WarehouseRackScene[];
  readonly onSelect?: (selection: Warehouse3DSelection | null) => void;
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
  onSelect,
}: Warehouse3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraViewRef = useRef<CameraViewState | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || hierarchy === null) return;

    const sceneModel = createWarehouseSceneModel(hierarchy, rackSummaries);
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
    sceneModel.racks.forEach((rack) =>
      addRack(
        scene,
        rack,
        sceneRacksByKey.get(rackKey(rack.aisleCode, rack.bayCode)),
      ),
    );

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
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [hierarchy, onSelect, rackScene, rackSummaries]);

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
      width: rack.size.width,
      depth: rack.size.depth,
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
  scene.traverse((object) => {
    if (
      !(object instanceof THREE.Mesh) &&
      !(object instanceof THREE.LineSegments)
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
