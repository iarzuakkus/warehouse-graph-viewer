import type { WarehouseMap } from "@warehouse/domain";

export const sampleWarehouseMap: WarehouseMap = {
  id: "sample-warehouse",
  name: "Ornek Depo",
  version: 1,
  unit: "meter",
  width: 30,
  depth: 20,
  racks: [
    {
      id: "rack-a",
      name: "Raf A",
      position: { x: 5, y: 4 },
      size: { width: 8, depth: 1.5, height: 3 },
      rotation: 0,
      locationIds: [101, 102, 103, 104],
    },
    {
      id: "rack-b",
      name: "Raf B",
      position: { x: 18, y: 5 },
      size: { width: 7, depth: 1.5, height: 3 },
      rotation: 90,
      locationIds: [201, 202, 203],
    },
  ],
};
