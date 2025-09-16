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

    // Logs utiles
    this.map.on("error", (e) => console.error("Mapbox error:", e?.error || e));
  }

  disconnect() {
    // Nettoyage quand la vue change (Turbo)
    if (this.map) this.map.remove();
  }
}
