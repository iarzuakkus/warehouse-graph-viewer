# Warehouse Graph Viewer — API Sözleşmesi

## Amaç

Bu belge, Warehouse Graph Viewer ile mevcut Warehouse Slotting Optimizer API'si
arasındaki veri sözleşmesini tanımlar. Belge, mevcut backend kaynak kodu ve yerel
OpenAPI şeması incelenerek hazırlanmıştır.

İncelenen backend dizini:

```text
C:\Users\ASUS\warehouse\warehouse-slotting-optimizer\app
```

Yerel API adresi:

```text
http://127.0.0.1:8000
```

OpenAPI şeması:

```text
http://127.0.0.1:8000/openapi.json
```

## Sorumluluk Ayrımı

Backend operasyonel depo verisini ve rota grafını sağlar. Harita uygulaması ise
fiziksel yerleşim geometrisini ve görsel düzenleme bilgilerini saklar.

```text
Warehouse Slotting Optimizer API
├── Depo lokasyonları
├── Lokasyon hiyerarşisi
├── Yürüyüş grafı
├── Düğümler ve kenarlar
└── Hesaplanmış rotalar

Warehouse Graph Viewer
├── Depo dış sınırları
├── Raf geometrileri
├── Koridor geometrileri
├── Giriş, çıkış ve engelli alanlar
├── Görsel yerleşim ayarları
└── Simülasyon görünümü
```

İki sistem öncelikle `location_id` ile eşleştirilir.

## Warehouse Location Modeli

Backend'deki `WarehouseLocation` bir fiziksel rafı değil, raf içindeki tek bir
depolama lokasyonunu temsil eder.

| Alan | Tip | Zorunlu | Açıklama |
| --- | --- | --- | --- |
| `id` | integer | Evet | Veritabanı lokasyon kimliği |
| `aisle` | string | Evet | Koridor kodu |
| `bay` | string | Evet | Koridor içindeki bay kodu |
| `level` | string | Evet | Dikey seviye kodu |
| `slot` | string | Evet | Seviye içindeki slot kodu |
| `max_weight_kg` | decimal veya null | Hayır | Lokasyonun azami ağırlığı |
| `distance_from_dispatch_m` | decimal | Evet | Sevkiyat noktasına kayıtlı mesafe |
| `is_active` | boolean | Evet | Lokasyonun aktiflik durumu |
| `created_at` | datetime | Okuma | Oluşturulma zamanı |
| `updated_at` | datetime | Okuma | Güncellenme zamanı |

`aisle`, `bay`, `level` ve `slot` birleşimi benzersizdir.

Sentetik lokasyon kodları aşağıdaki biçimdedir:

```text
aisle: SYN-A001
bay:   B001
level: L01
slot:  S01
```

Graf servisi şu anda yalnızca bu sentetik kod biçimini düzenli depo grafına
dönüştürebilmektedir.

## Graf Düğümü

`WarehouseGraphNodeRead` görselleştirilebilen tek bir graf düğümüdür.

| Alan | Tip | Zorunlu | Açıklama |
| --- | --- | --- | --- |
| `id` | string | Evet | Graf içindeki benzersiz düğüm kimliği |
| `node_type` | enum | Evet | `dispatch`, `pickup` veya `location` |
| `label` | string | Evet | Kullanıcıya gösterilecek etiket |
| `x` | number | Evet | Metre cinsinden yatay koordinat |
| `y` | number | Evet | Metre cinsinden dikey koordinat |
| `location_id` | integer veya null | Hayır | Backend lokasyon kimliği |

### Düğüm türleri

#### `dispatch`

Sevkiyat başlangıç noktasıdır. `location_id` içermez.

```text
id: dispatch
label: Sevkiyat
```

#### `pickup`

Bir koridor ve bay için toplama/yürüme noktasıdır. `location_id` içermez.

Örnek kimlik:

```text
pickup:A001:B001
```

#### `location`

Tek bir raf gözünü temsil eder ve `location_id` içerir.

Örnek kimlik:

```text
location:A001:B001:L01:S01
```

## Graf Kenarı

`WarehouseGraphEdgeRead` iki düğüm arasındaki çift yönlü geçişi temsil eder.

