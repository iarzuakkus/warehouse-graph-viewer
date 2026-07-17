import type {
  WarehouseCartonStatus,
  WarehouseRackCarton,
  WarehouseRackDetail,
  WarehouseRackLocationDetail,
} from "@warehouse/domain";

export function RackDetailsPanel({ detail }: { readonly detail: WarehouseRackDetail }) {
  const aisleCode = detail.aisle.replace(/^SYN-/i, "");
  const allActive = detail.activeLocationCount === detail.locationCount;
  const levels = [...new Set(detail.locations.map((location) => location.level))]
    .sort((first, second) => first.localeCompare(second));
  const averageDistance = detail.locations.reduce(
    (sum, location) => sum + location.distanceFromDispatchM,
    0,
  ) / detail.locationCount;

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
          return (
            <details className="level-card" key={level}>
              <summary>{level}<span>{locations.length} lokasyon</span></summary>
              <div className="slot-list">
                {locations.map((location) => (
                  <LocationDetail key={location.id} location={location} />
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

function LocationDetail({ location }: { readonly location: WarehouseRackLocationDetail }) {
  return (
    <article className="slot-card" data-active={location.isActive}>
      <div className="slot-heading">
        <div><strong>{location.slot}</strong><small>ID {location.id}</small></div>
        <span className={location.isActive ? "slot-state active" : "slot-state inactive"}>
          {location.isActive ? "Aktif" : "Pasif"}
        </span>
      </div>

      <dl className="slot-properties">
        <div><dt>Kullanım</dt><dd>{formatPercent(location.weightUtilizationPercent)}</dd></div>
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
          location.cartons.map((carton) => (
            <CartonCard carton={carton} key={carton.id} />
          ))
        )}
      </div>
    </article>
  );
}

function CartonCard({ carton }: { readonly carton: WarehouseRackCarton }) {
  return (
    <section className="carton-card">
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
