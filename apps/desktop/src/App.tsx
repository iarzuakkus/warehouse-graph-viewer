import { useMemo, useState } from "react";

import type { StorageBay } from "@warehouse/domain";

import { sampleWarehouseMap } from "./sample-map.js";
import { useWarehouseLocations } from "./useWarehouseLocations.js";
import { WarehouseCanvas } from "./WarehouseCanvas.js";

export function App() {
  const locationsState = useWarehouseLocations();
  const [selectedBayKey, setSelectedBayKey] = useState<string | null>(null);
  const selectedBay = useMemo(() => {
    if (locationsState.status !== "success" || selectedBayKey === null) {
      return null;
    }

    const [aisleCode, bayCode] = selectedBayKey.split("/");
    const aisle = locationsState.hierarchy.aisles.find(
      (item) => item.code === aisleCode,
    );
    return aisle?.bays.find((item) => item.code === bayCode) ?? null;
  }, [locationsState, selectedBayKey]);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="product-name">Warehouse Graph Viewer</p>
          <h1>Depo haritası</h1>
        </div>

        <nav className="mode-switch" aria-label="Gorunum modu">
          <button className="active" type="button">
            Harita
          </button>
          <button type="button" disabled>Simülasyon</button>
        </nav>
      </header>

      <section className="workspace">
        <aside className="side-panel">
          <h2>Araçlar</h2>
          <p>Harita araçları sonraki adımda eklenecek.</p>
        </aside>

        <WarehouseCanvas
          map={sampleWarehouseMap}
          hierarchy={
            locationsState.status === "success"
              ? locationsState.hierarchy
              : null
          }
          selectedBayKey={selectedBayKey}
          onBaySelect={(aisleCode, bayCode) =>
            setSelectedBayKey(`${aisleCode}/${bayCode}`)
          }
        />

        <aside className="side-panel">
          <h2>Özellikler</h2>
          <LocationsStatus state={locationsState} />
          {selectedBay !== null && selectedBayKey !== null ? (
            <BayDetails
              aisleCode={selectedBayKey.split("/")[0] ?? ""}
              bay={selectedBay}
              onClose={() => setSelectedBayKey(null)}
            />
          ) : null}
        </aside>
      </section>
    </main>
  );
}

interface BayDetailsProps {
  readonly aisleCode: string;
  readonly bay: StorageBay;
  readonly onClose: () => void;
}

function BayDetails({ aisleCode, bay, onClose }: BayDetailsProps) {
  const locations = bay.levels.flatMap((level) => level.locations);
  const activeCount = locations.filter((location) => location.isActive).length;

  return (
    <section className="bay-details">
      <div className="details-heading">
        <div>
          <span>{aisleCode}</span>
          <h3>{bay.code}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Detayi kapat">
          ×
        </button>
      </div>

      <dl className="details-summary">
        <div><dt>Seviye</dt><dd>{bay.levels.length}</dd></div>
        <div><dt>Lokasyon</dt><dd>{locations.length}</dd></div>
        <div><dt>Aktif</dt><dd>{activeCount}/{locations.length}</dd></div>
      </dl>

      <div className="level-list">
        {bay.levels.map((level) => (
          <section className="level-card" key={level.code}>
            <h4>{level.code}</h4>
            <div className="slot-list">
              {level.locations.map((location) => (
                <article
                  className="slot-card"
                  data-active={location.isActive}
                  key={location.id}
                >
                  <strong>{location.slot}</strong>
                  <span>ID {location.id}</span>
                  <span>
                    {location.maxWeightKg === null
                      ? "Agirlik belirtilmemis"
                      : `${location.maxWeightKg} kg`}
                  </span>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

interface LocationsStatusProps {
  readonly state: ReturnType<typeof useWarehouseLocations>;
}

function LocationsStatus({ state }: LocationsStatusProps) {
  if (state.status === "loading") {
    return (
      <div className="api-status" data-status="loading">
        <span className="status-indicator" />
        <div>
          <strong>Lokasyonlar yukleniyor</strong>
          <p>Depolama verileri API'den aliniyor.</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="api-status" data-status="error">
        <span className="status-indicator" />
        <div>
          <strong>Lokasyon verisi alinamadi</strong>
          <p>{state.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="api-status" data-status="success">
      <span className="status-indicator" />
      <div>
        <strong>Depolama verisi hazir</strong>
        <dl className="graph-summary">
          <div>
            <dt>Koridor</dt>
            <dd>{state.hierarchy.aisles.length}</dd>
          </div>
          <div>
            <dt>Lokasyon</dt>
            <dd>{state.hierarchy.locationCount}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
