export function App() {
  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="product-name">Warehouse Graph Viewer</p>
          <h1>Depo haritası</h1>
        </div>

        <nav className="mode-switch" aria-label="Çalışma modu">
          <button className="active" type="button">
            Düzenleme
          </button>
          <button type="button">Simülasyon</button>
        </nav>
      </header>

      <section className="workspace">
        <aside className="side-panel">
          <h2>Araçlar</h2>
          <p>Harita araçları sonraki adımda eklenecek.</p>
        </aside>

        <section className="empty-canvas" aria-label="Harita çalışma alanı">
          <div>
            <strong>2D çalışma alanı</strong>
            <span>Canvas görüntüleyici henüz eklenmedi.</span>
          </div>
        </section>

        <aside className="side-panel">
          <h2>Özellikler</h2>
          <p>Bir harita nesnesi seçildiğinde özellikleri burada görünecek.</p>
        </aside>
      </section>
    </main>
  );
}
