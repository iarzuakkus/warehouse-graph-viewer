# Warehouse Graph Viewer — Mimari

## Amaç

Warehouse Graph Viewer; depo alanlarını iki boyutlu olarak düzenlemek, yerleşimi
simüle etmek ve ileride aynı veriyi üç boyutlu olarak göstermek için geliştirilen
bir masaüstü uygulamasıdır.

İlk hedef çalışan ve anlaşılır bir 2D editördür. 3D görüntüleme, temel veri modeli
ve simülasyon kuralları değiştirilmeden sonradan eklenebilmelidir.

## Temel İlkeler

- Harita verisi, ekranda nasıl çizildiğinden bağımsız tutulur.
- Simülasyon motoru 2D veya 3D görüntüleyiciye bağlı olmaz.
- Editör, simülasyon ve optimizasyon birbirinden ayrı modüllerdir.
- API bağlantısı uygulamanın iç veri modelini doğrudan belirlemez.
- Kaydedilen haritalar sürümlendirilmiş ortak bir veri formatı kullanır.
- İlk sürüm sade tutulur; ihtiyaç doğrulanmadan karmaşık özellik eklenmez.

## Dizinlerin Sorumlulukları

### `apps/desktop`

Masaüstü uygulamasının giriş noktasıdır. Pencereleri, ekranları, menüleri ve
modüllerin bir araya getirilmesini yönetir. İş kuralları burada tutulmaz.

### `packages/domain`

Sistemin ortak veri modelidir. Depo, alan, raf, koridor, giriş, çıkış, engel,
araç, görev ve koordinat gibi temel kavramları tanımlar.

Bu paket herhangi bir arayüz veya görüntüleme teknolojisine bağlı olamaz.

### `packages/editor`

Harita düzenleme işlemlerini yönetir:

- Alan oluşturma ve boyut değiştirme
- Raf, koridor, giriş, çıkış ve engel ekleme
- Nesneleri seçme, taşıma, döndürme ve silme
- Izgaraya hizalama
- Çakışma ve sınır kontrolleri
- Geri alma ve yineleme işlemleri

### `packages/simulation`

Harita üzerinde çalışan simülasyon motorudur:

- Araç ve çalışanların durumu
- Görev kuyruğu
- Rota oluşturma
- Zaman ilerletme
- Hareket, bekleme ve görev tamamlama
- Çarpışma ve tıkanıklık kontrolleri
- Simülasyon sonuçlarının üretilmesi

Simülasyon görsel animasyon üretmez; yalnızca güncel durumu hesaplar.

### `packages/optimization`

Yerleşim ve operasyon önerilerini hesaplar:

- Alan kullanım oranı
- Koridor mesafeleri
- Raf çakışmaları
- Toplam rota uzunluğu
- Giriş ve çıkış erişilebilirliği
- Alternatif raf yerleşimleri

Optimizasyon sonuçları doğrudan haritayı değiştirmez. Kullanıcıya uygulanabilir
bir öneri olarak sunulur.

### `packages/rendering-2d`

Ortak harita ve simülasyon verisini iki boyutlu olarak gösterir. Yakınlaştırma,
kaydırma, seçim işaretleri, ızgara ve hareket animasyonları bu pakette yer alır.

### `packages/rendering-3d`

İleride eklenecek üç boyutlu görüntüleyicidir. `rendering-2d` ile aynı harita ve
simülasyon verisini kullanır. Domain veya simülasyon paketinde 3D motoruna özgü
tipler bulunmaz.

### `packages/api-client`

Uzak servislerle haberleşir. API yanıtlarını domain modeline, domain modelini de
API isteklerine dönüştürür. Uygulamanın geri kalanı doğrudan HTTP ayrıntılarını
bilmez.

### `packages/persistence`

Haritaların ve kullanıcı ayarlarının yerel olarak kaydedilmesini ve açılmasını
yönetir. Dosya formatı sürümlendirilir ve eski kayıtların dönüştürülebilmesine
izin verir.

### `packages/shared`

Birden fazla paketin gerçekten ortak kullandığı küçük yardımcıları içerir. Domain
kavramları veya belirli bir modüle ait iş kuralları buraya taşınmaz.

### `tests/integration`

Birden fazla modülün birlikte çalışmasını doğrular. Örneğin kaydedilen bir
haritanın tekrar açılması veya API verisinin simülasyonda kullanılması burada
test edilir.

### `tests/e2e`

Masaüstü uygulamasındaki temel kullanıcı akışlarını baştan sona doğrular.

## Veri Akışı

```text
API veya yerel dosya
        |
        v
    Domain modeli
        |
        +------------------+
        |                  |
        v                  v
      Editör          Simülasyon
        |                  |
        +--------+---------+
                 |
                 v
        2D veya 3D renderer
                 |
                 v
              Kullanıcı
```

Editör harita modelini değiştirir. Simülasyon aynı haritayı okuyarak zaman içinde
değişen araç ve görev durumlarını üretir. Seçilen renderer bu iki veri kaynağını
görselleştirir.

## 2D'den 3D'ye Geçiş

Haritadaki konumlar gerçek dünya ölçüleriyle saklanır. İlk sürümde yükseklik
zorunlu değildir; raf gibi nesneler için isteğe bağlı yükseklik bilgisi baştan
veri modelinde desteklenebilir.

2D renderer yatay düzlemdeki konum ve boyutları çizer. 3D renderer aynı bilgileri
zemin koordinatları olarak kullanır ve yükseklik değerini üçüncü eksene taşır.
Bu nedenle 3D aşamasında harita veya simülasyon verisinin yeniden yazılması
gerekmez.

## İlk Sürüm Sınırı

İlk çalışır sürüm aşağıdakilerle sınırlıdır:

1. Depo alanı oluşturma
2. Raf ekleme, seçme, taşıma ve silme
3. Haritayı yerel olarak kaydetme ve açma
4. Tek bir aracın başlangıçtan hedefe rota bulması
5. Rotanın 2D görünümde simüle edilmesi

API, gelişmiş optimizasyon, çoklu araç trafiği ve 3D görüntüleme bu temel akış
doğrulandıktan sonra eklenir.

## Mimari Kurallar

- `domain` başka bir proje paketine bağımlı olamaz.
- `simulation` ve `optimization`, renderer paketlerine bağımlı olamaz.
- Renderer paketleri harita verisini değiştiremez.
- `api-client` dış veri formatlarını domain dışına sızdıramaz.
- Masaüstü uygulaması iş kurallarını tekrar uygulayamaz; ilgili paketi kullanır.
- 2D ve 3D için ayrı harita modelleri oluşturulamaz.
