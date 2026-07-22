import { useCallback, useMemo, useState, type ReactNode } from "react";

import {
  filterStorageHierarchy,
  type WarehouseRackScene,
} from "@warehouse/domain";

import { AppButton } from "./components/AppButton.js";
import { AppIcon, type AppIconName } from "./components/AppIcon.js";
import { RackDetailsPanel } from "./components/RackDetailsPanel.js";
import { DashboardPage } from "./DashboardPage.js";
import { SimulationPage } from "./SimulationPage.js";
import {
  useWarehouseLocations,
  type WarehouseLocationsState,
} from "./useWarehouseLocations.js";
import {
  useWarehouseRackDetail,
  type WarehouseRackDetailState,
} from "./useWarehouseRackDetail.js";
import { useWarehouseRackScene } from "./useWarehouseRackScene.js";
import { useWarehouseRackSummaries } from "./useWarehouseRackSummaries.js";
import {
  Warehouse3DCanvas,
  type Warehouse3DSelection,
} from "./Warehouse3DCanvas.js";

type AppPage = "dashboard" | "map" | "simulation";

export function App() {
  const locationsState = useWarehouseLocations();
  const rackSummariesState = useWarehouseRackSummaries();
  const rackSceneState = useWarehouseRackScene();
  const [aisleQuery, setAisleQuery] = useState("");
  const [selectedBayKey, setSelectedBayKey] = useState<string | null>(null);
  const [selectedCartonId, setSelectedCartonId] = useState<number | null>(null);
  const [activePage, setActivePage] = useState<AppPage>("dashboard");
  const handle3DSelect = useCallback(
    (selection: Warehouse3DSelection | null): void => {
      if (selection === null) {
        setSelectedBayKey(null);
        setSelectedCartonId(null);
        return;
      }

      setSelectedBayKey(`${selection.aisleCode}/${selection.bayCode}`);
      setSelectedCartonId(
        selection.kind === "carton" ? selection.cartonId : null,
      );
    },
    [],
  );
  const visibleHierarchy = useMemo(
    () =>
      locationsState.status === "success"
        ? filterStorageHierarchy(locationsState.hierarchy, aisleQuery)
        : null,
    [aisleQuery, locationsState],
  );
  const selectedRack = useMemo(() => {
    if (selectedBayKey === null) return null;
    const [aisle, bay] = selectedBayKey.split("/");
    return aisle === undefined || bay === undefined ? null : { aisle, bay };
  }, [selectedBayKey]);
  const rackDetailState = useWarehouseRackDetail(selectedRack);
  const rackSummaries =
    rackSummariesState.status === "success"
      ? rackSummariesState.summaries
      : [];
  const rackScene =
    rackSceneState.status === "success" ? rackSceneState.racks : [];
  const warehouseHierarchy =
    locationsState.status === "success" ? locationsState.hierarchy : null;
  const selectedSceneRack = useMemo(() => {
    if (selectedRack === null) return null;
    const selectedKey = rackKey(selectedRack.aisle, selectedRack.bay);
    return (
      rackScene.find((rack) => rackKey(rack.aisle, rack.bay) === selectedKey) ??
      null
    );
  }, [rackScene, selectedRack]);

  return (
    <main className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <section className="app-content">
        {activePage === "dashboard" ? (
          <>
            <div className="page-content">
              <DashboardPage
                locationsState={locationsState}
                rackSummaries={rackSummaries}
                rackScene={rackScene}
                onNavigate={(page) => setActivePage(page)}
              />
            </div>

            <footer className="app-footer">
              <span>Depo Optimizer</span>
              <span>Genel Bakış</span>
            </footer>
          </>
        ) : activePage === "map" ? (
          <>
        <TopBar onOpenSimulation={() => setActivePage("simulation")} />

        <div className="page-content">
          <SummaryCards state={locationsState} />

          <section className="map-workspace">
            <div className="map-card">
              <div className="map-actions">
                <label className="search-field">
                  <AppIcon name="search" />
                  <input
                    type="search"
                    value={aisleQuery}
                    placeholder="Koridor ara (örn. A003)"
                    aria-label="Koridor ara"
                    onChange={(event) => {
                      setAisleQuery(event.target.value);
                      setSelectedBayKey(null);
                      setSelectedCartonId(null);
                    }}
                  />
                </label>

                <div className="map-action-group">
                  <div className="filter-summary">
                    <AppIcon name="filter" />
                    {visibleHierarchy === null
                      ? "Veri bekleniyor"
                      : `${visibleHierarchy.aisles.length} koridor`}
                  </div>
                </div>
              </div>

              <div className="map-stage">
                <Warehouse3DCanvas
                  hierarchy={visibleHierarchy}
                  rackSummaries={rackSummaries}
                  rackScene={rackScene}
                  onSelect={handle3DSelect}
                />
              </div>

              <MapLegend />
            </div>

            <aside className="inspector-panel">
              <div className="inspector-title">
                <h2>Özellikler</h2>
                {selectedBayKey !== null ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBayKey(null);
                      setSelectedCartonId(null);
                    }}
                    aria-label="Detayı kapat"
                  >
                    <AppIcon name="close" />
                  </button>
                ) : null}
              </div>

              <LocationsStatus state={locationsState} />

              <RackDetailContent
                state={rackDetailState}
                sceneRack={selectedSceneRack}
                selectedCartonId={selectedCartonId}
              />
            </aside>
          </section>
        </div>

        <footer className="app-footer">
          <span>Depo Optimizer</span>
          <span>Depo Haritası</span>
        </footer>
          </>
        ) : (
          <>
            <div className="page-content">
              <SimulationPage
                hierarchy={warehouseHierarchy}
                rackSummaries={rackSummaries}
                baselineScene={rackScene}
              />
            </div>

            <footer className="app-footer">
              <span>Depo Optimizer</span>
              <span>Simülasyon</span>
            </footer>
          </>
        )}
      </section>
    </main>
  );
}

