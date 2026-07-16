# Warehouse Graph Viewer — Teknoloji Kararları

## Belgenin Amacı

Bu belge, proje başlamadan önce kullanılacak temel teknolojileri ve seçim
gerekçelerini tanımlar. Sürümler, bağımlılıklar kurulurken güncel kararlı
sürümler doğrulandıktan sonra sabitlenecektir.

## Karar Özeti

| Alan | Seçim | Kullanım amacı |
| --- | --- | --- |
| Masaüstü kabuğu | Electron | Windows masaüstü uygulaması oluşturmak |
| Arayüz | React | Editör ve simülasyon ekranlarını geliştirmek |
| Programlama dili | TypeScript | Veri modellerini ve modül sınırlarını güvenli tutmak |
| Geliştirme ve paketleme | Vite | Hızlı geliştirme ortamı ve üretim derlemesi |
| 2D görüntüleme | HTML Canvas | Harita, nesne ve simülasyon çizimi |
| 3D görüntüleme | Three.js | İleride eklenecek üç boyutlu depo görünümü |
| Yerel veri | Sürümlendirilmiş JSON | Haritayı kaydetmek, açmak ve taşımak |
| API iletişimi | HTTP ve JSON | Harita ve operasyon verilerini servislerden almak |
| Test altyapısı | Vitest | Domain, editör ve simülasyon kurallarını test etmek |
| Uçtan uca test | Playwright | Temel masaüstü kullanıcı akışlarını doğrulamak |

## Electron

Electron, uygulamanın masaüstü kabuğu olarak kullanılacaktır.

Seçilme nedenleri:

- React ve TypeScript ile doğrudan çalışır.
- Canvas ve Three.js desteği olgundur.
- Windows için kurulabilir uygulama üretilebilir.
- Dosya açma, kaydetme ve işletim sistemi menüleri desteklenir.
- Projenin ilk sürümünde Rust veya başka bir sistem dili gerektirmez.

Electron'a özel işlemler yalnızca `apps/desktop` içinde bulunacaktır. Domain,
simülasyon ve optimizasyon paketleri Electron'a bağımlı olmayacaktır. Böylece
ileride masaüstü kabuğunu değiştirmek mümkün kalır.

## React

React, kullanıcı arayüzünün durumunu ve ekran bileşenlerini yönetmek için
kullanılacaktır.

React'in sorumlulukları:

- Araç ve özellik panelleri
- Düzenleme ve simülasyon modları
- Seçim ve kullanıcı komutları
- Diyaloglar ve bildirimler
- Uygulama ekranlarının bir araya getirilmesi

Harita nesnelerinin yoğun çizimi React bileşenleriyle yapılmayacaktır. React,
Canvas renderer'ı yönetir; renderer çizim işlemini doğrudan gerçekleştirir.

## TypeScript

Tüm uygulama kodunda TypeScript kullanılacaktır. TypeScript özellikle ortak
harita formatının, editör komutlarının ve simülasyon durumunun modüller arasında
tutarlı kalmasını sağlar.

Derleyici ayarları katı olacaktır. Belirsiz veri uygulamaya girerken doğrulanacak,
uygulama içinde kontrolsüz `any` kullanımına izin verilmeyecektir.

## Vite

Vite, React arayüzünün geliştirme sunucusu ve üretim derlemesi için
kullanılacaktır. Electron ana süreci ile arayüz derlemesi ayrı tutulacaktır.

Vite yalnızca geliştirme ve derleme aracıdır; domain veya simülasyon mimarisini
belirlemez.

## HTML Canvas ile 2D Görüntüleme

İlk sürümde harita HTML Canvas üzerinde çizilecektir.

Canvas'ın sorumlulukları:

- Depo sınırı ve ızgara
- Raf, koridor, giriş, çıkış ve engeller
- Seçim ve taşıma göstergeleri
- Yakınlaştırma ve kaydırma
- Rotalar, araçlar ve hareket animasyonları
- Yoğunluk ve optimizasyon katmanları

Canvas piksel koordinatları kalıcı veri olarak saklanmayacaktır. Domain modeli
gerçek ölçüleri kullanır; renderer bu ölçüleri ekran koordinatlarına dönüştürür.

## Three.js ile 3D Görüntüleme

