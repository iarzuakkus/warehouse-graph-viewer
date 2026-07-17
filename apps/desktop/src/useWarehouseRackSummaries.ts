import { useEffect, useState } from "react";

import { WarehouseRacksApiClient } from "@warehouse/api-client";
import type { WarehouseRackSummary } from "@warehouse/domain";

export type WarehouseRackSummariesState =
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly summaries: readonly WarehouseRackSummary[] }
  | { readonly status: "error"; readonly message: string };

const racksClient = new WarehouseRacksApiClient(
  "/api",
  async (url) => fetch(url),
);

export function useWarehouseRackSummaries(): WarehouseRackSummariesState {
  const [state, setState] = useState<WarehouseRackSummariesState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;
    racksClient.getAllRackSummaries().then(
      (summaries) => {
        if (active) setState({ status: "success", summaries });
      },
      (error: unknown) => {
        if (!active) return;
        const message = error instanceof Error
          ? error.message
          : "Bilinmeyen raf özeti hatası";
        setState({ status: "error", message });
      },
    );

    return () => {
      active = false;
    };
  }, []);

  return state;
}