function Sidebar({
  activePage,
  onNavigate,
}: {
  readonly activePage: AppPage;
  readonly onNavigate: (page: AppPage) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark"><AppIcon name="warehouse" /></span>
        <span>Depo<br />Optimizer</span>
      </div>

      <nav className="main-nav" aria-label="Ana menü">
        <NavItem
          icon="dashboard"
          label="Genel Bakış"
          active={activePage === "dashboard"}
          onClick={() => onNavigate("dashboard")}
        />
        <NavItem
          icon="map"
          label="Depo Haritası"
          active={activePage === "map"}
          onClick={() => onNavigate("map")}
        />
        <NavItem
          icon="simulation"
          label="Simülasyon"
          active={activePage === "simulation"}
          onClick={() => onNavigate("simulation")}
        />
        <NavItem icon="reports" label="Raporlar" disabled />
        <NavItem icon="analytics" label="Analizler" disabled />
        <NavItem icon="settings" label="Ayarlar" disabled />
      </nav>

      <div className="sidebar-spacer" />

      <button className="sidebar-action" type="button">
        <AppIcon name="sun" />
        <span>Açık Tema</span>
        <span>›</span>
      </button>
      <div className="profile-card">
        <span className="avatar"><AppIcon name="user" /></span>
        <div><strong>Yönetici</strong><small>Admin</small></div>
        <span>⌄</span>
      </div>
    </aside>
  );
}

interface NavItemProps {
  readonly icon: AppIconName;
  readonly label: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}

function NavItem({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
}: NavItemProps) {
  return (
    <button
      className={active ? "nav-item active" : "nav-item"}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <AppIcon name={icon} />
      <span>{label}</span>
    </button>
  );
}

function TopBar({ onOpenSimulation }: { readonly onOpenSimulation: () => void }) {
  return (
    <header className="top-bar">
      <div>
        <h1>Depo Haritası</h1>
        <p>Depo düzenini görselleştirin ve analiz edin</p>
      </div>
      <div className="top-actions">
        <AppButton
          className="secondary-button"
          icon="simulation"
          onClick={onOpenSimulation}
        >
          Simülasyon
        </AppButton>
        <AppButton
          className="primary-button"
          icon="add"
          variant="primary"
          onClick={onOpenSimulation}
        >
          Yeni Senaryo
        </AppButton>
        <div className="top-profile">
          <span className="avatar"><AppIcon name="user" /></span>
          <div><strong>Yönetici</strong><small>Admin</small></div>
        </div>
      </div>
    </header>
  );
}

interface SummaryCardsProps {
  readonly state: WarehouseLocationsState;
}

