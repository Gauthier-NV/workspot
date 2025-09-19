// app/javascript/controllers/map_controller.js
import { Controller } from "@hotwired/stimulus";
import mapboxgl from "mapbox-gl";

/* ---------- Helpers ---------- */
const normalizeArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") {
    try { const p = JSON.parse(val); return Array.isArray(p) ? p.filter(Boolean) : []; }
    catch { return val.split(",").map(s => s.trim()).filter(Boolean); }
  }
  return [];
};

const toNum = (v) => {
  if (v == null || v === "") return NaN;
  const s = String(v).replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const saneCoords = (lng, lat) => {
  let L = toNum(lng), A = toNum(lat);
  const looksLng = (x) => Math.abs(x) <= 180;
  const looksLat = (x) => Math.abs(x) <= 85;
  if (!Number.isFinite(L) || !Number.isFinite(A)) return null;
  if (!looksLng(L) || !looksLat(A)) {
    if (looksLng(A) && looksLat(L)) [L, A] = [A, L]; // inversés
  }
  return (looksLng(L) && looksLat(A)) ? [L, A] : null;
};

const spotCoords = (s) => saneCoords(s.lng ?? s.longitude, s.lat ?? s.latitude);

/* ---------- Controller ---------- */
export default class extends Controller {
  static values = {
    style: String,
    center: Array,
    zoom: Number,
    apiUrl: { type: String, default: "/spots.json" }
  };

  connect() {
    const token = document.querySelector('meta[name="mapbox-token"]')?.content;
    if (!token) { console.error("Mapbox token manquant"); return; }
    mapboxgl.accessToken = token;

    this.sourceId   = "spots-source";
    this.layerId    = "spots-circles";
    this.selectedId = null;
    this.popup      = null;
    this._nudging   = false;

    this.map = new mapboxgl.Map({
      container: this.element,
      style: this.styleValue || "mapbox://styles/mapbox/light-v11",
      center: Array.isArray(this.centerValue) ? this.centerValue : [2.3522, 48.8566],
      zoom: Number.isFinite(this.zoomValue) ? this.zoomValue : 11.4,
      attributionControl: false,
      dragRotate: false,
      touchPitch: false,
      pitchWithRotate: false,
      // 🔽 élargis, ou supprime complètement si besoin
      maxBounds: [[-1.0, 47.8], [5.5, 50.5]]
    });

    // Contrôles sobres
    this.map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    // Géoloc (manuel)
    this.map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showUserHeading: true
    }), "top-right");

    this.map.on("error", (e) => console.error("Mapbox error:", e?.error || e));
    this.map.on("load",  () => this._loadAndRenderSpots());

    // Ferme la popup si clic hors spot
    this.map.on("click", (e) => {
      const hits = this.map.queryRenderedFeatures(e.point, { layers: [this.layerId] });
      if (!hits.length && this.popup) { this.popup.remove(); this.popup = null; }
    });

    // ❌ PAS d’_ensurePopupInView() sur moveend/resize -> évite les dérives
  }

  async _loadAndRenderSpots() {
    try {
      const res = await fetch(this.apiUrlValue, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const spots = await res.json();

      const features = spots.map((s) => {
        const coords = spotCoords(s);
        if (!coords) { console.warn("Spot ignoré (coords invalides):", s.id, s.name); return null; }
        return {
          type: "Feature",
          id: String(s.id),
          properties: {
            id: String(s.id),
            name: s.name || "Café",
            address: s.address || "",
            description: s.description || "",
            button_link: s.button_link || "",
            tags: normalizeArray(s.tags)
          },
          geometry: { type: "Point", coordinates: coords }
        };
      }).filter(Boolean);

      const data = { type: "FeatureCollection", features };

      if (this.map.getSource(this.sourceId)) {
        this.map.getSource(this.sourceId).setData(data);
      } else {
        this.map.addSource(this.sourceId, { type: "geojson", data });

        this.map.addLayer({
          id: this.layerId,
          type: "circle",
          source: this.sourceId,
          paint: {
            "circle-color": [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              "#1E3A8A", // sélection
              "#2563EB"  // normal
            ],
            "circle-radius": [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              8, 6
            ],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              3, 2
            ],
            "circle-opacity": 0.96
          }
        });

        this.map.on("mouseenter", this.layerId, () => this.map.getCanvas().style.cursor = "pointer");
        this.map.on("mouseleave", this.layerId, () => this.map.getCanvas().style.cursor = "");
        this.map.on("click",      this.layerId, (e) => this._onSpotClick(e));
      }

      // Vue d’ensemble
      if (features.length > 0) {
        const b = new mapboxgl.LngLatBounds();
        features.forEach(f => b.extend(f.geometry.coordinates));
        this.map.fitBounds(b, { padding: 60, maxZoom: 14, duration: 450 });
      }
    } catch (err) {
      console.error("Chargement spots échoué:", err);
    }
  }

