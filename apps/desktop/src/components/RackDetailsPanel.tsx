import { useEffect, useRef } from "react";

import type {
  WarehouseCartonStatus,
  WarehouseRackCarton,
  WarehouseRackDetail,
  WarehouseRackLocationDetail,
  WarehouseRackScene,
  WarehouseRackSceneCarton,
  WarehouseRackSceneLocation,
} from "@warehouse/domain";

interface RackDetailsPanelProps {
  readonly detail: WarehouseRackDetail;
  readonly sceneRack?: WarehouseRackScene | null;
  readonly selectedCartonId?: number | null;
}

export function RackDetailsPanel({
  detail,
  sceneRack = null,
  selectedCartonId = null,
}: RackDetailsPanelProps) {
  const aisleCode = detail.aisle.replace(/^SYN-/i, "");
  const allActive = detail.activeLocationCount === detail.locationCount;
  const levels = [...new Set(detail.locations.map((location) => location.level))]
    .sort((first, second) => first.localeCompare(second));
  const averageDistance = detail.locations.reduce(
    (sum, location) => sum + location.distanceFromDispatchM,
    0,
  ) / detail.locationCount;
  const volumeUtilizationPercent = calculateRackVolumeUtilization(sceneRack);
  const sceneLocationsById = new Map(
    sceneRack?.locations.map((location) => [location.id, location]) ?? [],
  );

  return (
    <div className="bay-details">
      <section className="detail-section">
        <div className="section-label-row">
          <span>Raf Detayı</span>
          <span className={allActive ? "state-badge active" : "state-badge partial"}>
            {allActive ? "Aktif" : "Kısmi"}
          </span>
        </div>
        <h3>{aisleCode} - {detail.bay}</h3>
        <p>
          {detail.levelCount} seviye · {detail.locationCount} lokasyon · {detail.cartonCount} koli
        </p>
      </section>

      <section className="detail-section rack-capacity">
        <div className="capacity-heading">
          <h4>Ağırlık Kullanımı</h4>
          <strong>{formatPercent(detail.weightUtilizationPercent)}</strong>
        </div>
        <div className="utilization-track" aria-label="Raf ağırlık kullanım oranı">
          <span
            data-tone={utilizationTone(detail.weightUtilizationPercent)}
            style={{ width: `${clampPercent(detail.weightUtilizationPercent)}%` }}
          />
        </div>
        <dl className="property-list capacity-values">
          <div><dt>Kullanılan ağırlık</dt><dd>{formatWeight(detail.totalUsedWeightKg)}</dd></div>
          <div><dt>Toplam kapasite</dt><dd>{formatWeight(detail.totalMaxWeightKg)}</dd></div>
        </dl>
      </section>

      {volumeUtilizationPercent === null ? null : (
        <section className="detail-section rack-capacity">
          <div className="capacity-heading">
            <h4>Hacim Kullanımı</h4>
            <strong>{formatPercent(volumeUtilizationPercent)}</strong>
          </div>
          <div className="utilization-track" aria-label="Raf hacim kullanım oranı">
            <span
              data-tone={utilizationTone(volumeUtilizationPercent)}
              style={{ width: `${clampPercent(volumeUtilizationPercent)}%` }}
            />
          </div>
        </section>
      )}

      <section className="location-summary rack-summary-grid">
        <SummaryMetric label="Ürün" value={detail.productCount} />
        <SummaryMetric label="Koli" value={detail.cartonCount} />
        <SummaryMetric label="Aktif lokasyon" value={`${detail.activeLocationCount}/${detail.locationCount}`} />
        <SummaryMetric label="Ort. uzaklık" value={`${formatNumber(averageDistance)} m`} />
      </section>

      <div className="level-list">
        {levels.map((level) => {
          const locations = detail.locations.filter(
            (location) => location.level === level,
          );
          const containsSelectedCarton =
            selectedCartonId !== null &&
            locations.some((location) =>
              location.cartons.some(
                (carton) => carton.id === selectedCartonId,
              ),
            );
          return (
            <details
              className="level-card"
              key={level}
              {...(containsSelectedCarton ? { open: true } : {})}
            >
              <summary>{level}<span>{locations.length} lokasyon</span></summary>
              <div className="slot-list">
                {locations.map((location) => (
                  <LocationDetail
                    key={location.id}
                    location={location}
                    sceneLocation={sceneLocationsById.get(location.id)}
                    selectedCartonId={selectedCartonId}
                  />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { readonly label: string; readonly value: string | number }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function LocationDetail({
  location,
  sceneLocation,
  selectedCartonId,
}: {
  readonly location: WarehouseRackLocationDetail;
  readonly sceneLocation: WarehouseRackSceneLocation | undefined;
  readonly selectedCartonId: number | null;
}) {
  const containsSelectedCarton =
    selectedCartonId !== null &&
    location.cartons.some((carton) => carton.id === selectedCartonId);

  return (
    <article
      className="slot-card"
      data-active={location.isActive}
      data-selected={containsSelectedCarton}
    >
      <div className="slot-heading">
        <div><strong>{location.slot}</strong><small>ID {location.id}</small></div>
        <span className={location.isActive ? "slot-state active" : "slot-state inactive"}>
          {location.isActive ? "Aktif" : "Pasif"}
        </span>
      </div>

      <dl className="slot-properties">
        <div><dt>Kullanım</dt><dd>{formatPercent(location.weightUtilizationPercent)}</dd></div>
        {sceneLocation === undefined ? null : (
          <div><dt>Hacim</dt><dd>{formatPercent(sceneLocation.volumeUtilizationPercent)}</dd></div>
        )}
        <div><dt>Ağırlık</dt><dd>{formatWeight(location.usedWeightKg)} / {formatWeight(location.maxWeightKg)}</dd></div>
        <div><dt>Sevkiyat uzaklığı</dt><dd>{formatNumber(location.distanceFromDispatchM)} m</dd></div>
      </dl>

      <div className="location-inventory">
        <div className="inventory-heading">
          <strong>Ürün ve Koliler</strong>
          <span>{location.cartons.length}</span>
        </div>
        {location.cartons.length === 0 ? (
          <p className="empty-inventory">Bu lokasyonda koli bulunmuyor.</p>
        ) : (
          location.cartons.map((carton) => {
            const sceneCarton = sceneLocation?.cartons.find(
              (candidate) => candidate.id === carton.id,
            );
            return (
              <CartonCard
                carton={carton}
                key={carton.id}
                sceneCarton={sceneCarton}
                selected={carton.id === selectedCartonId}
              />
            );
          })
        )}
      </div>
    </article>
  );
}

function calculateRackVolumeUtilization(
  sceneRack: WarehouseRackScene | null,
): number | null {
  if (sceneRack === null || sceneRack.locations.length === 0) return null;

  let totalVolumeCm3 = 0;
  let usedVolumeCm3 = 0;
  for (const location of sceneRack.locations) {
    const locationVolume =
      location.usableWidthCm *
      location.usableDepthCm *
      location.usableHeightCm;
    totalVolumeCm3 += locationVolume;
    usedVolumeCm3 +=
      locationVolume * (location.volumeUtilizationPercent / 100);
  }
  return totalVolumeCm3 === 0 ? null : (usedVolumeCm3 / totalVolumeCm3) * 100;
}

function CartonCard({
  carton,
  sceneCarton,
  selected,
}: {
  readonly carton: WarehouseRackCarton;
  readonly sceneCarton: WarehouseRackSceneCarton | undefined;
  readonly selected: boolean;
}) {
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!selected) return;

    const animationFrame = window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [selected]);

  return (
    <section
      ref={cardRef}
      className="carton-card"
      data-selected={selected}
    >
      <div className="carton-heading">
        <div><strong>{carton.product.name}</strong><span>{carton.product.sku}</span></div>
        <span className="carton-status" data-status={carton.status}>
          {cartonStatusLabel(carton.status)}
        </span>
      </div>

      <div className="quantity-grid">
        <Quantity label="Mevcut" value={carton.currentQty} />
        <Quantity label="Ayrılmış" value={carton.reservedQty} />
        <Quantity label="Kullanılabilir" value={carton.availableQty} />
        <Quantity label="Kapasite" value={carton.capacityQty} />
      </div>

      <div className="carton-meta">
        <span>{carton.cartonNumber}</span>
        <span>{carton.packaging.cartonTypeCode} · {carton.packaging.unitsPerCarton} adet</span>
      </div>
      {sceneCarton === undefined ? null : (
        <p className="carton-physical-details">
          Dış ölçü: {formatNumber(sceneCarton.outerLengthCm)} × {formatNumber(sceneCarton.outerWidthCm)} × {formatNumber(sceneCarton.outerHeightCm)} cm
          {sceneCarton.rotationDegrees === 0
            ? ""
            : ` · ${sceneCarton.rotationDegrees}° döndürülmüş`}
        </p>
      )}
      {carton.expiresAt === null ? null : (
        <p className="expiry-date">Son kullanma: {formatDate(carton.expiresAt)}</p>
      )}
    </section>
  );
}

function Quantity({ label, value }: { readonly label: string; readonly value: number }) {
  return <div><span>{label}</span><strong>{formatNumber(value)}</strong></div>;
}

function cartonStatusLabel(status: WarehouseCartonStatus): string {
  const labels: Record<WarehouseCartonStatus, string> = {
    available: "Müsait",
    reserved: "Ayrılmış",
    depleted: "Tükenmiş",
    quarantined: "Karantina",
  };
  return labels[status];
}

function utilizationTone(value: number | null): "unknown" | "low" | "medium" | "high" {
  if (value === null) return "unknown";
  if (value < 50) return "low";
  if (value < 80) return "medium";
  return "high";
}

function clampPercent(value: number | null): number {
  return value === null ? 0 : Math.min(100, Math.max(0, value));
}

function formatPercent(value: number | null): string {
  return value === null ? "Belirtilmemiş" : `%${formatNumber(value)}`;
}

function formatWeight(value: number | null): string {
  return value === null ? "Belirtilmemiş" : `${formatNumber(value)} kg`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(
    new Date(value),
  );
}
