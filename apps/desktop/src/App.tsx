import { useMemo, useState, type ReactNode } from "react";

import { filterStorageHierarchy } from "@warehouse/domain";

import { RackDetailsPanel } from "./components/RackDetailsPanel.js";
import { sampleWarehouseMap } from "./sample-map.js";
import {
  useWarehouseLocations,
  type WarehouseLocationsState,
} from "./useWarehouseLocations.js";
import {
  useWarehouseRackDetail,
  type WarehouseRackDetailState,
} from "./useWarehouseRackDetail.js";
import { useWarehouseRackSummaries } from "./useWarehouseRackSummaries.js";
import { WarehouseCanvas } from "./WarehouseCanvas.js";

export function App() {
  const locationsState = useWarehouseLocations();
  const rackSummariesState = useWarehouseRackSummaries();
  const [aisleQuery, setAisleQuery] = useState("");
  const [selectedBayKey, setSelectedBayKey] = useState<string | null>(null);
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

  return (
    <main className="app-shell">
      <Sidebar />

      <section className="app-content">
        <TopBar />

        <div className="page-content">
          <SummaryCards state={locationsState} />

          <section className="map-workspace">
            <div className="map-card">
              <div className="map-actions">
                <label className="search-field">
                  <Icon name="search" />
                  <input
                    type="search"
                    value={aisleQuery}
                    placeholder="Koridor ara (örn. A003)"
                    aria-label="Koridor ara"
                    onChange={(event) => {
                      setAisleQuery(event.target.value);
                      setSelectedBayKey(null);
                    }}
                  />
                </label>

                <div className="filter-summary">
                  <Icon name="filter" />
                  {visibleHierarchy === null
                    ? "Veri bekleniyor"
                    : `${visibleHierarchy.aisles.length} koridor`}
                </div>
              </div>

              <div className="map-stage">
                <WarehouseCanvas
                  map={sampleWarehouseMap}
                  hierarchy={visibleHierarchy}
                  rackSummaries={
                    rackSummariesState.status === "success"
                      ? rackSummariesState.summaries
                      : []
                  }
                  selectedBayKey={selectedBayKey}
                  onBaySelect={(aisleCode, bayCode) =>
                    setSelectedBayKey(`${aisleCode}/${bayCode}`)
                  }
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
                    onClick={() => setSelectedBayKey(null)}
                    aria-label="Detayı kapat"
                  >
                    ×
                  </button>
                ) : null}
              </div>

              <LocationsStatus state={locationsState} />

              <RackDetailContent state={rackDetailState} />
            </aside>
          </section>
        </div>

        <footer className="app-footer">
          <span>Depo Optimizer</span>
          <span>Depo Haritası</span>
        </footer>
      </section>
    </main>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark"><Icon name="warehouse" /></span>
        <span>Depo<br />Optimizer</span>
      </div>

      <nav className="main-nav" aria-label="Ana menü">
        <NavItem icon="home" label="Genel Bakış" />
        <NavItem icon="map" label="Depo Haritası" active />
        <NavItem icon="simulation" label="Simülasyon" disabled />
        <NavItem icon="report" label="Raporlar" disabled />
        <NavItem icon="analysis" label="Analizler" disabled />
        <NavItem icon="settings" label="Ayarlar" disabled />
      </nav>

      <div className="sidebar-spacer" />

      <button className="sidebar-action" type="button">
        <Icon name="sun" />
        <span>Açık Tema</span>
        <span>›</span>
      </button>
      <div className="profile-card">
        <span className="avatar"><Icon name="user" /></span>
        <div><strong>Yönetici</strong><small>Admin</small></div>
        <span>⌄</span>
      </div>
    </aside>
  );
}

interface NavItemProps {
  readonly icon: IconName;
  readonly label: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
}

function NavItem({ icon, label, active = false, disabled = false }: NavItemProps) {
  return (
    <button
      className={active ? "nav-item active" : "nav-item"}
      type="button"
      disabled={disabled}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

function TopBar() {
  return (
    <header className="top-bar">
      <div>
        <h1>Depo Haritası</h1>
        <p>Depo düzenini görselleştirin ve analiz edin</p>
      </div>
      <div className="top-actions">
        <button className="secondary-button" type="button" disabled>
          <Icon name="simulation" /> Simülasyon
        </button>
        <button className="primary-button" type="button" disabled>
          <span>+</span> Yeni Senaryo
        </button>
        <div className="top-profile">
          <span className="avatar"><Icon name="user" /></span>
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
  readonly icon: IconName;
  readonly label: string;
  readonly value: string;
  readonly note?: string | undefined;
  readonly tone?: "green";
}

function SummaryCard({ icon, label, value, note, tone }: SummaryCardProps) {
  return (
    <article className="summary-card">
      <span className="summary-icon"><Icon name={icon} /></span>
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

function RackDetailContent({ state }: { readonly state: WarehouseRackDetailState }) {
  if (state.status === "idle") return <EmptySelection />;
  if (state.status === "loading") {
    return <div className="detail-message"><span className="detail-spinner" /><strong>Raf detayı yükleniyor</strong></div>;
  }
  if (state.status === "error") {
    return <div className="detail-message error"><strong>Raf detayı alınamadı</strong><p>{state.message}</p></div>;
  }
  return <RackDetailsPanel detail={state.detail} />;
}

function EmptySelection() {
  return (
    <div className="empty-selection">
      <span><Icon name="map" /></span>
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

type IconName =
  | "active" | "aisle" | "analysis" | "capacity" | "distance"
  | "filter" | "home" | "location" | "map" | "report" | "search"
  | "settings" | "simulation" | "sun" | "user" | "warehouse";

function Icon({ name }: { readonly name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    active: <><path d="M12 3v12" /><path d="m8 11 4 4 4-4" /><path d="M5 16v3h14v-3" /></>,
    aisle: <><path d="M5 19V7l4-3v15" /><path d="M15 19V4l4 3v12" /><path d="M2 19h20" /></>,
    analysis: <><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M22 19H2" /></>,
    capacity: <><path d="M4 8h16v11H4z" /><path d="m8 8 1-4h6l1 4" /><path d="M9 13h6" /></>,
    distance: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M7.5 16.5 16.5 7.5" /><path d="M8 6H4v4" /><path d="M16 18h4v-4" /></>,
    filter: <path d="M4 6h16M7 12h10M10 18h4" />,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
    location: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z" /><path d="M9 3v15M15 6v15" /></>,
    report: <><path d="M6 2h9l4 4v16H6z" /><path d="M14 2v5h5M9 13h6M9 17h6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A7 7 0 0 0 15 6l-.3-2.5h-4L10.5 6A7 7 0 0 0 9 7L6.6 6.1l-2 3.4L6.7 11a7 7 0 0 0 0 2l-2 1.5 2 3.4L9 17a7 7 0 0 0 1.5 1l.3 2.5h4L15 18a7 7 0 0 0 1.5-1l2.4.9 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" /></>,
    simulation: <><path d="M6 19a9 9 0 1 1 12 0" /><path d="M9 22h6M12 13V7M9 10l3 3 3-3" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    warehouse: <><path d="m3 9 9-6 9 6v12H3z" /><path d="M7 13h10v8H7zM9 16h6" /></>,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function valueOf(value: number | undefined): string {
  return value === undefined ? "—" : formatNumber(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(value);
}