Three.js ilk sürümde kurulmayacak ve kullanılmayacaktır. 2D editör ve simülasyon
doğrulandıktan sonra `packages/rendering-3d` içinde eklenecektir.

3D renderer:

- `domain` paketindeki aynı haritayı okuyacak,
- `simulation` paketindeki aynı araç durumlarını gösterecek,
- 2D renderer'a bağımlı olmayacak,
- harita veya simülasyon verisini değiştirmeyecektir.

Bu ayrım sayesinde 3D desteği yeni bir görüntüleme seçeneği olarak eklenir;
uygulamanın yeniden yazılması gerekmez.

## Veri Saklama

İlk sürümde haritalar yerel JSON dosyalarında tutulacaktır. Bu seçim veriyi
incelemeyi, örnek üretmeyi ve API ile paylaşmayı kolaylaştırır.

Her kayıt aşağıdaki üst bilgileri taşımalıdır:

- Format sürümü
- Harita kimliği
- Harita adı
- Oluşturulma ve güncellenme zamanı
- Ölçü birimi

SQLite başlangıçta kullanılmayacaktır. Harita sayısı, sorgulama veya operasyon
geçmişi ihtiyacı JSON'un sınırlarını aşarsa ayrıca değerlendirilir.

## API İletişimi

API bağlantıları `packages/api-client` içinde bulunacaktır. İlk sürüm gerçek bir
API'ye bağımlı başlamayacaktır; aynı domain modeli yerel JSON ile çalışacaktır.

API eklendiğinde:

- İstek ve yanıtlar çalışma zamanı doğrulamasından geçirilir.
- API veri yapısı domain modeline dönüştürülür.
- Ağ hataları arayüzden bağımsız sonuçlara çevrilir.
- Kimlik doğrulama bilgileri kaynak koda veya harita dosyasına yazılmaz.

## Test Yaklaşımı

### Birim testleri

Vitest ile aşağıdaki kurallar test edilir:

- Harita sınırları
- Nesne çakışmaları
- Taşıma ve döndürme işlemleri
- Rota bulma
- Simülasyon zamanı ve görev durumu
- Optimizasyon puanları
- Veri dönüştürme ve sürüm yükseltme

### Entegrasyon testleri

Paketler arasındaki veri akışları test edilir. Örneğin JSON'dan açılan haritanın
simülasyonda kullanılması ve tekrar kaydedilmesi doğrulanır.

### Uçtan uca testler

Playwright, ilk çalışan masaüstü sürümünden sonra eklenecektir. Raf ekleme,
haritayı kaydetme ve simülasyonu başlatma gibi kritik kullanıcı akışlarını test
eder.

## Başlangıçta Kullanılmayacak Teknolojiler

- Three.js: 3D aşamasına kadar kurulmayacak.
- SQLite: JSON yetersiz kalana kadar eklenmeyecek.
- Sunucu veya veritabanı: Gerçek API gereksinimi netleşene kadar kurulmayacak.
- Durum yönetimi kütüphanesi: React'in yerleşik araçları yetersiz kalmadan
  eklenmeyecek.
- Fizik motoru: Izgara tabanlı depo simülasyonu için başlangıçta gerekli değildir.
- UI bileşen kütüphanesi: Arayüz ihtiyaçları belirlenmeden seçilmeyecek.

## Bağımlılık Kuralları

- Her bağımlılığın açık bir kullanım amacı olmalıdır.
- Kullanılmayan gelecekteki teknolojiler önceden kurulmaz.
- Kurulan sürümler kilit dosyasında sabitlenir.
- Büyük sürüm yükseltmeleri test edilmeden yapılmaz.
- Masaüstü güvenliği için Electron renderer sürecine doğrudan Node.js erişimi
  verilmez.

## İlk Teknik Kurulum Sırası

1. Kök çalışma alanı ve ortak TypeScript ayarları
2. `packages/domain` paketi
3. `packages/rendering-2d` paketi
4. `apps/desktop` içinde boş uygulama penceresi
5. Birim test altyapısı
6. Editör işlemleri
7. Yerel kayıt
8. Simülasyon motoru

Her adım ayrı doğrulanmalı ve bir sonraki adıma geçmeden önce çalışır durumda
olmalıdır.
