import { useEffect, useState, type FormEvent } from "react";

import type {
  SimulationMove,
  SimulationScenarioInput,
  StorageHierarchy,
  WarehouseRackScene,
  WarehouseRackSummary,
} from "@warehouse/domain";

import { AppButton } from "./components/AppButton.js";
import { AppIcon } from "./components/AppIcon.js";
import { useSimulationWorkspace } from "./useSimulationWorkspace.js";
import { Warehouse3DCanvas } from "./Warehouse3DCanvas.js";

interface SimulationPageProps {
  readonly hierarchy: StorageHierarchy | null;
  readonly rackSummaries: readonly WarehouseRackSummary[];
  readonly baselineScene: readonly WarehouseRackScene[];
}

export function SimulationPage({
  hierarchy,
  rackSummaries,
  baselineScene,
}: SimulationPageProps) {
  const workspace = useSimulationWorkspace();
  const [draft, setDraft] = useState<SimulationScenarioInput>(initialDraft);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return;
      const current = workspace.state;
      if (
        current.status !== "ready" ||
        current.selectedScenario === null ||
        current.busyAction !== null
      ) {
        return;
      }

      const maximumStep = current.moves?.moveCount ?? 0;
      if (event.key === "ArrowLeft" && current.currentStep > 0) {
        event.preventDefault();
        void workspace.showStep(
          current.selectedScenario.id,
          current.currentStep - 1,
        );
      }
      if (event.key === "ArrowRight" && current.currentStep < maximumStep) {
        event.preventDefault();
        void workspace.showStep(
          current.selectedScenario.id,
          current.currentStep + 1,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [workspace.showStep, workspace.state]);

  if (workspace.state.status === "loading") {
    return <SimulationMessage title="Senaryolar yükleniyor" />;
  }
  if (workspace.state.status === "error") {
    return (
      <SimulationMessage
        title="Simülasyon verileri alınamadı"
        message={workspace.state.message}
        tone="error"
      />
    );
  }

  const state = workspace.state;
  const scenario = state.selectedScenario;
  const result = scenario?.result ?? null;
  const maximumStep = state.moves?.moveCount ?? 0;
  const selectedMove = state.currentStep === 0
    ? null
    : state.moves?.moves[state.currentStep - 1] ?? null;
  const visibleScene = state.scene.length === 0 ? baselineScene : state.scene;
  const busy = state.busyAction !== null;

  const createScenario = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void workspace.createScenario(draft);
  };

  const showStep = (step: number): void => {
    if (scenario === null || state.busyAction !== null) return;
    void workspace.showStep(scenario.id, step);
  };

  return (
    <section className="simulation-page">
      <header className="simulation-header">
        <div>
          <h1>Simülasyon</h1>
          <p>Alternatif depo yerleşimlerini çalıştırın ve adım adım inceleyin.</p>
        </div>
        <AppButton
          className="simulation-run-button"
          icon="play"
          variant="primary"
          disabled={scenario === null || scenario.status !== "pending" || busy}
          onClick={() => {
            if (scenario !== null) void workspace.runScenario(scenario.id);
          }}
        >
          {state.busyAction === "running"
            ? "Simülasyon çalışıyor"
            : "Simülasyonu Çalıştır"}
        </AppButton>
      </header>

      <form className="simulation-config" onSubmit={createScenario}>
        <label>
          <span>Yeni senaryo</span>
          <input
            required
            maxLength={200}
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Seed</span>
          <input
            type="number"
            min={0}
            step={1}
            value={draft.seed}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                seed: Number(event.target.value),
              }))
            }
          />
        </label>
        <div className="simulation-algorithm">
          <span>Algoritma</span>
          <strong>Deterministik Slotting v1</strong>
        </div>
        <AppButton
          type="submit"
          icon="add"
          variant="primary"
          disabled={busy || draft.name.trim().length === 0}
        >
          {state.busyAction === "creating" ? "Oluşturuluyor" : "Yeni Senaryo"}
        </AppButton>
      </form>

      <section className="simulation-objectives" aria-label="Optimizasyon hedefleri">
        <ObjectiveToggle
          label="Aynı SKU'ları grupla"
          checked={draft.groupSameSku}
          onChange={(checked) =>
            setDraft((current) => ({ ...current, groupSameSku: checked }))
          }
        />
        <ObjectiveToggle
          label="Ağır kolileri alt seviyeye al"
          checked={draft.preferLowerLevelsForHeavyCartons}
          onChange={(checked) =>
            setDraft((current) => ({
              ...current,
              preferLowerLevelsForHeavyCartons: checked,
            }))
          }
        />
        <ObjectiveToggle
          label="Sevkiyat mesafesini azalt"
          checked={draft.minimizeDispatchDistance}
          onChange={(checked) =>
            setDraft((current) => ({
              ...current,
              minimizeDispatchDistance: checked,
            }))
          }
        />
        <ObjectiveToggle
          label="Taşıma sayısını azalt"
          checked={draft.minimizeMoves}
          onChange={(checked) =>
            setDraft((current) => ({ ...current, minimizeMoves: checked }))
          }
        />
        <ObjectiveToggle
          label="Hacim kullanımını iyileştir"
          checked={draft.improveVolumeUtilization}
          onChange={(checked) =>
            setDraft((current) => ({
              ...current,
              improveVolumeUtilization: checked,
            }))
          }
        />
      </section>

      <div className="simulation-selection-row">
        <label>
          <span>Senaryo</span>
          <select
            value={scenario?.id ?? ""}
            disabled={busy}
            onChange={(event) => {
              const scenarioId = Number(event.target.value);
              if (scenarioId > 0) void workspace.selectScenario(scenarioId);
            }}
          >
            <option value="">Senaryo seçin</option>
            {state.scenarios.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name} · {scenarioStatusLabel(item.status)}
              </option>
            ))}
          </select>
        </label>
        {scenario === null ? null : (
          <div className="simulation-selected-status">
            <span data-status={scenario.status}>{scenarioStatusLabel(scenario.status)}</span>
            <small>%{formatNumber(scenario.progressPercent)} tamamlandı</small>
          </div>
        )}
        <AppButton
          className="simulation-delete-button"
          icon="trash"
          variant="danger"
          disabled={scenario === null || busy}
          onClick={() => {
            if (scenario !== null) void workspace.deleteScenario(scenario.id);
          }}
        >
          Senaryoyu Sil
        </AppButton>
      </div>

      {state.errorMessage === null ? null : (
        <p className="simulation-inline-error">{state.errorMessage}</p>
      )}

      <section className="simulation-metrics" aria-label="Simülasyon özeti">
        <MetricCard
          label="Taşınacak Koli"
          value={result === null ? "—" : formatNumber(result.proposed.movedCartonCount)}
          detail={result === null ? "Senaryo çalıştırılmadı" : `${formatNumber(result.proposed.unplacedCartonCount)} yerleştirilemedi`}
        />
        <MetricCard
          label="Ortalama Mesafe"
          value={result === null ? "—" : `${formatNumber(result.proposed.averageDispatchDistance)} m`}
          detail={result === null ? "Mevcut sonuç bekleniyor" : `${formatNumber(result.current.averageDispatchDistance)} m mevcut`}
        />
        <MetricCard
          label="Beklenen İyileşme"
          value={result?.objectiveImprovementPercent === null || result === null
            ? "—"
            : `%${formatNumber(result.objectiveImprovementPercent)}`}
          detail={result === null ? "Optimizasyon bekleniyor" : `${formatDuration(result.estimatedDurationSeconds)} tahmini süre`}
          tone="positive"
        />
      </section>

      <div className="simulation-workspace-grid">
        <section className="simulation-scene-card">
          <div className="simulation-scene-heading">
            <div>
              <strong>Yerleşim adımları</strong>
              <span>{scenario === null ? "Mevcut depo" : scenario.name}</span>
            </div>
            <span>Adım {state.currentStep} / {maximumStep}</span>
          </div>
          <div className="simulation-scene">
            <Warehouse3DCanvas
              hierarchy={hierarchy}
              rackSummaries={rackSummaries}
              rackScene={visibleScene}
            />
          </div>
          <div className="simulation-step-controls">
            <AppButton
              icon="arrow-left"
              size="small"
              disabled={state.currentStep === 0 || busy}
              onClick={() => showStep(state.currentStep - 1)}
            >
              Önceki
            </AppButton>
            <input
              type="range"
              min={0}
              max={maximumStep}
              value={state.currentStep}
              disabled={scenario === null || maximumStep === 0 || busy}
              aria-label="Simülasyon adımı"
              onChange={(event) => showStep(Number(event.target.value))}
            />
            <AppButton
              icon="arrow-right"
              iconPosition="end"
              size="small"
              disabled={state.currentStep >= maximumStep || busy}
              onClick={() => showStep(state.currentStep + 1)}
            >
              Sonraki
            </AppButton>
          </div>
        </section>

        <aside className="simulation-inspector">
          <h2>Senaryo Özeti</h2>
          {scenario === null ? (
            <p>Sonuçları görmek için bir senaryo seçin.</p>
          ) : (
            <>
              <dl>
                <SummaryRow label="Durum" value={scenarioStatusLabel(scenario.status)} />
                <SummaryRow label="Algoritma" value={scenario.algorithmName} />
                <SummaryRow label="Seed" value={formatNumber(scenario.seed)} />
                <SummaryRow label="Toplam hareket" value={formatNumber(maximumStep)} />
                <SummaryRow
                  label="Hareket mesafesi"
                  value={result === null ? "—" : `${formatNumber(result.totalMovementDistanceM)} m`}
                />
              </dl>
              <SelectedMove move={selectedMove} />
              <MovePlan
                moves={state.moves?.moves ?? []}
                currentStep={state.currentStep}
                disabled={busy}
                onSelect={showStep}
              />
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

function ObjectiveToggle({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone?: "positive";
}) {
  return (
    <article className="simulation-metric" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function SummaryRow({ label, value }: { readonly label: string; readonly value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function SelectedMove({ move }: { readonly move: SimulationMove | null }) {
  if (move === null) {
    return (
      <section className="simulation-selected-move empty">
        <strong>Başlangıç yerleşimi</strong>
        <p>Bir hareketi incelemek için adım seçin.</p>
      </section>
    );
  }

  return (
    <section className="simulation-selected-move">
      <span>Adım {move.sequence}</span>
      <strong>{move.cartonNumber}</strong>
      <small>{move.sku}</small>
      <dl>
        <SummaryRow label="Kaynak" value={locationLabel(move.fromLocationId)} />
        <SummaryRow label="Hedef" value={locationLabel(move.toLocationId)} />
        <SummaryRow
          label="Mesafe"
          value={move.travelDistanceM === null ? "—" : `${formatNumber(move.travelDistanceM)} m`}
        />
        <SummaryRow
          label="Durum"
          value={move.resultStatus === "placed" ? "Yerleştirildi" : "Yerleştirilemedi"}
        />
      </dl>
      {move.reasons.length === 0 ? null : (
        <ul>{move.reasons.map((reason) => <li key={reason}>{reasonLabel(reason)}</li>)}</ul>
      )}
    </section>
  );
}

function MovePlan({
  moves,
  currentStep,
  disabled,
  onSelect,
}: {
  readonly moves: readonly SimulationMove[];
  readonly currentStep: number;
  readonly disabled: boolean;
  readonly onSelect: (step: number) => void;
}) {
  return (
    <section className="simulation-move-plan">
      <div className="simulation-move-plan-heading">
        <h2>Taşıma Planı</h2>
        <span>{moves.length} hareket</span>
      </div>
      {moves.length === 0 ? (
        <p>Senaryo çalıştırıldığında önerilen hareketler burada görünecek.</p>
      ) : (
        <div className="simulation-move-list">
          {moves.map((move) => (
            <button
              type="button"
              className="simulation-move-row"
              key={move.id}
              disabled={disabled}
              data-selected={move.sequence === currentStep}
              aria-pressed={move.sequence === currentStep}
              onClick={() => onSelect(move.sequence)}
            >
              <span className="simulation-move-sequence">{move.sequence}</span>
              <span className="simulation-move-description">
                <strong>{move.cartonNumber}</strong>
                <small>
                  {locationLabel(move.fromLocationId)} → {locationLabel(move.toLocationId)}
                </small>
              </span>
              <span className="simulation-move-distance">
                {move.travelDistanceM === null
                  ? "—"
                  : `${formatNumber(move.travelDistanceM)} m`}
              </span>
              <AppIcon name="arrow-right" className="simulation-move-action-icon" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function SimulationMessage({
  title,
  message,
  tone,
}: {
  readonly title: string;
  readonly message?: string;
  readonly tone?: "error";
}) {
  return (
    <section className="simulation-message" data-tone={tone}>
      <strong>{title}</strong>
      {message === undefined ? null : <p>{message}</p>}
    </section>
  );
}

function initialDraft(): SimulationScenarioInput {
  return {
    name: "Yeni yerleşim senaryosu",
    seed: 42,
    algorithmName: "deterministic_slotting_v1",
    groupSameSku: true,
    preferLowerLevelsForHeavyCartons: true,
    minimizeDispatchDistance: true,
    minimizeMoves: true,
    improveVolumeUtilization: true,
    objectiveWeights: {
      sameSkuLocation: 8,
      sameRack: 4,
      nearbyAisle: 2,
      lowerLevelForHeavy: 5,
      dispatchDistance: 7,
      coShipmentProximity: 3,
      locationConsolidation: 4,
      splitSku: 6,
      moves: 5,
      volumeUtilization: 4,
    },
    aisleFilter: null,
    levelFilter: null,
  };
}

function scenarioStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Hazır",
    running: "Çalışıyor",
    completed: "Tamamlandı",
    failed: "Başarısız",
    cancelled: "İptal edildi",
  };
  return labels[status] ?? status;
}

function reasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    same_sku_location: "Aynı SKU gruplaması",
    same_rack: "Aynı raf tercihi",
    nearby_aisle: "Yakın koridor tercihi",
    lower_level_for_heavy: "Ağır koli alt seviye tercihi",
    dispatch_distance: "Sevkiyat mesafesi azaltımı",
    location_consolidation: "Lokasyon birleştirme",
    volume_utilization: "Hacim kullanımı",
  };
  return labels[reason] ?? reason.replaceAll("_", " ");
}

function locationLabel(locationId: number | null): string {
  return locationId === null ? "Yerleştirilmedi" : `Lokasyon ${locationId}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${formatNumber(seconds)} sn`;
  return `${Math.floor(seconds / 60)} dk ${Math.round(seconds % 60)} sn`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
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
