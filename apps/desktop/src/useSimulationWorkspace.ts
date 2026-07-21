import { useCallback, useEffect, useRef, useState } from "react";

import { SimulationApiClient } from "@warehouse/api-client";
import type {
  SimulationMoveList,
  SimulationScenario,
  SimulationScenarioInput,
  WarehouseRackScene,
} from "@warehouse/domain";

export type SimulationBusyAction =
  | "creating"
  | "deleting"
  | "loading-scenario"
  | "loading-step"
  | "running";

export type SimulationWorkspaceState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly scenarios: readonly SimulationScenario[];
      readonly selectedScenario: SimulationScenario | null;
      readonly moves: SimulationMoveList | null;
      readonly scene: readonly WarehouseRackScene[];
      readonly currentStep: number;
      readonly busyAction: SimulationBusyAction | null;
      readonly errorMessage: string | null;
    };

export interface SimulationWorkspace {
  readonly state: SimulationWorkspaceState;
  readonly createScenario: (input: SimulationScenarioInput) => Promise<void>;
  readonly selectScenario: (scenarioId: number) => Promise<void>;
  readonly runScenario: (scenarioId: number) => Promise<void>;
  readonly showStep: (scenarioId: number, step: number) => Promise<void>;
  readonly deleteScenario: (scenarioId: number) => Promise<void>;
}

const simulationClient = new SimulationApiClient(
  "/api",
  async (url, options) => {
    if (options === undefined) return fetch(url);
    return fetch(url, {
      method: options.method,
      ...(options.headers === undefined
        ? {}
        : { headers: { ...options.headers } }),
      ...(options.body === undefined ? {} : { body: options.body }),
    });
  },
);

export function useSimulationWorkspace(): SimulationWorkspace {
  const [state, setState] = useState<SimulationWorkspaceState>({
    status: "loading",
  });
  const mountedRef = useRef(true);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    const requestSequence = nextRequest(requestSequenceRef);

    simulationClient.listScenarios().then(
      (scenarios) => {
        if (!isCurrentRequest(mountedRef, requestSequenceRef, requestSequence)) {
          return;
        }
        setState(readyState(scenarios));
      },
      (error: unknown) => {
        if (!isCurrentRequest(mountedRef, requestSequenceRef, requestSequence)) {
          return;
        }
        setState({ status: "error", message: errorMessage(error) });
      },
    );

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const createScenario = useCallback(
    async (input: SimulationScenarioInput): Promise<void> => {
      const requestSequence = beginAction(
        setState,
        requestSequenceRef,
        "creating",
      );
      try {
        const scenario = await simulationClient.createScenario(input);
        if (!isCurrentRequest(mountedRef, requestSequenceRef, requestSequence)) {
          return;
        }
        setState((current) => {
          if (current.status !== "ready") return current;
          return {
            ...current,
            scenarios: [
              scenario,
              ...current.scenarios.filter((item) => item.id !== scenario.id),
            ],
            selectedScenario: scenario,
            moves: null,
            scene: [],
            currentStep: 0,
            busyAction: null,
            errorMessage: null,
          };
        });
      } catch (error: unknown) {
        finishWithError(setState, mountedRef, requestSequenceRef, requestSequence, error);
      }
    },
    [],
  );

  const selectScenario = useCallback(
    async (scenarioId: number): Promise<void> => {
      const requestSequence = beginAction(
        setState,
        requestSequenceRef,
        "loading-scenario",
      );
      try {
        const scenario = await simulationClient.getScenario(scenarioId);
        const bundle = await loadScenarioBundle(scenario, 0);
        if (!isCurrentRequest(mountedRef, requestSequenceRef, requestSequence)) {
          return;
        }
        setState((current) => {
          if (current.status !== "ready") return current;
          return {
            ...current,
            scenarios: replaceScenario(current.scenarios, scenario),
            selectedScenario: scenario,
            moves: bundle.moves,
            scene: bundle.scene,
            currentStep: 0,
            busyAction: null,
            errorMessage: null,
          };
        });
      } catch (error: unknown) {
        finishWithError(setState, mountedRef, requestSequenceRef, requestSequence, error);
      }
    },
    [],
  );

  const runScenario = useCallback(
    async (scenarioId: number): Promise<void> => {
      const requestSequence = beginAction(
        setState,
        requestSequenceRef,
        "running",
      );
      try {
        const scenario = await simulationClient.runScenario(scenarioId);
        const bundle = await loadScenarioBundle(scenario, 0);
        if (!isCurrentRequest(mountedRef, requestSequenceRef, requestSequence)) {
          return;
        }
        setState((current) => {
          if (current.status !== "ready") return current;
          return {
            ...current,
            scenarios: replaceScenario(current.scenarios, scenario),
            selectedScenario: scenario,
            moves: bundle.moves,
            scene: bundle.scene,
            currentStep: 0,
            busyAction: null,
            errorMessage: null,
          };
        });
      } catch (error: unknown) {
        finishWithError(setState, mountedRef, requestSequenceRef, requestSequence, error);
      }
    },
    [],
  );

  const showStep = useCallback(
    async (scenarioId: number, step: number): Promise<void> => {
      const requestSequence = beginAction(
        setState,
        requestSequenceRef,
        "loading-step",
      );
      try {
        const scene = await simulationClient.getScenarioScene(scenarioId, step);
        if (!isCurrentRequest(mountedRef, requestSequenceRef, requestSequence)) {
          return;
        }
        setState((current) =>
          current.status === "ready"
            ? {
                ...current,
                scene,
                currentStep: step,
                busyAction: null,
                errorMessage: null,
              }
            : current,
        );
      } catch (error: unknown) {
        finishWithError(setState, mountedRef, requestSequenceRef, requestSequence, error);
      }
    },
    [],
  );

  const deleteScenario = useCallback(
    async (scenarioId: number): Promise<void> => {
      const requestSequence = beginAction(
        setState,
        requestSequenceRef,
        "deleting",
      );
      try {
        await simulationClient.deleteScenario(scenarioId);
        if (!isCurrentRequest(mountedRef, requestSequenceRef, requestSequence)) {
          return;
        }
        setState((current) => {
          if (current.status !== "ready") return current;
          const deletedSelection = current.selectedScenario?.id === scenarioId;
          return {
            ...current,
            scenarios: current.scenarios.filter((item) => item.id !== scenarioId),
            selectedScenario: deletedSelection ? null : current.selectedScenario,
            moves: deletedSelection ? null : current.moves,
            scene: deletedSelection ? [] : current.scene,
            currentStep: deletedSelection ? 0 : current.currentStep,
            busyAction: null,
            errorMessage: null,
          };
        });
      } catch (error: unknown) {
        finishWithError(setState, mountedRef, requestSequenceRef, requestSequence, error);
      }
    },
    [],
  );

  return {
    state,
    createScenario,
    selectScenario,
    runScenario,
    showStep,
    deleteScenario,
  };
}