| Alan | Tip | Zorunlu | Açıklama |
| --- | --- | --- | --- |
| `source` | string | Evet | Başlangıç düğümü kimliği |
| `target` | string | Evet | Hedef düğüm kimliği |
| `distance_m` | number | Evet | Pozitif metre cinsinden mesafe |

API her fiziksel bağlantıyı tek kenar olarak döndürür. Backend grafı çift yönlü
olduğu için viewer bu kenarı her iki yönde de geçilebilir kabul eder.

## Graf Yerleşimi Endpoint'i

```http
GET /warehouse-graph/layout
```

Query parametresi:

| Parametre | Tip | Varsayılan | Açıklama |
| --- | --- | --- | --- |
| `include_locations` | boolean | `false` | Raf gözü düğümlerini yanıta dahil eder |

Viewer ayrıntılı harita eşleştirmesi için şu çağrıyı kullanmalıdır:

```http
GET /warehouse-graph/layout?include_locations=true
```

Yanıt modeli:

| Alan | Tip | Açıklama |
| --- | --- | --- |
| `node_count` | integer | Yanıttaki düğüm sayısı |
| `edge_count` | integer | Yanıttaki kenar sayısı |
| `nodes` | `WarehouseGraphNodeRead[]` | Düğümler |
| `edges` | `WarehouseGraphEdgeRead[]` | Kenarlar |

Örnek yapı:

```json
{
  "node_count": 3,
  "edge_count": 2,
  "nodes": [
    {
      "id": "dispatch",
      "node_type": "dispatch",
      "label": "Sevkiyat",
      "x": -20,
      "y": 0,
      "location_id": null
    },
    {
      "id": "pickup:A001:B001",
      "node_type": "pickup",
      "label": "A001-B001",
      "x": 0,
      "y": 3,
      "location_id": null
    },
    {
      "id": "location:A001:B001:L01:S01",
      "node_type": "location",
      "label": "A001-B001-L01-S01",
      "x": 0,
      "y": 3,
      "location_id": 1
    }
  ],
  "edges": [
    {
      "source": "dispatch",
      "target": "pickup:A001:B001",
      "distance_m": 23
    }
  ]
}
```

Bu örnek sözleşmeyi göstermek içindir; gerçek kimlikler ve koordinatlar API
yanıtından alınmalıdır.

## Sevkiyattan Lokasyona Rota

```http
GET /warehouse-graph/routes/from-dispatch/{location_id}
```

Path parametresi pozitif bir backend lokasyon kimliğidir.

Yanıt:

| Alan | Tip | Açıklama |
| --- | --- | --- |
| `location_id` | integer | Hedef lokasyon |
| `distance_m` | number | Toplam rota mesafesi |
| `nodes` | string[] | Sıralı düğüm kimlikleri |

## İki Lokasyon Arasında Rota

```http
GET /warehouse-graph/routes/between-locations
```

Query parametreleri:

| Parametre | Tip | Açıklama |
| --- | --- | --- |
| `start_location_id` | integer | Başlangıç lokasyonu |
| `destination_location_id` | integer | Hedef lokasyon |

Yanıt:

| Alan | Tip | Açıklama |
| --- | --- | --- |
| `start_location_id` | integer | Başlangıç lokasyonu |
| `destination_location_id` | integer | Hedef lokasyon |
| `distance_m` | number | Toplam rota mesafesi |
| `nodes` | string[] | Sıralı düğüm kimlikleri |

## Rota Hesaplama Davranışı

Backend en kısa rotayı Dijkstra algoritmasıyla hesaplar. Graf kenarları pozitif
mesafeli ve çift yönlüdür.

Düzenli sentetik grafın varsayılan fiziksel değerleri:

| Ayar | Değer | Açıklama |
| --- | --- | --- |
| `aisle_spacing_m` | `20.0` | Koridorlar arası mesafe |
| `bay_spacing_m` | `3.0` | Bay'ler arası mesafe |
| `level_access_m` | `1.0` | Seviye başına erişim maliyeti |
| `slot_access_m` | `0.25` | Slot başına erişim maliyeti |

