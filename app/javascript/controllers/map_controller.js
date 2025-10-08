// app/javascript/controllers/map_controller.js
import { Controller } from "@hotwired/stimulus";

/* ---------- Lightweight UMD loader (no esm.sh) ---------- */
const _loaded = new Set();
function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (window.mapboxgl) return resolve();
    if (_loaded.has(src)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.defer = true;
    s.onload = () => { _loaded.add(src); resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
function loadCssOnce(href) {
  if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
}

/* ---------- Helpers ---------- */
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
  return looksLng(L) && looksLat(A) ? [L, A] : null;
};
async function chunkedForEach(items, fn, chunk = 200) {
  for (let i = 0; i < items.length; i += chunk) {
    items.slice(i, i + chunk).forEach(fn);
    await new Promise((r) =>
      window.requestIdleCallback ? requestIdleCallback(r) : setTimeout(r, 0)
    );
  }
}
const spotCoords = (s) => saneCoords(s.lng ?? s.longitude, s.lat ?? s.latitude);

/* ---------- Mini Carousel ---------- */
function buildMiniCarouselHTML(imageUrls, spotId) {
  const urls = (imageUrls || []).filter(Boolean).slice(0, 3);
  if (!urls.length) return "";
  const slides = urls.map((u, i) => `
    <div class="mpc-slide ${i === 0 ? "is-active" : ""}" data-index="${i}">
      <img src="${u}" alt="Photo ${i + 1}" loading="lazy" decoding="async" />
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
  // swipe mobile
  let startX = null;
  car.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; });
  car.addEventListener("touchend", (e) => {
    if (startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 30) go(active + (dx < 0 ? 1 : -1));
    startX = null;
  });
}

/* ---------- Stimulus Controller ---------- */
export default class extends Controller {
  static values = {
    style: String,
    center: Array,
    zoom: Number,
    apiUrl: { type: String, default: "/spots.json" },
  };
  static targets = ["loading"];

  connect() {
    // Lazy: on attend que la carte soit dans le viewport
    if (!("IntersectionObserver" in window)) { this._initWhenIdle(); return; }
    this._io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        this._io.disconnect();
        this._initWhenIdle();
      }
    }, { rootMargin: "200px" });
    this._io.observe(this.element);
  }

  _initWhenIdle() {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 0));
    idle(() => this._init());
  }

  async _init() {
    try {
      const token = document.querySelector('meta[name="mapbox-token"]')?.content;
      if (!token) { console.error("Mapbox token manquant"); return; }

      // Charger Mapbox GL (UMD) uniquement maintenant (pas d'esm.sh)
      const ver = "v3.6.0"; // même version CSS & JS
      loadCssOnce(`https://api.mapbox.com/mapbox-gl-js/${ver}/mapbox-gl.css`);
      await loadScriptOnce(`https://api.mapbox.com/mapbox-gl-js/${ver}/mapbox-gl.js`);
      const mapboxgl = window.mapboxgl;
      if (!mapboxgl) throw new Error("Mapbox GL non chargé");
      mapboxgl.accessToken = token;
      this.mb = mapboxgl;

      // Config CPU-friendly
      const defaultCenter = [2.3522, 48.8566];
      const centerArr = Array.isArray(this.centerValue) ? this.centerValue : defaultCenter;
      const center = saneCoords(centerArr[0], centerArr[1]) || defaultCenter;

      this.sourceId = "spots-source";
      this.layerId = "spots-circles";
      this.highlightLayerId = "spots-circles--selected";
      this.selectedId = null;
      this.popup = null;

      this.map = new mapboxgl.Map({
        container: this.element,
        style: this.styleValue || "mapbox://styles/mapbox/light-v11",
        center,
        zoom: Number.isFinite(this.zoomValue) ? this.zoomValue : 11.4,
        attributionControl: false,
        dragRotate: false,
        touchPitch: false,
        pitchWithRotate: false,
        antialias: false,
        fadeDuration: 0,
        collectResourceTiming: false,
        trackResize: true,
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

      this.map.on("error", (e) => console.error("Mapbox error:", e?.error || e));
      this.map.on("load", () => this._loadAndRenderSpots());

      // clic “dans le vide” = clear (vérifie les deux calques)
      this.map.on("click", (e) => {
        const hasBase = !!this.map.getLayer?.(this.layerId);
        const hasHL = !!this.map.getLayer?.(this.highlightLayerId);
        if (!hasBase && !hasHL) return;
        const layers = [hasBase ? this.layerId : null, hasHL ? this.highlightLayerId : null].filter(Boolean);
        const hits = this.map.queryRenderedFeatures(e.point, { layers });
        if (!hits.length) this._clearSelection();
      });

      this._fsHandler = () => this.map?.resize();
      ["fullscreenchange","webkitfullscreenchange","mozfullscreenchange","MSFullscreenChange"]
        .forEach((evt) => document.addEventListener(evt, this._fsHandler, { passive: true }));
    } catch (e) {
      console.error("[map] load error", e);
    }
  }

  async _loadAndRenderSpots() {
    try {
      if (this.hasLoadingTarget) this.loadingTarget.style.display = "block";

      const res = await fetch(this.apiUrlValue, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const spots = await res.json();

      const features = spots.map((s) => {
        const coords = spotCoords(s);
        if (!coords) { console.warn("Spot ignoré (coords invalides):", s.id, s.name); return null; }
        const fid = String(s.id ?? s.slug ?? Math.random().toString(36).slice(2));
        return {
          type: "Feature",
          id: fid,
          properties: {
            __fid: fid,
            name: s.name || "Café",
            address: s.address || "",
            description: s.description || "",
            button_link: s.button_link || "",
            tags: normalizeArray(s.tags),
            image_urls: normalizeArray(s.image_urls),
          },
          geometry: { type: "Point", coordinates: coords },
        };
      }).filter(Boolean);

      const data = { type: "FeatureCollection", features };

      if (this.map.getSource(this.sourceId)) {
        this.map.getSource(this.sourceId).setData(data);
      } else {
        this.map.addSource(this.sourceId, { type: "geojson", data });

        if (!this.map.getLayer(this.layerId)) {
          this.map.addLayer({
            id: this.layerId,
            type: "circle",
            source: this.sourceId,
            paint: {
              "circle-color": "#2563EB",
              "circle-radius": 6,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 1.5,
              "circle-opacity": 0.96,
            },
          });
        }

        if (!this.map.getLayer(this.highlightLayerId)) {
          this.map.addLayer({
            id: this.highlightLayerId,
            type: "circle",
            source: this.sourceId,
            filter: ["==", ["to-string", ["get", "__fid"]], "__none__"],
            paint: {
              "circle-color": "#1E3A8A",
              "circle-radius": 8,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2.5,
              "circle-opacity": 0.98,
            },
          });
        }

        try { this.map.moveLayer(this.highlightLayerId); } catch {}
        this.map.on("mouseenter", this.layerId, () => { this.map.getCanvas().style.cursor = "pointer"; });
        this.map.on("mouseleave", this.layerId, () => { this.map.getCanvas().style.cursor = ""; });
        this.map.on("mouseenter", this.highlightLayerId, () => { this.map.getCanvas().style.cursor = "pointer"; });
        this.map.on("mouseleave", this.highlightLayerId, () => { this.map.getCanvas().style.cursor = ""; });
        this.map.on("click", this.layerId, (e) => this._onSpotClick(e));
        this.map.on("click", this.highlightLayerId, (e) => this._onSpotClick(e));
      }

      if (features.length > 0) {
        const b = new this.mb.LngLatBounds();
        await chunkedForEach(features, (f) => b.extend(f.geometry.coordinates), 200);
        const same = b.getNorth() === b.getSouth() && b.getEast() === b.getWest();
        if (!same) this.map.fitBounds(b, { padding: 60, maxZoom: 14, duration: 450 });
      }
    } catch (err) {
      console.error("Chargement spots échoué:", err);
    } finally {
      if (this.hasLoadingTarget) this.loadingTarget.style.display = "none";
    }
  }

  _onSpotClick(e) {
    const f = e.features?.[0];
    if (!f) return;
    const id = String(f.properties?.__fid);
    this._clearSelection();
    this.selectedId = id;

    if (this.map.getLayer(this.highlightLayerId)) {
      this.map.setFilter(this.highlightLayerId, ["==", ["to-string", ["get", "__fid"]], String(id)]);
    }

    const c = f.geometry?.coordinates;
    const coords = Array.isArray(c) ? saneCoords(c[0], c[1]) : null;
    if (!coords) { console.warn("Coords invalides au clic:", c); return; }

    this.map.flyTo({
      center: coords,
      zoom: this.map.getZoom(),
      offset: [0, 120],
      speed: 1.1,
      essential: true,
    });

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
    const carouselHTML = buildMiniCarouselHTML(images, props.__fid || Math.random().toString(36).slice(2));

    el.innerHTML = `
      ${carouselHTML}
      <div class="mp-body">
        <h3 class="mp-title">${name}</h3>
        ${address ? `<p class="mp-address">${address}</p>` : ""}
        ${tags.length ? `<div class="mp-tags">${tags.map((t) => `<span class="mp-tag">${t}</span>`).join("")}</div>` : ""}
        ${
          description
            ? `<div class="mp-desc-wrapper">
                 <div class="mp-desc" id="mp-desc" data-collapsed="true">${description}</div>
                 <a href="#" class="mp-toggle-link" aria-expanded="false" aria-controls="mp-desc">Voir la suite</a>
               </div>`
            : ""
        }
        <div class="mp-actions">
          ${button_link ? `<a class="mp-link" href="${button_link}" target="_blank" rel="noopener">Infos</a>` : ""}
          <a class="mp-primary" href="${gmaps}" target="_blank" rel="noopener">Itinéraire</a>
        </div>
      </div>`;

    el.addEventListener("click", (ev) => { if (ev.target.closest("a,button")) ev.stopPropagation(); });

    const popupOpts = {
      anchor: "bottom",
      offset: [0, -14],
      closeButton: true,
      closeOnClick: false,
      maxWidth: isMobile ? "92vw" : "360px",
      className: `ws-popup ${isMobile ? "ws-popup--mobile" : ""}`,
    };

    this.popup = new this.mb.Popup(popupOpts)
      .setLngLat(coords)
      .setDOMContent(el)
      .addTo(this.map);

    this.popup.on("close", () => {
      this.popup = null;
      this._clearSelection();
    });

    wireMiniCarousel(el);

    const descEl = el.querySelector(".mp-desc");
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
        ev.preventDefault();
        ev.stopPropagation();
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
      toggleEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") toggle(e); });
    }
  }

  _clearSelection() {
    this.selectedId = null;
    if (this.map?.getLayer(this.highlightLayerId)) {
      this.map.setFilter(this.highlightLayerId, ["==", ["to-string", ["get", "__fid"]], "__none__"]);
    }
    if (this.popup) { this.popup.remove(); this.popup = null; }
  }

  disconnect() {
    this._io && this._io.disconnect();
    if (this.map) { this.map.remove(); this.map = null; }
    if (this._fsHandler) {
      ["fullscreenchange","webkitfullscreenchange","mozfullscreenchange","MSFullscreenChange"]
        .forEach((evt) => document.removeEventListener(evt, this._fsHandler));
      this._fsHandler = null;
    }
    this.popup && this.popup.remove();
  }
}