async function loadScenarioBundle(
  scenario: SimulationScenario,
  step: number,
): Promise<{
  readonly moves: SimulationMoveList | null;
  readonly scene: readonly WarehouseRackScene[];
}> {
  if (scenario.status !== "completed") return { moves: null, scene: [] };
  const [moves, scene] = await Promise.all([
    simulationClient.getMoves(scenario.id),
    simulationClient.getScenarioScene(scenario.id, step),
  ]);
  return { moves, scene };
}

function readyState(
  scenarios: readonly SimulationScenario[],
): SimulationWorkspaceState {
  return {
    status: "ready",
    scenarios,
    selectedScenario: null,
    moves: null,
    scene: [],
    currentStep: 0,
    busyAction: null,
    errorMessage: null,
  };
}

function replaceScenario(
  scenarios: readonly SimulationScenario[],
  replacement: SimulationScenario,
): readonly SimulationScenario[] {
  return scenarios.map((scenario) =>
    scenario.id === replacement.id ? replacement : scenario,
  );
}

function nextRequest(requestSequenceRef: { current: number }): number {
  requestSequenceRef.current += 1;
  return requestSequenceRef.current;
}

function beginAction(
  setState: (updater: (state: SimulationWorkspaceState) => SimulationWorkspaceState) => void,
  requestSequenceRef: { current: number },
  action: SimulationBusyAction,
): number {
  const requestSequence = nextRequest(requestSequenceRef);
  setState((current) =>
    current.status === "ready"
      ? { ...current, busyAction: action, errorMessage: null }
      : current,
  );
  return requestSequence;
}

function finishWithError(
  setState: (updater: (state: SimulationWorkspaceState) => SimulationWorkspaceState) => void,
  mountedRef: { readonly current: boolean },
  requestSequenceRef: { readonly current: number },
  requestSequence: number,
  error: unknown,
): void {
  if (!isCurrentRequest(mountedRef, requestSequenceRef, requestSequence)) return;
  setState((current) =>
    current.status === "ready"
      ? {
          ...current,
          busyAction: null,
          errorMessage: errorMessage(error),
        }
      : current,
  );
}

function isCurrentRequest(
  mountedRef: { readonly current: boolean },
  requestSequenceRef: { readonly current: number },
  requestSequence: number,
): boolean {
  return mountedRef.current && requestSequenceRef.current === requestSequence;
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Bilinmeyen simülasyon hatası";
}
