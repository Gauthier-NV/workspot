// app/javascript/controllers/map_controller.js
import { Controller } from "@hotwired/stimulus";
import mapboxgl from "mapbox-gl";

export default class extends Controller {
  static values = {
    style: String,
    center: Array, // [lng, lat]
    zoom: Number
  }

  connect() {
    const token = document.querySelector('meta[name="mapbox-token"]')?.content;
    if (!token) { console.error("Mapbox token manquant"); return; }
    mapboxgl.accessToken = token;

    this.map = new mapboxgl.Map({
  container: this.element,
  style: this.styleValue || "mapbox://styles/workspots/cmflemqjc007y01secq3x89ng",
  center: [2.3522, 48.8566],
  zoom: 11.4,
  pitch: 0,         // ← copie les valeurs de Studio
  bearing: 0,      // ← idem
  attributionControl: false
});

    // Contrôles
    this.map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    this.map.addControl(new mapboxgl.ScaleControl({ maxWidth: 80, unit: "metric" }));
    this.map.addControl(new mapboxgl.AttributionControl({ compact: true }));

    // Marqueur par défaut
    new mapboxgl.Marker({ color: "#652d56" })
      .setLngLat((this.centerValue && this.centerValue.length === 2) ? this.centerValue : [2.3522, 48.8566])
      .addTo(this.map);

    // 👉 Charge tous les spots quand le style est prêt
    this.map.on("load", () => this.loadAndRenderSpots());

    // Logs utiles
    this.map.on("error", (e) => console.error("Mapbox error:", e?.error || e));
  }

  // --- AJOUT ---
  async loadAndRenderSpots() {
    try {
      const res = await fetch("/spots.json");
      const spots = await res.json();

      const features = spots.map(s => ({
        type: "Feature",
        properties: { id: s.id, name: s.name },
        geometry: { type: "Point", coordinates: [s.lng, s.lat] }
      }));

      const sourceId = "spots-source";
      const data = { type: "FeatureCollection", features };

      // Source GeoJSON
      if (this.map.getSource(sourceId)) {
        this.map.getSource(sourceId).setData(data);
      } else {
        this.map.addSource(sourceId, { type: "geojson", data });
      }

      // Layer de ronds bleus (n’ajoute qu’une fois)
      if (!this.map.getLayer("spots-circles")) {
        this.map.addLayer({
          id: "spots-circles",
          type: "circle",
          source: sourceId,
          paint: {
            "circle-radius": 7,
            "circle-color": "#3656e3",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": 0.9
          }
        });
      }

      // Fit sur tous les points
      if (features.length > 0) {
        const b = new mapboxgl.LngLatBounds();
        features.forEach(f => b.extend(f.geometry.coordinates));
        this.map.fitBounds(b, { padding: 60, maxZoom: 14, duration: 600 });
      }
    } catch (err) {
      console.error("Chargement spots échoué:", err);
    }
  }
  // --- FIN AJOUT ---

  disconnect() {
    // Nettoyage quand la vue change (Turbo)
    if (this.map) this.map.remove();
  }
}