_onSpotClick(e) {
  const f = e.features?.[0];
  if (!f) return;
  if (this.selectedId) this.map.setFeatureState({ source: this.sourceId, id: this.selectedId }, { selected: false });
  const id = f.id || f.properties.id;
  this.map.setFeatureState({ source: this.sourceId, id }, { selected: true });
  this.selectedId = id;
  const c = f.geometry?.coordinates;
  const coords = Array.isArray(c) ? saneCoords(c[0], c[1]) : null;
  if (!coords) { console.warn("Coords invalides au clic:", c); return; }

  // Recentrage avec offset pour décaler le point vers le bas
  this.map.flyTo({
    center: coords,
    zoom: this.map.getZoom(),
    offset: [0, 75], // Décale le point de 150px vers le bas
    speed: 1.2,
    essential: true
  });

  // Ouverture de la popup (toujours ancrée en haut)
  this.openSpotPopup(coords, f.properties);
}



openSpotPopup(coords, props) {
  if (this.popup) this.popup.remove();
  const name = props.name || "Café";
  const address = props.address || "";
  const description = props.description || "";
  const button_link = props.button_link || "";
  const tags = normalizeArray(props.tags);
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`;
  const el = document.createElement("div");
  el.className = "map-popup";
  el.innerHTML = `
    <div class="mp-body">
      <h3 class="mp-title">${name}</h3>
      ${address ? `<p class="mp-address">${address}</p>` : ""}
      ${tags.length ? `<div class="mp-tags">${tags.map(t => `<span class="mp-tag">${t}</span>`).join("")}</div>` : ""}
      ${description ? `<div class="mp-desc">${description}</div>` : ""}
      <div class="mp-actions">
        ${button_link ? `<a class="mp-link" href="${button_link}" target="_blank" rel="noopener">Infos</a>` : ""}
        <a class="mp-primary" href="${gmaps}" target="_blank" rel="noopener">Itinéraire</a>
      </div>
    </div>
  `;
  el.addEventListener("click", (ev) => {
    if (ev.target.closest("a,button")) ev.stopPropagation();
  });

  // Ancrage toujours en haut, offset pour éviter de cacher le point
  this.popup = new mapboxgl.Popup({
    anchor: "bottom",
    offset: [0, -16],
    closeButton: true,
    closeOnClick: false,
    maxWidth: "360px",
    className: "ws-popup"
  })
    .setLngLat(coords)
    .setDOMContent(el)
    .addTo(this.map);
}


  _nudgeIntoViewOnce() {
    if (!this.popup || this._nudging) return;
    this._nudging = true;

    const popupEl = this.popup.getElement();
    const mapEl   = this.map.getContainer();
    if (!popupEl || !mapEl) { this._nudging = false; return; }

    requestAnimationFrame(() => {
      const pr = popupEl.getBoundingClientRect();
      const mr = mapEl.getBoundingClientRect();
      const pad = 8;
      let dx = 0, dy = 0;

      if (pr.left   < mr.left + pad)   dx += (mr.left + pad) - pr.left;
      if (pr.right  > mr.right - pad)  dx -= pr.right - (mr.right - pad);
      if (pr.top    < mr.top + pad)    dy += (mr.top + pad) - pr.top;
      if (pr.bottom > mr.bottom - pad) dy -= pr.bottom - (mr.bottom - pad);

      const clamp = (v, m = 100) => Math.max(-m, Math.min(m, v));
      dx = clamp(dx, 100);
      dy = clamp(dy, 100);

      if (dx || dy) this.map.panBy([dx, dy], { duration: 140 });

      setTimeout(() => { this._nudging = false; }, 160);
    });
  }

  disconnect() {
    if (this.map) this.map.remove();
    if (this.popup) this.popup.remove();
  }
}