function SummaryCards({ state }: SummaryCardsProps) {
  const hierarchy = state.status === "success" ? state.hierarchy : null;
  const locations = state.status === "success" ? state.locations : [];
  const activeCount = locations.filter((location) => location.isActive).length;
  const activeRate = locations.length === 0
    ? 0
    : Math.round((activeCount / locations.length) * 100);
  const totalCapacity = locations.reduce(
    (sum, location) => sum + (location.maxWeightKg ?? 0),
    0,
  );
  const averageDistance = locations.length === 0
    ? 0
    : locations.reduce(
      (sum, location) => sum + location.distanceFromDispatchM,
      0,
    ) / locations.length;

  return (
    <section className="summary-grid" aria-label="Depo özeti">
      <SummaryCard icon="aisle" label="Toplam Koridor" value={valueOf(hierarchy?.aisles.length)} />
      <SummaryCard icon="location" label="Toplam Lokasyon" value={valueOf(hierarchy?.locationCount)} />
      <SummaryCard icon="active" label="Aktif Lokasyon" value={valueOf(hierarchy === null ? undefined : activeCount)} note={hierarchy === null ? undefined : `%${activeRate}`} tone="green" />
      <SummaryCard icon="capacity" label="Toplam Kapasite" value={hierarchy === null ? "—" : `${formatNumber(totalCapacity)} kg`} />
      <SummaryCard icon="distance" label="Ort. Sevkiyat Uzaklığı" value={hierarchy === null ? "—" : `${averageDistance.toFixed(1)} m`} />
    </section>
  );
}

interface SummaryCardProps {
  readonly icon: AppIconName;
  readonly label: string;
  readonly value: string;
  readonly note?: string | undefined;
  readonly tone?: "green";
}

function SummaryCard({ icon, label, value, note, tone }: SummaryCardProps) {
  return (
    <article className="summary-card">
      <span className="summary-icon"><AppIcon name={icon} /></span>
      <div><span>{label}</span><strong>{value}</strong></div>
      {note === undefined ? null : <small data-tone={tone}>{note}</small>}
    </article>
  );
}

function MapLegend() {
  return (
    <div className="map-footer">
      <div><span className="status-dot empty" />Boş</div>
      <div><span className="status-dot partial" />Kısmi</div>
      <div><span className="status-dot full" />Dolu</div>
      <div><span className="status-dot unknown" />Bilinmiyor</div>
      <div><span className="status-dot selected" />Seçili</div>
    </div>
  );
}

function RackDetailContent({
  state,
  sceneRack,
  selectedCartonId,
}: {
  readonly state: WarehouseRackDetailState;
  readonly sceneRack: WarehouseRackScene | null;
  readonly selectedCartonId: number | null;
}) {
  if (state.status === "idle") return <EmptySelection />;
  if (state.status === "loading") {
    return <div className="detail-message"><span className="detail-spinner" /><strong>Raf detayı yükleniyor</strong></div>;
  }
  if (state.status === "error") {
    return <div className="detail-message error"><strong>Raf detayı alınamadı</strong><p>{state.message}</p></div>;
  }
  return (
    <RackDetailsPanel
      detail={state.detail}
      sceneRack={sceneRack}
      selectedCartonId={selectedCartonId}
    />
  );
}

function rackKey(aisleCode: string, bayCode: string): string {
  const aisle = aisleCode.replace(/^SYN-/i, "").toLocaleUpperCase("tr-TR");
  const bay = bayCode.toLocaleUpperCase("tr-TR");
  return `${aisle}/${bay}`;
}

function EmptySelection() {
  return (
    <div className="empty-selection">
      <span><AppIcon name="map" /></span>
      <strong>Bir raf seçin</strong>
      <p>Seviye, lokasyon ve kapasite bilgilerini görmek için haritadaki bir rafa tıklayın.</p>
    </div>
  );
}

interface LocationsStatusProps {
  readonly state: WarehouseLocationsState;
}

function LocationsStatus({ state }: LocationsStatusProps) {
  if (state.status === "loading") {
    return <StatusLine status="loading">Depolama verisi yükleniyor</StatusLine>;
  }

  if (state.status === "error") {
    return (
      <div className="status-error">
        <StatusLine status="error">Depolama verisi alınamadı</StatusLine>
        <p>{state.message}</p>
      </div>
    );
  }

  return <StatusLine status="success">Depolama verisi hazır</StatusLine>;
}

function StatusLine({ status, children }: { readonly status: string; readonly children: ReactNode }) {
  return (
    <div className="status-line" data-status={status}>
      <span className="status-indicator" />
      <strong>{children}</strong>
    </div>
  );
}

function valueOf(value: number | undefined): string {
  return value === undefined ? "—" : formatNumber(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}

// npm run dev:web --workspace @warehouse/desktop
