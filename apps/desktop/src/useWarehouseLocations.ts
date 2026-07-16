import { useEffect, useState } from "react";

import { WarehouseLocationsApiClient } from "@warehouse/api-client";
import {
  buildStorageHierarchy,
  type StorageHierarchy,
  type StorageLocation,
} from "@warehouse/domain";

export type WarehouseLocationsState =
  | { readonly status: "loading" }
  | {
      readonly status: "success";
      readonly locations: readonly StorageLocation[];
      readonly hierarchy: StorageHierarchy;
    }
  | { readonly status: "error"; readonly message: string };

const locationsClient = new WarehouseLocationsApiClient(
  "/api",
  async (url) => fetch(url),
);

export function useWarehouseLocations(): WarehouseLocationsState {
  const [state, setState] = useState<WarehouseLocationsState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    locationsClient.getAllLocations().then(
      (locations) => {
        if (!active) return;
        setState({
          status: "success",
          locations,
          hierarchy: buildStorageHierarchy(locations),
        });
      },
      (error: unknown) => {
        if (!active) return;
        const message =
          error instanceof Error ? error.message : "Bilinmeyen API hatasi";
        setState({ status: "error", message });
      },
    );

    return () => {
      active = false;
    };
  }, []);

  return state;
}
