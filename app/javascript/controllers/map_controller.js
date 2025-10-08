// app/javascript/controllers/map_controller.js
import { Controller } from "@hotwired/stimulus";

/* ---------- Helpers (inchangés) ---------- */
const normalizeArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === "string") {
    try { const p = JSON.parse(val); return Array.isArray(p) ? p.filter(Boolean) : []; }
    catch { return val.split(",").map((s) => s.trim()).filter(Boolean); }
  }
  return [];
};

const toNum = (v) => {
  if (v == null || v === "") return NaN;
  const n = Number(String(v).replace(",", ".").trim());
  return Number.isFinite(n) ? n : NaN;
};

const coordCache = new Map();
const saneCoords = (lng, lat) => {
  const key = `${lng},${lat}`;
  if (coordCache.has(key)) return coordCache.get(key);
  let L = toNum(lng), A = toNum(lat);
  const looksLng = (x) => Math.abs(x) <= 180;
  const looksLat = (x) => Math.abs(x) <= 85;
  if (!Number.isFinite(L) || !Number.isFinite(A)) { coordCache.set(key, null); return null; }
  if (!looksLng(L) || !looksLat(A)) { if (looksLng(A) && looksLat(L)) [L, A] = [A, L]; }
  const result = looksLng(L) && looksLat(A) ? [L, A] : null;
  coordCache.set(key, result); return result;
};

async function chunkedForEach(items, fn, chunk = 200) {
  for (let i = 0; i < items.length; i += chunk) {
    items.slice(i, i + chunk).forEach(fn);
    await new Promise((r) => window.requestIdleCallback ? requestIdleCallback(r) : setTimeout(r, 0));
  }
}
const spotCoords = (s) => saneCoords(s.lng ?? s.longitude, s.lat ?? s.latitude);

/* ---------- Mini Carousel (inchangé) ---------- */
function buildMiniCarouselHTML(imageUrls, spotId) {
  const urls = (imageUrls || []).filter(Boolean).slice(0, 3);
  if (!urls.length) return "";
  const slides = urls.map((u, i) => `
    <div class="mpc-slide ${i === 0 ? "is-active" : ""}" data-index="${i}">
      <img src="${u}" alt="Photo ${i + 1}" loading="lazy" decoding="async" style="background:#f0f0f0;" />
    </div>`).join("");
  const arrows = urls.length > 1 ? `
    <button class="mpc-nav mpc-prev" aria-label="Précédent" data-dir="-1">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
    </button>
    <button class="mpc-nav mpc-next" aria-label="Suivant" data-dir="1">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>
    </button>` : "";
  const dots = urls.length > 1 ? `
    <div class="mpc-dots">
      ${urls.map((_, i) => `<button class="mpc-dot ${i === 0 ? "is-active" : ""}" data-to="${i}" aria-label="Aller à l’image ${i + 1}"></button>`).join("")}
    </div>` : "";
  return `
    <div class="mp-carousel" id="mpc-${spotId}" data-count="${urls.length}" data-active="0">
      <div class="mpc-viewport">${slides}</div>
      ${arrows}${dots}
    </div>`;
}

function wireMiniCarousel(rootEl) {
  const car = rootEl.querySelector(".mp-carousel");
  if (!car) return;
  let active = Number(car.getAttribute("data-active") || 0);
  const count = Number(car.getAttribute("data-count") || 0);
  const slides = Array.from(car.querySelectorAll(".mpc-slide"));
  const dots = Array.from(car.querySelectorAll(".mpc-dot"));
  const go = (idx) => {
    if (!count) return;
    active = (idx + count) % count;
    car.setAttribute("data-active", String(active));
    slides.forEach((s, i) => s.classList.toggle("is-active", i === active));
    dots.forEach((d, i) => d.classList.toggle("is-active", i === active));
  };
  car.addEventListener("click", (e) => {
    const prev = e.target.closest(".mpc-prev");
    const next = e.target.closest(".mpc-next");
    const dot = e.target.closest(".mpc-dot");
    if (prev) { e.stopPropagation(); go(active - 1); }
    if (next) { e.stopPropagation(); go(active + 1); }
    if (dot)  { e.stopPropagation(); go(Number(dot.dataset.to || 0)); }
  });
  let startX = null;
  car.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; });
  car.addEventListener("touchend", (e) => {
    if (startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 30) go(active + (dx < 0 ? 1 : -1));
    startX = null;
  });
}

