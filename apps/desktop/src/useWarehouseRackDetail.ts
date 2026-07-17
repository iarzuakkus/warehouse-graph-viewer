import { useEffect, useState } from "react";

import { WarehouseRacksApiClient } from "@warehouse/api-client";
import type { WarehouseRackDetail } from "@warehouse/domain";

export interface RackSelection {
  readonly aisle: string;
  readonly bay: string;
}

export type WarehouseRackDetailState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly detail: WarehouseRackDetail }
  | { readonly status: "error"; readonly message: string };

const racksClient = new WarehouseRacksApiClient(
  "/api",
  async (url) => fetch(url),
);

export function useWarehouseRackDetail(
  selection: RackSelection | null,
): WarehouseRackDetailState {
  const [state, setState] = useState<WarehouseRackDetailState>({
    status: "idle",
  });
  const aisle = selection?.aisle;
  const bay = selection?.bay;

  useEffect(() => {
    if (aisle === undefined || bay === undefined) {
      setState({ status: "idle" });
      return;
    }

    let active = true;
    setState({ status: "loading" });
    racksClient.getRackDetail(aisle, bay).then(
      (detail) => {
        if (active) setState({ status: "success", detail });
      },
      (error: unknown) => {
        if (!active) return;
        const message = error instanceof Error
          ? error.message
          : "Bilinmeyen raf detayı hatası";
        setState({ status: "error", message });
      },
    );

    return () => {
      active = false;
    };
  }, [aisle, bay]);

  return state;
}
