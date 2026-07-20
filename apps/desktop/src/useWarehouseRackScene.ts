import { useEffect, useState } from "react";

import { WarehouseRacksApiClient } from "@warehouse/api-client";
import type { WarehouseRackScene } from "@warehouse/domain";

export type WarehouseRackSceneState =
  | { readonly status: "loading" }
  | {
      readonly status: "success";
      readonly racks: readonly WarehouseRackScene[];
    }
  | { readonly status: "error"; readonly message: string };

const racksClient = new WarehouseRacksApiClient(
  "/api",
  async (url) => fetch(url),
);

export function useWarehouseRackScene(): WarehouseRackSceneState {
  const [state, setState] = useState<WarehouseRackSceneState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    racksClient.getWarehouseScene().then(
      (racks) => {
        if (active) setState({ status: "success", racks });
      },
      (error: unknown) => {
        if (!active) return;
        const message = error instanceof Error
          ? error.message
          : "Bilinmeyen 3D raf verisi hatasi";
        setState({ status: "error", message });
      },
    );

    return () => {
      active = false;
    };
  }, []);

  return state;
}