Graf boyutları aktif sentetik lokasyonlardaki en büyük aisle, bay, level ve slot
değerlerinden hesaplanır. Bu değerler ayrı bir API sözleşmesi olarak sunulmadığı
için viewer bunları değiştirilebilir fiziksel raf ölçüleri olarak kabul etmemelidir.

## Hata Yanıtları

Graf endpointleri aşağıdaki durumları üretebilir:

| HTTP durumu | Anlamı |
| --- | --- |
| `404 Not Found` | İstenen aktif lokasyon graf eşlemesinde bulunamadı |
| `409 Conflict` | Aktif lokasyonlar geçerli bir düzenli grafa dönüştürülemedi |
| `422 Unprocessable Entity` | Parametre doğrulaması başarısız oldu |

Viewer hata ayrıntısını kullanıcıya doğrudan teknik metin olarak göstermek yerine
anlaşılır bir uygulama mesajına dönüştürmelidir.

## API'de Bulunmayan Fiziksel Bilgiler

Mevcut API aşağıdaki bilgileri sağlamaz:

- Deponun dış sınırı, genişliği ve derinliği
- Fiziksel raf kimliği
- Raf başlangıç konumu
- Raf genişliği, derinliği ve yüksekliği
- Rafın dönüş açısı
- Koridorun fiziksel genişliği
- Giriş ve çıkış alanlarının boyutları
- Kolonlar, duvarlar ve yasak bölgeler
- Görsel renk, etiket konumu ve katman sırası
- Kullanıcı tarafından düzenlenen harita sürümü

Bu bilgiler Warehouse Graph Viewer'ın yerel harita sözleşmesinde tutulmalıdır.

## Viewer Tarafında Tutulacak Eşleme

Viewer fiziksel raf ile backend lokasyonlarını ayrı kavramlar olarak saklamalıdır.

Önerilen ilişki:

```text
Fiziksel raf
├── Viewer raf kimliği
├── Konum ve boyut
├── Dönüş ve yükseklik
└── Backend lokasyon kimlikleri
    ├── location_id 101
    ├── location_id 102
    └── location_id 103
```

Bir raf birden fazla bay, level ve slot içerebilir. Bu nedenle fiziksel rafın
kimliği doğrudan tek bir `location_id` olarak modellenmemelidir.

## Koordinat Kuralları

- API'deki `x` ve `y` değerleri metre olarak yorumlanır.
- Viewer kalıcı veride piksel koordinatı saklamaz.
- Ekran koordinatına dönüşüm yalnızca renderer içinde yapılır.
- API graf koordinatları operasyonel düğüm konumlarıdır; raf dikdörtgeninin
  geometrisini tek başına belirlemez.
- Viewer'da düzenlenen raf geometrisi ile API düğümleri ayrı katmanlarda tutulur.

## Senkronizasyon Kuralları

- Viewer API verisini okurken `location_id` değerini korur.
- Bilinmeyen `node_type` değeri sessizce kabul edilmez.
- Eksik bir `source` veya `target` düğümüne bağlı kenar geçersiz sayılır.
- `node_count` ve `edge_count`, gerçek dizi uzunluklarıyla karşılaştırılır.
- Aynı `location_id` birden fazla location düğümüne bağlanırsa veri hatası
  raporlanır.
- API erişilemez olduğunda yerel harita açılabilir; operasyonel grafın güncel
  olmadığı kullanıcıya bildirilir.

## Açık Konular

Aşağıdaki kararlar uygulama geliştirilmeden önce ayrıca netleştirilmelidir:

1. Fiziksel raf geometrileri yalnızca yerel mi tutulacak, yoksa backend'e yeni
   endpoint eklenecek mi?
2. Kullanıcının değiştirdiği yerleşim API graf koordinatlarını güncelleyecek mi?
3. Koridor ve raf ölçüleri gerçek depo verisinden mi, kullanıcı girişinden mi
   alınacak?
4. Viewer birden fazla depo veya harita sürümünü destekleyecek mi?
5. Simülasyon backend tarafından hesaplanan rotayı mı kullanacak, yoksa yerel
   fiziksel haritadan ayrıca rota üretecek mi?

Bu konular karara bağlanana kadar API modelleri ile viewer'ın fiziksel harita
modeli birbirinden ayrı tutulmalıdır.
