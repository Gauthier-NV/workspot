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

/* ---------- Mini Carousel (compact) ---------- */
/* Renvoie un petit slider 16:9 ~120px de haut, avec obj-fit: cover */
function buildMiniCarouselHTML(imageUrls, spotId) {
  const urls = (imageUrls || []).filter(Boolean).slice(0, 3);
  if (!urls.length) return "";

  const slides = urls.map((u, i) => `
    <div class="mpc-slide ${i === 0 ? "is-active" : ""}" data-index="${i}">
      <img src="${u}" alt="Photo ${i + 1}" loading="lazy" decoding="async" />
    </div>
  `).join("");

  // flèches uniquement si >1 image
  const arrows = urls.length > 1 ? `
    <button class="mpc-nav mpc-prev" aria-label="Précédent" data-dir="-1">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
    </button>
    <button class="mpc-nav mpc-next" aria-label="Suivant" data-dir="1">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
    </button>
  ` : "";

  const dots = urls.length > 1 ? `
    <div class="mpc-dots">
      ${urls.map((_, i) => `<button class="mpc-dot ${i === 0 ? "is-active" : ""}" data-to="${i}" aria-label="Aller à l’image ${i+1}"></button>`).join("")}
    </div>
  ` : "";

  return `
    <div class="mp-carousel" id="mpc-${spotId}" data-count="${urls.length}" data-active="0">
      <div class="mpc-viewport">
        ${slides}
      </div>
      ${arrows}
      ${dots}
    </div>
  `;
}

/* Active les interactions (à appeler après insertion dans le DOM) */
function wireMiniCarousel(rootEl) {
  const car = rootEl.querySelector(".mp-carousel");
  if (!car) return;
  let active = Number(car.getAttribute("data-active") || 0);
  const count = Number(car.getAttribute("data-count") || 0);
  const slides = Array.from(car.querySelectorAll(".mpc-slide"));
  const dots   = Array.from(car.querySelectorAll(".mpc-dot"));

  const go = (idx) => {
    if (!count) return;
    active = (idx + count) % count;
    car.setAttribute("data-active", String(active));
    slides.forEach((s, i) => s.classList.toggle("is-active", i === active));
    dots.forEach((d, i)   => d.classList.toggle("is-active", i === active));
  };

  car.addEventListener("click", (e) => {
    const prev = e.target.closest(".mpc-prev");
    const next = e.target.closest(".mpc-next");
    const dot  = e.target.closest(".mpc-dot");
    if (prev) { e.stopPropagation(); go(active - 1); }
    if (next) { e.stopPropagation(); go(active + 1); }
    if (dot)  { e.stopPropagation(); go(Number(dot.dataset.to || 0)); }
  });

  // swipe (simple)
  let startX = null;
  car.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
  car.addEventListener("touchend", (e) => {
    if (startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 30) go(active + (dx < 0 ? 1 : -1));
    startX = null;
  }, { passive: true });
}

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
            tags: normalizeArray(s.tags),
            image_urls: normalizeArray(s.image_urls)
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
  const images = normalizeArray(props.image_urls);

  const isMobile = window.matchMedia("(max-width: 480px)").matches;
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`;

  const el = document.createElement("div");
  el.className = "map-popup";

  const carouselHTML = buildMiniCarouselHTML(images, props.id || Math.random().toString(36).slice(2));


  // HTML popup
  el.innerHTML = `
    ${carouselHTML}
    <div class="mp-body">
      <h3 class="mp-title">${name}</h3>
      ${address ? `<p class="mp-address">${address}</p>` : ""}
      ${tags.length ? `<div class="mp-tags">${tags.map(t => `<span class="mp-tag">${t}</span>`).join("")}</div>` : ""}

      ${description ? `
    <div class="mp-desc-wrapper">
      <div class="mp-desc" id="mp-desc" data-collapsed="true">${description}</div>
      <a href="#" class="mp-toggle-link" aria-expanded="false" aria-controls="mp-desc">Voir la suite</a>
    </div>
  ` : ""}

      <div class="mp-actions">
        ${button_link ? `<a class="mp-link" href="${button_link}" target="_blank" rel="noopener">Infos</a>` : ""}
        <a class="mp-primary" href="${gmaps}" target="_blank" rel="noopener">Itinéraire</a>
      </div>
    </div>
  `;

  // Empêche la fermeture si clic sur un bouton/lien
  el.addEventListener("click", (ev) => {
    if (ev.target.closest("a,button")) ev.stopPropagation();
  });

  // Création de la popup
  const popupOpts = {
    anchor: "bottom",
    offset: isMobile ? [0, 0] : [0, -16],
    closeButton: true,
    closeOnClick: false,
    maxWidth: isMobile ? "92vw" : "360px", // largeur raisonnable sur mobile
    className: `ws-popup ${isMobile ? "ws-popup--mobile" : ""}`
  };

  this.popup = new mapboxgl.Popup(popupOpts)
    .setLngLat(coords)
    .setDOMContent(el)
    .addTo(this.map);
    wireMiniCarousel(el);


  // Toggle "Voir la suite"
  const descEl   = el.querySelector(".mp-desc");
const toggleEl = el.querySelector(".mp-toggle-link");

if (descEl && toggleEl) {
  const measure = () => {
    requestAnimationFrame(() => {
      const needsToggle = descEl.scrollHeight > descEl.clientHeight + 2;
      toggleEl.style.display = needsToggle ? "inline" : "none";
    });
  };
  measure();

  const toggle = (ev) => {
    ev.preventDefault();             // évite de remonter la page
    ev.stopPropagation();            // évite de fermer la popup
    const collapsed = descEl.getAttribute("data-collapsed") === "true";
    if (collapsed) {
      descEl.classList.add("expanded");
      descEl.setAttribute("data-collapsed", "false");
      toggleEl.textContent = "Réduire";
      toggleEl.setAttribute("aria-expanded", "true");
    } else {
      descEl.classList.remove("expanded");
      descEl.setAttribute("data-collapsed", "true");
      toggleEl.textContent = "Voir la suite";
      toggleEl.setAttribute("aria-expanded", "false");
    }
    measure();
  };

  toggleEl.addEventListener("click", toggle);
  // Accessibilité clavier (Entrée / Espace)
  toggleEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { toggle(e); }
  });
}

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
