import { useMemo, type CSSProperties } from "react";

import type {
  SimulationScenario,
  StorageLocation,
  WarehouseRackScene,
  WarehouseRackSummary,
} from "@warehouse/domain";

import { AppButton } from "./components/AppButton.js";
import { AppIcon, type AppIconName } from "./components/AppIcon.js";
import type { WarehouseLocationsState } from "./useWarehouseLocations.js";
import { useSimulationWorkspace } from "./useSimulationWorkspace.js";

interface DashboardPageProps {
  readonly locationsState: WarehouseLocationsState;
  readonly rackSummaries: readonly WarehouseRackSummary[];
  readonly rackScene: readonly WarehouseRackScene[];
  readonly onNavigate: (page: "map" | "simulation") => void;
}

interface CorridorUtilization {
  readonly aisle: string;
  readonly weightUtilizationPercent: number | null;
  readonly volumeUtilizationPercent: number | null;
}

export function DashboardPage({
  locationsState,
  rackSummaries,
  rackScene,
  onNavigate,
}: DashboardPageProps) {
  const simulationWorkspace = useSimulationWorkspace();
  const locations = locationsState.status === "success"
    ? locationsState.locations
    : [];
  const hierarchy = locationsState.status === "success"
    ? locationsState.hierarchy
    : null;
  const metrics = useMemo(
    () => calculateDashboardMetrics(locations, rackSummaries, rackScene),
    [locations, rackScene, rackSummaries],
  );
  const corridors = useMemo(
    () => calculateCorridorUtilization(rackSummaries, rackScene),
    [rackScene, rackSummaries],
  );
  const recentScenarios = simulationWorkspace.state.status === "ready"
    ? simulationWorkspace.state.scenarios.slice(0, 5)
    : [];
  const latestCompletedScenario = recentScenarios.find(
    (scenario) => scenario.status === "completed",
  ) ?? null;
  const warnings = createWarnings(
    metrics.inactiveLocationCount,
    metrics.highUtilizationRackCount,
    latestCompletedScenario,
  );

  return (
    <section className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>Genel Bakış</h1>
          <p>Depo kapasitesini, doluluk durumunu ve optimizasyon sonuçlarını izleyin.</p>
        </div>
        <div className="dashboard-header-actions">
          <AppButton icon="map" onClick={() => onNavigate("map")}>
            Depo Haritası
          </AppButton>
          <AppButton
            icon="add"
            variant="primary"
            onClick={() => onNavigate("simulation")}
          >
            Yeni Senaryo
          </AppButton>
        </div>
      </header>

      {locationsState.status === "error" ? (
        <p className="dashboard-error">Depo verileri alınamadı: {locationsState.message}</p>
      ) : null}

      <section className="dashboard-kpis" aria-label="Depo özeti">
        <DashboardKpi icon="aisle" label="Toplam Koridor" value={valueOrDash(hierarchy?.aisles.length)} />
        <DashboardKpi icon="location" label="Toplam Lokasyon" value={valueOrDash(hierarchy?.locationCount)} />
        <DashboardKpi
          icon="active"
          label="Aktif Lokasyon"
          value={locationsState.status === "success" ? formatNumber(metrics.activeLocationCount) : "—"}
          detail={locationsState.status === "success" ? `%${formatNumber(metrics.activeLocationPercent)} aktif` : "Veri bekleniyor"}
          tone="positive"
        />
        <DashboardKpi
          icon="capacity"
          label="Ağırlık Kullanımı"
          value={metrics.weightUtilizationPercent === null ? "—" : `%${formatNumber(metrics.weightUtilizationPercent)}`}
          detail={`${formatWeight(metrics.totalUsedWeightKg)} / ${formatWeight(metrics.totalCapacityKg)}`}
        />
        <DashboardKpi
          icon="cube"
          label="Hacim Kullanımı"
          value={metrics.volumeUtilizationPercent === null ? "—" : `%${formatNumber(metrics.volumeUtilizationPercent)}`}
          detail={`${formatNumber(rackScene.length)} fiziksel raf`}
        />
        <DashboardKpi
          icon="distance"
          label="Ort. Sevkiyat Mesafesi"
          value={locations.length === 0 ? "—" : `${formatNumber(metrics.averageDispatchDistanceM)} m`}
          detail="Aktif depo lokasyonları"
        />
      </section>

      <div className="dashboard-primary-grid">
        <section className="dashboard-panel dashboard-occupancy-panel">
          <PanelHeading
            title="Depo Doluluk Haritası"
            detail={`${rackScene.length} raf`}
          />
          <div className="dashboard-heatmap" aria-label="Raf bazlı hacim kullanımı">
            {groupSceneByAisle(rackScene).map(([aisle, racks]) => (
              <div className="dashboard-heatmap-row" key={aisle}>
                <strong>{displayAisle(aisle)}</strong>
                <div>
                  {racks.map((rack) => {
                    const utilization = rackVolumeUtilization(rack);
                    return (
                      <span
                        key={`${rack.aisle}/${rack.bay}`}
                        data-tone={utilizationTone(utilization)}
                        aria-label={`${displayAisle(rack.aisle)} ${rack.bay}, hacim kullanımı yüzde ${formatNumber(utilization)}`}
                      >
                        {rack.bay}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="dashboard-heatmap-legend" aria-label="Doluluk açıklaması">
            <span data-tone="empty">Boş</span>
            <span data-tone="low">Düşük</span>
            <span data-tone="medium">Orta</span>
            <span data-tone="high">Yüksek</span>
          </div>
        </section>

        <section className="dashboard-panel dashboard-capacity-panel">
          <PanelHeading title="Koridor Bazlı Kapasite" detail="Ağırlık kullanımı" />
          <div className="dashboard-bars" aria-label="Koridor kapasite kullanım grafiği">
            {corridors.map((corridor) => {
              const utilization = corridor.weightUtilizationPercent ?? 0;
              return (
                <div className="dashboard-bar" key={corridor.aisle}>
                  <span>{displayAisle(corridor.aisle)}</span>
                  <div><i style={percentageStyle(utilization)} /></div>
                  <strong>{corridor.weightUtilizationPercent === null ? "—" : `%${formatNumber(utilization)}`}</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="dashboard-panel dashboard-warning-panel">
          <PanelHeading title="Uyarılar" detail={`${warnings.length} kontrol`} />
          <div className="dashboard-warning-list">
            {warnings.map((warning) => (
              <article data-tone={warning.tone} key={warning.title}>
                <span aria-hidden="true">
                  <AppIcon name={warning.tone === "success" ? "check" : "warning"} />
                </span>
                <div><strong>{warning.title}</strong><p>{warning.detail}</p></div>
                <b>{warning.count}</b>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="dashboard-secondary-grid">
        <section className="dashboard-panel dashboard-scenario-panel">
          <PanelHeading title="Son Simülasyonlar" detail={`${recentScenarios.length} senaryo`} />
          {simulationWorkspace.state.status === "loading" ? (
            <p className="dashboard-empty">Senaryolar yükleniyor.</p>
          ) : recentScenarios.length === 0 ? (
            <p className="dashboard-empty">Henüz simülasyon senaryosu bulunmuyor.</p>
          ) : (
            <div className="dashboard-scenario-list">
              {recentScenarios.map((scenario) => (
                <article key={scenario.id}>
                  <div><strong>{scenario.name}</strong><span>{formatDate(scenario.updatedAt)}</span></div>
                  <span data-status={scenario.status}>{scenarioStatusLabel(scenario.status)}</span>
                  <div>
                    <small>Hareket</small>
                    <b>{scenario.result === null ? "—" : formatNumber(scenario.result.proposed.movedCartonCount)}</b>
                  </div>
                  <div>
                    <small>İyileşme</small>
                    <b>{scenario.result?.objectiveImprovementPercent === null || scenario.result === null
                      ? "—"
                      : `%${formatNumber(scenario.result.objectiveImprovementPercent)}`}</b>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard-panel dashboard-actions-panel">
          <PanelHeading title="Hızlı İşlemler" />
          <div>
            <button type="button" onClick={() => onNavigate("map")}>
              <AppIcon name="map" className="dashboard-action-icon" />
              <strong>Haritayı Aç</strong><span>Etkileşimli 3D depo görünümü</span>
            </button>
            <button type="button" onClick={() => onNavigate("simulation")}>
              <AppIcon name="simulation" className="dashboard-action-icon" />
              <strong>Yeni Senaryo</strong><span>Yerleşimi optimize edin</span>
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}

function DashboardKpi({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  readonly icon: AppIconName;
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
  readonly tone?: "positive";
}) {
  return (
    <article className="dashboard-kpi" data-tone={tone}>
      <span className="dashboard-kpi-icon"><AppIcon name={icon} /></span>
      <span className="dashboard-kpi-label">{label}</span><strong>{value}</strong>
      {detail === undefined ? null : <small>{detail}</small>}
    </article>
  );
}

function PanelHeading({ title, detail }: { readonly title: string; readonly detail?: string }) {
  return (
    <header className="dashboard-panel-heading">
      <h2>{title}</h2>
      {detail === undefined ? null : <span>{detail}</span>}
    </header>
  );
}

function calculateDashboardMetrics(
  locations: readonly StorageLocation[],
  rackSummaries: readonly WarehouseRackSummary[],
  rackScene: readonly WarehouseRackScene[],
) {
  const activeLocationCount = locations.filter((location) => location.isActive).length;
  const totalCapacityKg = sumKnown(rackSummaries.map((rack) => rack.totalMaxWeightKg));
  const totalUsedWeightKg = sumKnown(rackSummaries.map((rack) => rack.totalUsedWeightKg));
  const weightedVolume = volumeTotals(rackScene);
  return {
    activeLocationCount,
    inactiveLocationCount: locations.length - activeLocationCount,
    activeLocationPercent: locations.length === 0
      ? 0
      : (activeLocationCount / locations.length) * 100,
    totalCapacityKg,
    totalUsedWeightKg,
    weightUtilizationPercent: totalCapacityKg === 0
      ? null
      : (totalUsedWeightKg / totalCapacityKg) * 100,
    volumeUtilizationPercent: weightedVolume.capacity === 0
      ? null
      : (weightedVolume.used / weightedVolume.capacity) * 100,
    averageDispatchDistanceM: locations.length === 0
      ? 0
      : locations.reduce((sum, location) => sum + location.distanceFromDispatchM, 0) / locations.length,
    highUtilizationRackCount: rackScene.filter(
      (rack) => rackVolumeUtilization(rack) >= 80,
    ).length,
  };
}

function calculateCorridorUtilization(
  summaries: readonly WarehouseRackSummary[],
  scene: readonly WarehouseRackScene[],
): readonly CorridorUtilization[] {
  const aisles = [...new Set([
    ...summaries.map((rack) => rack.aisle),
    ...scene.map((rack) => rack.aisle),
  ])].sort((first, second) => first.localeCompare(second));
  return aisles.map((aisle) => {
    const aisleSummaries = summaries.filter((rack) => rack.aisle === aisle);
    const capacity = sumKnown(aisleSummaries.map((rack) => rack.totalMaxWeightKg));
    const used = sumKnown(aisleSummaries.map((rack) => rack.totalUsedWeightKg));
    const aisleVolume = volumeTotals(scene.filter((rack) => rack.aisle === aisle));
    return {
      aisle,
      weightUtilizationPercent: capacity === 0 ? null : (used / capacity) * 100,
      volumeUtilizationPercent: aisleVolume.capacity === 0
        ? null
        : (aisleVolume.used / aisleVolume.capacity) * 100,
    };
  });
}

function volumeTotals(racks: readonly WarehouseRackScene[]): { readonly capacity: number; readonly used: number } {
  let capacity = 0;
  let used = 0;
  for (const rack of racks) {
    for (const location of rack.locations) {
      const locationVolume = location.usableWidthCm * location.usableDepthCm * location.usableHeightCm;
      capacity += locationVolume;
      used += locationVolume * location.volumeUtilizationPercent / 100;
    }
  }
  return { capacity, used };
}

function rackVolumeUtilization(rack: WarehouseRackScene): number {
  const totals = volumeTotals([rack]);
  return totals.capacity === 0 ? 0 : totals.used / totals.capacity * 100;
}

function groupSceneByAisle(
  racks: readonly WarehouseRackScene[],
): readonly [string, readonly WarehouseRackScene[]][] {
  const groups = new Map<string, WarehouseRackScene[]>();
  for (const rack of racks) {
    const aisleRacks = groups.get(rack.aisle) ?? [];
    aisleRacks.push(rack);
    groups.set(rack.aisle, aisleRacks);
  }
  return [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([aisle, aisleRacks]) => [
      aisle,
      aisleRacks.sort((first, second) => first.bay.localeCompare(second.bay)),
    ]);
}

function createWarnings(
  inactiveLocations: number,
  highUtilizationRacks: number,
  latestScenario: SimulationScenario | null,
) {
  const unplaced = latestScenario?.result?.proposed.unplacedCartonCount ?? 0;
  return [
    {
      title: "Pasif Lokasyonlar",
      detail: "Yerleşim için kullanılamayan lokasyonlar",
      count: inactiveLocations,
      tone: inactiveLocations === 0 ? "success" : "warning",
    },
    {
      title: "Yüksek Doluluklu Raflar",
      detail: "Hacim kullanımı yüzde 80 ve üzeri raflar",
      count: highUtilizationRacks,
      tone: highUtilizationRacks === 0 ? "success" : "danger",
    },
    {
      title: "Yerleştirilemeyen Koliler",
      detail: "Son tamamlanan simülasyon sonucu",
      count: unplaced,
      tone: unplaced === 0 ? "success" : "danger",
    },
  ] as const;
}

function utilizationTone(value: number): "empty" | "low" | "medium" | "high" {
  if (value === 0) return "empty";
  if (value < 50) return "low";
  if (value < 80) return "medium";
  return "high";
}

function percentageStyle(value: number): CSSProperties {
  return { width: `${Math.min(100, Math.max(0, value))}%` };
}

function sumKnown(values: readonly (number | null)[]): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function displayAisle(value: string): string {
  return value.replace(/^SYN-/i, "");
}

function valueOrDash(value: number | undefined): string {
  return value === undefined ? "—" : formatNumber(value);
}

function formatWeight(value: number): string {
  return `${formatNumber(value)} kg`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function scenarioStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Hazır",
    running: "Çalışıyor",
    completed: "Tamamlandı",
    failed: "Başarısız",
    cancelled: "İptal",
  };
  return labels[status] ?? status;
}