/* ---------- Controller (amélioré) ---------- */
export default class extends Controller {
  static values = {
    style: String,          // TON STYLE PERSONNALISÉ
    center: Array,
    zoom: Number,
    apiUrl: { type: String, default: "/spots.json" },
  };
  static targets = ["loading"];

  connect() {
    if (!("IntersectionObserver" in window)) { this._init(); return; }
    this._io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) { this._io.disconnect(); this._init(); }
    }, { rootMargin: "200px" });
    this._io.observe(this.element);
  }

  async _init() {
    const token = document.querySelector('meta[name="mapbox-token"]')?.content;
    if (!token) { console.error("Mapbox token manquant"); return; }
    const mapboxgl = (await import("mapbox-gl")).default;
    mapboxgl.accessToken = token;
    this.mb = mapboxgl;

    this.map = new mapboxgl.Map({
      container: this.element,
      style: this.styleValue, // ← TON STYLE
      center: Array.isArray(this.centerValue) ? this.centerValue : [2.3522, 48.8566],
      zoom: Number.isFinite(this.zoomValue) ? this.zoomValue : 11.4,
      attributionControl: false,
      dragRotate: false,
      touchPitch: false,
      pitchWithRotate: false,
      boxZoom: false,
      doubleClickZoom: false,
      keyboard: false,
      fadeDuration: 0,
      maxBounds: [[-1.0, 47.8], [5.5, 50.5]],
    });

    this.map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    this.map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: false,
      fitBoundsOptions: { maxZoom: 14 },
    }), "top-right");
    this.map.addControl(new mapboxgl.FullscreenControl(), "top-right");

    this.map.on("load", () => {
      this._loadAndRenderSpots();
      const ph = this.element.querySelector(".map-placeholder");
      if (ph) ph.remove();
      this.map.on("moveend", () => this._loadSpotsForBounds());
    });

    this.map.on("click", (e) => {
      const hits = this.map.queryRenderedFeatures(e.point, { layers: ["spots-circles","spots-circles--selected"].filter(l => this.map.getLayer(l)) });
      if (!hits.length) this._clearSelection();
    });

    this._fsHandler = () => this.map?.resize();
    ["fullscreenchange","webkitfullscreenchange","mozfullscreenchange","MSFullscreenChange"]
      .forEach(evt => document.addEventListener(evt, this._fsHandler, { passive: true }));
  }

  async _loadAndRenderSpots() {
    if (this.hasLoadingTarget) this.loadingTarget.style.display = "block";
    try {
      const bounds = this.map.getBounds();
      const url = `${this.apiUrlValue}?bounds=${bounds.toArray().join(",")}`;

      this._spotsAbort?.abort();
      this._spotsAbort = new AbortController();
      const signal = this._spotsAbort.signal;

      const cached = sessionStorage.getItem(`spotsData-${url}`);
      const spots = cached
        ? JSON.parse(cached)
        : await (await fetch(url, { credentials: "same-origin", signal })).json();
      if (!cached) sessionStorage.setItem(`spotsData-${url}`, JSON.stringify(spots));

      const features = [];
      await chunkedForEach(spots, (s) => {
        const coords = spotCoords(s);
        if (!coords) return;
        const fid = String(s.id ?? s.slug ?? Math.random().toString(36).slice(2));
        features.push({
          type: "Feature", id: fid,
          properties: {
            __fid: fid, name: s.name || "Café", address: s.address || "",
            description: s.description || "", button_link: s.button_link || "",
            tags: normalizeArray(s.tags), image_urls: normalizeArray(s.image_urls),
          },
          geometry: { type: "Point", coordinates: coords },
        });
      });

      const data = { type: "FeatureCollection", features: features.filter(Boolean) };
      const src = "spots-source";

     if (!this.map.getSource(src)) {
  this.map.addSource(src, {
    type: "geojson",
    data,
    cluster: true,
    clusterMaxZoom: 18,
    clusterRadius: 100,
  });

  /* ---------- CLUSTERS (bleu unique, clean) ---------- */
  /* ---------- CLUSTERS (bleu clair + plus de transparence) ---------- */
this.map.addLayer({
  id: "clusters",
  type: "circle",
  source: src,
  filter: ["has", "point_count"],
  paint: {
    // Bleu plus clair (blue-400) ; tu peux essayer #93C5FD si tu veux encore plus clair
    "circle-color": "#2f93eb",
    // Plus transparent
    "circle-opacity": 0.6,
    // Tailles fluides inchangées
   "circle-radius": [
  "interpolate", ["exponential", 1.2], ["get","point_count"],
  1,   24,
  10,  30,
  25,  36,
  75,  44,
  150, 54
],
    // Liseré blanc léger pour la lisibilité

    // Très léger flou pour un rendu soft moderne
    "circle-blur": 0.05
  }
});

this.map.addLayer({
  id: "cluster-count",
  type: "symbol",
  source: src,
  filter: ["has", "point_count"],
  layout: {
  "text-field": ["get", "point_count_abbreviated"],
  // +1 à +3 pts selon la taille du cluster
  "text-size": ["interpolate", ["linear"], ["get","point_count"],
    1, 13,     10, 14,     25, 15,     75, 16,     150, 18
  ],
  "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
  "text-allow-overlap": true,
  "text-ignore-placement": true
},
paint: {
  "text-color": "#FFFFFF",
  // (recommandé) un halo léger pour rester lisible sur le bleu plus clair
  "text-halo-width": 1.2,
  "text-halo-blur": 0.2
}});


  /* ---------- Points individuels & sélection ---------- */
  this.map.addLayer({
    id: "spots-circles",
    type: "circle",
    source: src,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": "#2563EB",
      "circle-radius": 6,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.9
    }
  });

  this.map.addLayer({
    id: "spots-circles--selected",
    type: "circle",
    source: src,
    filter: ["==", ["to-string", ["get", "__fid"]], "__none__"],
    paint: {
      "circle-color": "#1E3A8A",
      "circle-radius": 8,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
      "circle-opacity": 1
    }
  }, "spots-circles");

  // Interactions clusters
  ["clusters", "cluster-count"].forEach((layerId) => {
    this.map.on("click", layerId, (e) => this._zoomCluster(e));
    this.map.on("mouseenter", layerId, () => this.map.getCanvas().style.cursor = "pointer");
    this.map.on("mouseleave", layerId, () => this.map.getCanvas().style.cursor = "");
  });

  // Interactions points
  this.map.on("mouseenter", "spots-circles", () => this.map.getCanvas().style.cursor = "pointer");
  this.map.on("mouseleave", "spots-circles", () => this.map.getCanvas().style.cursor = "");
  this.map.on("click", "spots-circles", (e) => this._onSpotClick(e));
}


      else {
        this.map.getSource(src).setData(data);
      }

      if (features.length > 0) {
        const b = new this.mb.LngLatBounds();
        features.forEach(f => b.extend(f.geometry.coordinates));
        const same = b.getNorth() === b.getSouth() && b.getEast() === b.getWest();
        if (!same) this.map.fitBounds(b, { padding: 60, maxZoom: 14, duration: 450 });
      }
    } catch (err) {
      if (err?.name !== "AbortError") console.error("Erreur chargement spots:", err);
    } finally {
      if (this.hasLoadingTarget) this.loadingTarget.style.display = "none";
    }
  }

  async _loadSpotsForBounds() {
    const bounds = this.map.getBounds();
    const url = `${this.apiUrlValue}?bounds=${bounds.toArray().join(",")}`;

    this._spotsAbort?.abort();
    this._spotsAbort = new AbortController();
    const signal = this._spotsAbort.signal;

    const res = await fetch(url, { credentials: "same-origin", signal }).catch((e)=>e);
    if (!res || !res.ok) return;
    const spots = await res.json();
    const features = spots.map((s) => {
      const coords = spotCoords(s);
      if (!coords) return null;
      return {
        type: "Feature",
        id: String(s.id ?? s.slug),
        properties: { __fid: String(s.id ?? s.slug), ...s },
        geometry: { type: "Point", coordinates: coords },
      };
    }).filter(Boolean);
    this.map.getSource("spots-source").setData({ type: "FeatureCollection", features });
  }

  _zoomCluster(e) {
    const feats = this.map.queryRenderedFeatures(e.point, {
      layers: ["clusters", "cluster-count"]
    });
    if (!feats.length) return;
    const clusterId = feats[0].properties.cluster_id;
    this.map.getSource("spots-source").getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      this.map.easeTo({ center: feats[0].geometry.coordinates, zoom });
    });
  }

  _onSpotClick(e) {
    const f = e.features?.[0];
    if (!f) return;
    const id = String(f.properties?.__fid);
    this._clearSelection();
    this.map.setFilter("spots-circles--selected", ["==", ["to-string", ["get", "__fid"]], id]);
    this.map.easeTo({
      center: f.geometry.coordinates,
      zoom: this.map.getZoom(),
      offset: [0, 120],
      duration: 300,
      easing: (t) => t,
      essential: true,
    });
    this.openSpotPopup(f.geometry.coordinates, f.properties);
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

    const descId = `mp-desc-${props.__fid || Math.random().toString(36).slice(2)}`;

    const el = document.createElement("div");
    el.className = "map-popup";
    el.innerHTML = `
      ${buildMiniCarouselHTML(images, props.__fid)}
      <div class="mp-body">
        <h3 class="mp-title">${name}</h3>
        ${address ? `<p class="mp-address">${address}</p>` : ""}
        ${tags.length ? `<div class="mp-tags">${tags.map(t => `<span class="mp-tag">${t}</span>`).join("")}</div>` : ""}
        ${description ? `
          <div class="mp-desc-wrapper">
            <div class="mp-desc" id="${descId}" data-collapsed="true" style="max-height:60px; overflow:hidden;">${description}</div>
            <a href="#" class="mp-toggle-link" role="button" aria-controls="${descId}" aria-expanded="false" style="display:none;margin-top:6px;">Voir plus</a>
          </div>` : ""}
        <div class="mp-actions">
          ${button_link ? `<a class="mp-link" href="${button_link}" target="_blank" rel="noopener">Infos</a>` : ""}
          <a class="mp-primary" href="${gmaps}" target="_blank" rel="noopener">Itinéraire</a>
        </div>
      </div>`;

    this.popup = new this.mb.Popup({
      anchor: "bottom",
      offset: [0, -14],
      closeButton: true,
      closeOnClick: false,
      maxWidth: isMobile ? "92vw" : "360px",
      className: `ws-popup ${isMobile ? "ws-popup--mobile" : ""}`,
    }).setLngLat(coords).setDOMContent(el).addTo(this.map);

    wireMiniCarousel(el);

    const descEl = el.querySelector(`#${CSS.escape(descId)}`);
    const toggleEl = el.querySelector(".mp-toggle-link");
    let cleanupResize = null;

    if (descEl && toggleEl) {
      const COLLAPSED_MAX = 60;

      const collapse = () => {
        descEl.style.maxHeight = `${COLLAPSED_MAX}px`;
        descEl.setAttribute("data-collapsed", "true");
        toggleEl.textContent = "Voir plus";
        toggleEl.setAttribute("aria-expanded", "false");
      };

      const expand = () => {
        descEl.style.maxHeight = "none";
        descEl.setAttribute("data-collapsed", "false");
        toggleEl.textContent = "Voir moins";
        toggleEl.setAttribute("aria-expanded", "true");
      };

      const measure = () => {
        const wasNone = descEl.style.maxHeight === "none";
        if (wasNone) descEl.style.maxHeight = `${COLLAPSED_MAX}px`;
        const needs = descEl.scrollHeight > descEl.clientHeight + 1;
        toggleEl.style.display = needs ? "inline" : "none";
        if (wasNone) descEl.style.maxHeight = "none";
      };

      const onToggle = (e) => {
        e.preventDefault();
        const collapsed = descEl.getAttribute("data-collapsed") === "true";
        if (collapsed) expand(); else collapse();
        requestAnimationFrame(measure);
      };

      collapse();
      requestAnimationFrame(measure);
      setTimeout(measure, 60);

      toggleEl.addEventListener("click", onToggle);
      toggleEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") onToggle(e);
      });

      const onResize = () => measure();
      window.addEventListener("resize", onResize, { passive: true });
      cleanupResize = () => window.removeEventListener("resize", onResize, { passive: true });
    }

    this.popup.on("close", () => {
      cleanupResize?.();
      this.popup = null;
      this._clearSelection();
    });
  }

  _clearSelection() {
    if (this.map?.getLayer("spots-circles--selected")) {
      this.map.setFilter("spots-circles--selected", ["==", ["to-string", ["get", "__fid"]], "__none__"]);
    }
    this.popup?.remove();
  }

  disconnect() {
    this._io?.disconnect();
    this._spotsAbort?.abort();
    this.map?.remove();
    if (this._fsHandler) {
      ["fullscreenchange","webkitfullscreenchange","mozfullscreenchange","MSFullscreenChange"]
        .forEach(evt => document.removeEventListener(evt, this._fsHandler));
    }
    this.popup?.remove();
  }
}
