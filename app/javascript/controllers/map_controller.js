// app/javascript/controllers/map_controller.js
import { Controller } from "@hotwired/stimulus";

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

/* ---------- Mini Carousel (fade) ---------- */
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
  car.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
  car.addEventListener("touchend", (e) => {
    if (startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 30) go(active + (dx < 0 ? 1 : -1));
    startX = null;
  });
}

/* ---------- Carousel “peek + snap” (mobile/tablette) ---------- */
function buildPeekCarouselHTML(imageUrls, spotId) {
  const urls = (imageUrls || []).filter(Boolean).slice(0, 6);
  if (!urls.length) return "";
  const slides = urls.map((u, i) => `
    <div class="mpc-snap-slide" data-index="${i}">
      <img src="${u}" alt="Photo ${i + 1}" loading="lazy" decoding="async" />
    </div>
  `).join("");
  return `
    <div class="mp-carousel mp-carousel--peek" id="mpc-${spotId}" data-count="${urls.length}" data-active="0">
      <div class="mpc-snap-track" role="group" aria-label="Galerie d’images">
        ${slides}
      </div>
      <div class="mpc-snap-dots" aria-hidden="true">
        ${urls.map((_, i) => `<button class="mpc-dot ${i===0?"is-active":""}" data-to="${i}" tabindex="-1"></button>`).join("")}
      </div>
    </div>`;
}

function wirePeekCarousel(rootEl) {
  const car = rootEl.querySelector(".mp-carousel--peek");
  if (!car) return;
  const track = car.querySelector(".mpc-snap-track");
  const dots  = Array.from(car.querySelectorAll(".mpc-snap-dots .mpc-dot"));
  if (!track) return;

  const slides = Array.from(track.children);
  const update = () => {
    const { left: tl, width: tw } = track.getBoundingClientRect();
    let best = 0, bestOverlap = -1;
    slides.forEach((slide, i) => {
      const r = slide.getBoundingClientRect();
      const overlap = Math.max(0, Math.min(r.right, tl + tw) - Math.max(r.left, tl));
      if (overlap > bestOverlap) { bestOverlap = overlap; best = i; }
    });
    car.dataset.active = String(best);
    dots.forEach((d, i) => d.classList.toggle("is-active", i === best));
  };

  let raf = null;
  const onScroll = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(update);
  };
  track.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", update);

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      const slide = slides[i];
      if (!slide) return;
      slide.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
    });
  });

  update();
}

/* ---------- Vote Manager (local + sync serveur) ---------- */
class VoteManager {
  constructor() {
    this.likedSet = new Set();
    this.dislikedSet = new Set();
    this._loadFromLocalStorage();
  }
  _loadFromLocalStorage() {
    try {
      const cache = JSON.parse(localStorage.getItem("workspot_votes") || "{}");
      (cache.liked || []).forEach(id => this.likedSet.add(String(id)));
      (cache.disliked || []).forEach(id => this.dislikedSet.add(String(id)));
    } catch {}
  }
  _persist() {
    try {
      localStorage.setItem("workspot_votes", JSON.stringify({
        liked: [...this.likedSet], disliked: [...this.dislikedSet]
      }));
    } catch {}
  }
  getVote(spotId) {
    const id = String(spotId);
    if (this.likedSet.has(id)) return "like";
    if (this.dislikedSet.has(id)) return "dislike";
    return "none";
  }
  async toggleVote(spotId, target) {
    const id = String(spotId);
    this.likedSet.delete(id);
    this.dislikedSet.delete(id);
    if (target === "like") this.likedSet.add(id);
    if (target === "dislike") this.dislikedSet.add(id);
    this._persist();
    return this._syncWithServer(spotId, target);
  }
  async _syncWithServer(spotId, target) {
    const token = document.querySelector('meta[name="csrf-token"]')?.content;
    const current = this.getVote(spotId);
    const reqs = [];
    if (current === "none") {
      reqs.push(fetch(`/spots/${spotId}/like`,    { method:"DELETE", headers:{ "X-CSRF-Token": token, "Accept":"application/json" } }));
      reqs.push(fetch(`/spots/${spotId}/dislike`, { method:"DELETE", headers:{ "X-CSRF-Token": token, "Accept":"application/json" } }));
    } else if (current === "like") {
      reqs.push(fetch(`/spots/${spotId}/dislike`, { method:"DELETE", headers:{ "X-CSRF-Token": token, "Accept":"application/json" } }));
      reqs.push(fetch(`/spots/${spotId}/like`,    { method:"POST",   headers:{ "X-CSRF-Token": token, "Accept":"application/json" } }));
    } else if (current === "dislike") {
      reqs.push(fetch(`/spots/${spotId}/like`,    { method:"DELETE", headers:{ "X-CSRF-Token": token, "Accept":"application/json" } }));
      reqs.push(fetch(`/spots/${spotId}/dislike`, { method:"POST",   headers:{ "X-CSRF-Token": token, "Accept":"application/json" } }));
    }
    let last = {};
    for (const r of reqs) {
      const res = await r;
      if (res?.ok) last = await res.json().catch(()=>({}));
    }
    return last;
  }
}

/* ---------- Stimulus Controller ---------- */
export default class extends Controller {
  static values = {
    style: String,
    center: Array,
    zoom: Number,
    apiUrl: { type: String, default: "/spots.json" },
  };

  static targets = ["loading", "sidebar", "container", "bottomsheet", "bottomsheetContent"];

  _haptic(pattern = [12, 60, 12]) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
  }

  _setupLongPress(mainBtn, wrap) {
    if (!mainBtn || !wrap) return;
    const LONG_PRESS_MS = 2000;
    let timer = null;
    let longFired = false;

    const openMenu = () => {
      wrap.classList.add("is-open");
      mainBtn.setAttribute("aria-expanded", "true");
      longFired = true;
      this._haptic([15, 30, 15]);
    };

    const onPointerDown = (ev) => {
      if (ev.pointerType === "touch" || ev.pointerType === "pen") {
        clearTimeout(timer);
        longFired = false;
        timer = setTimeout(openMenu, LONG_PRESS_MS);
      }
    };
    const cancelTimer = () => { clearTimeout(timer); timer = null; };
    const onPointerUp = () => {
      cancelTimer();
      if (longFired) {
        const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };
        mainBtn.addEventListener("click", swallow, { once: true, capture: true });
        setTimeout(() => { longFired = false; }, 0);
      }
    };

    if ("onpointerdown" in window) {
      mainBtn.addEventListener("pointerdown", onPointerDown, { passive: true });
      mainBtn.addEventListener("pointerup", onPointerUp, { passive: true });
      mainBtn.addEventListener("pointercancel", cancelTimer, { passive: true });
      mainBtn.addEventListener("pointerleave", cancelTimer, { passive: true });
    } else {
      mainBtn.addEventListener("touchstart", () => {
        clearTimeout(timer); longFired = false;
        timer = setTimeout(openMenu, LONG_PRESS_MS);
      }, { passive: true });
      ["touchend","touchcancel"].forEach(evt =>
        mainBtn.addEventListener(evt, () => { cancelTimer(); }, { passive: true })
      );
    }
  }

  connect() {
    this.mqlMobile = window.matchMedia("(max-width: 768px)");
    this.voteManager = new VoteManager();
    if (!("IntersectionObserver" in window)) { this._bootstrapVotes(); this._init(); return; }
    this._io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        this._io.disconnect();
        this._bootstrapVotes();
        this._init();
      }
    }, { rootMargin: "200px" });
    this._io.observe(this.element);
  }

  isMobile() { return this.mqlMobile?.matches ?? window.innerWidth <= 768; }
  _shouldUsePeek() { return window.matchMedia("(max-width: 1024px)").matches; }

  async _bootstrapVotes() {
    try {
      let ok = false;
      try {
        const r = await fetch("/votes", { headers: { "Accept": "application/json" } });
        if (r.ok) {
          const d = await r.json();
          (d.liked_spot_ids || []).forEach(id => this.voteManager.likedSet.add(String(id)));
          (d.disliked_spot_ids || []).forEach(id => this.voteManager.dislikedSet.add(String(id)));
          ok = true;
        }
      } catch {}
      if (!ok) {
        try {
          const rl = await fetch("/likes", { headers: { "Accept": "application/json" } });
          if (rl.ok) {
            const dl = await rl.json();
            (dl.spot_ids || []).forEach(id => this.voteManager.likedSet.add(String(id)));
          }
        } catch {}
        try {
          const rd = await fetch("/dislikes", { headers: { "Accept": "application/json" } });
          if (rd.ok) {
            const dd = await rd.json();
            (dd.spot_ids || []).forEach(id => this.voteManager.dislikedSet.add(String(id)));
          }
        } catch {}
      }
      this.voteManager._persist();
    } catch {}
  }

  async _init() {
    const token = document.querySelector('meta[name="mapbox-token"]')?.content;
    if (!token) { console.error("Mapbox token manquant"); return; }
    const mapboxgl = (await import("mapbox-gl")).default;
    mapboxgl.accessToken = token;
    this.mb = mapboxgl;

    this.map = new mapboxgl.Map({
      container: this.hasContainerTarget ? this.containerTarget : this.element,
      style: this.styleValue,
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
      const spotLayers    = ["spots-circles","spots-circles--selected"].filter(l => this.map.getLayer(l));
      const clusterLayers = ["clusters","cluster-count"].filter(l => this.map.getLayer(l));

      const spotHits    = this.map.queryRenderedFeatures(e.point, { layers: spotLayers });
      const clusterHits = this.map.queryRenderedFeatures(e.point, { layers: clusterLayers });

      if (spotHits.length) return;
      if (clusterHits.length) return;

      this._clearSelection();
      this.closeBottomSheet();
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
        const idRaw = s.id; if (idRaw == null) return;
        const fid = String(idRaw);
        features.push({
          type: "Feature", id: fid,
          properties: {
            __fid: fid,
            name: s.name || "Café",
            address: s.address || "",
            description: s.description || "",
            button_link: s.button_link || "",
            tags: normalizeArray(s.tags),
            image_urls: normalizeArray(s.image_urls),
            likes_count: Number(s.likes_count ?? 0),
            dislikes_count: Number(s.dislikes_count ?? 0)
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
          clusterMaxZoom: 13,
          clusterRadius: 70,
        });

        /* CLUSTERS */
        this.map.addLayer({
          id: "clusters",
          type: "circle",
          source: src,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#2f93eb",
            "circle-opacity": 0.6,
            "circle-radius": [
              "interpolate", ["exponential", 1.2], ["get","point_count"],
              1, 24, 10, 30, 25, 36, 75, 44, 150, 54
            ],
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
            "text-size": ["interpolate", ["linear"], ["get","point_count"], 1, 13, 10, 14, 25, 15, 75, 16, 150, 18],
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-allow-overlap": true,
            "text-ignore-placement": true
          },
          paint: { "text-color": "#FFFFFF", "text-halo-width": 1.2, "text-halo-blur": 0.2 }
        });

        /* Points */
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

        ["clusters", "cluster-count"].forEach((layerId) => {
          this.map.on("click", layerId, (e) => this._zoomCluster(e));
          this.map.on("mouseenter", layerId, () => this.map.getCanvas().style.cursor = "pointer");
          this.map.on("mouseleave", layerId, () => this.map.getCanvas().style.cursor = "");
        });

        this.map.on("mouseenter", "spots-circles", () => this.map.getCanvas().style.cursor = "pointer");
        this.map.on("mouseleave", "spots-circles", () => this.map.getCanvas().style.cursor = "");
        this.map.on("click", "spots-circles", (e) => this._onSpotClick(e));
      } else {
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
      const idRaw = s.id; if (idRaw == null) return null;
      const fid = String(idRaw);
      return {
        type: "Feature",
        id: fid,
        properties: {
          __fid: fid,
          name: s.name,
          address: s.address,
          description: s.description,
          button_link: s.button_link,
          tags: normalizeArray(s.tags),
          image_urls: normalizeArray(s.image_urls),
          likes_count: Number(s.likes_count ?? 0),
          dislikes_count: Number(s.dislikes_count ?? 0),
        },
        geometry: { type: "Point", coordinates: coords },
      };
    }).filter(Boolean);

    this.map.getSource("spots-source").setData({ type: "FeatureCollection", features });
  }

  _zoomCluster(e) {
    const feats = this.map.queryRenderedFeatures(e.point, { layers: ["clusters", "cluster-count"] });
    if (!feats.length) return;

    const feature = feats[0];
    const clusterId = feature.properties.cluster_id;
    const lngLat = feature.geometry.coordinates;

    this.map.getSource("spots-source").getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      const easeOpts = this._buildClusterEaseOptions(lngLat, zoom);
      this.map.easeTo(easeOpts);
    });
  }

  _onSpotClick(e) {
    const f = e.features?.[0];
    if (!f) return;
    const id = String(f.properties?.__fid);

    this.map.setFilter("spots-circles--selected", ["==", ["to-string", ["get", "__fid"]], id]);
    this.openSpot(f.properties, f.geometry.coordinates);
  }

  /* ---------- Routing desktop / mobile ---------- */
  openSpot(props, coords) {
    if (this.isMobile()) {
      const html = this._renderSpotHTMLMobile(props, coords);
      this.showBottomSheet(html);
    } else {
      this.openSpotSidebar(props, coords);
    }
  }

  showBottomSheet(html) {
    if (!this.hasBottomsheetTarget || !this.hasBottomsheetContentTarget) return;

    // Injecte le contenu
    this.bottomsheetContentTarget.innerHTML = html;

    // Ouvre en mode "compact" (étape 1)
    this.bottomsheetTarget.classList.add("is-open");
    this.bottomsheetTarget.dataset.stage = "1"; // 1 = compact, 2 = étendu
    this.bottomsheetTarget.setAttribute("aria-hidden", "false");

    // Carrousels & UI
    const root = this.bottomsheetContentTarget;
    wireMiniCarousel(root);
    wirePeekCarousel(root);
    this._wireExpandableDesc(root);
    this._wireVotes(root);

    // Active la logique 2-temps sur mobile uniquement
    if (this.isMobile()) {
      this._wireTwoStageBottomSheet();
    }
  }

  closeBottomSheet() {
    if (!this.hasBottomsheetTarget) return;
    this.bottomsheetTarget.classList.remove("is-open");
    this.bottomsheetTarget.removeAttribute("data-stage");
    this.bottomsheetTarget.setAttribute("aria-hidden", "true");
    if (this.hasBottomsheetContentTarget) this.bottomsheetContentTarget.innerHTML = "";
  }

  /* ---------- Two-stage bottom sheet (mobile) ---------- */
  _wireTwoStageBottomSheet() {
    const sheet = this.bottomsheetTarget;
    const content = this.bottomsheetContentTarget;
    if (!(sheet && content)) return;

    // Remet à zéro
    sheet.dataset.stage = "1";
    content.scrollTop = 0;

    const expandToStage2 = () => {
      if (sheet.dataset.stage === "2") return;
      sheet.dataset.stage = "2";
      // Resize la carte après l’anim (CSS transition) pour éviter les artefacts
      setTimeout(() => this.map?.resize(), 300);
    };

    // 1) Scroll vers le haut dans la card => passe en stage 2 dès qu’on scrolle un peu
    const onScroll = () => {
      // Quand le contenu a défilé (on “tire” la fiche vers le haut)
      if (content.scrollTop > 24 && sheet.dataset.stage === "1") {
        expandToStage2();
        content.removeEventListener("scroll", onScroll, { passive: true });
      }
    };
    content.addEventListener("scroll", onScroll, { passive: true });

    // 2) Poignée (si présente) => toggle stage
    const grabber = sheet.querySelector(".mbs-grabber");
    if (grabber) {
      grabber.addEventListener("click", () => {
        if (sheet.dataset.stage === "1") expandToStage2();
        else { sheet.dataset.stage = "1"; setTimeout(()=>this.map?.resize(), 300); }
      });
    }

    // 3) Gestuelle tactile: premier “swipe up” sur le sheet quand le contenu est en haut
    let touchStartY = null;
    const onTouchStart = (e) => { touchStartY = e.touches?.[0]?.clientY ?? null; };
    const onTouchMove = (e) => {
      if (touchStartY == null) return;
      const y = e.touches?.[0]?.clientY ?? touchStartY;
      const dy = touchStartY - y; // positif si on glisse vers le haut
      if (content.scrollTop <= 0 && dy > 12 && sheet.dataset.stage === "1") {
        expandToStage2();
        touchStartY = null;
      }
    };
    sheet.addEventListener("touchstart", onTouchStart, { passive: true });
    sheet.addEventListener("touchmove", onTouchMove, { passive: true });
  }

  /* ---------- Helpers offset / sidebar ---------- */
  _getSidebarPx() {
    try {
      if (!this.hasSidebarTarget) return 0;
      const el = this.sidebarTarget;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return 0;
      const w = el.getBoundingClientRect().width || 0;
      const canvasW = this.map?.getCanvas()?.clientWidth || 0;
      return Math.max(0, Math.min(w, Math.round(canvasW * 0.6)));
    } catch { return 0; }
  }

  _buildClusterEaseOptions(lngLat, zoom) {
    const sb = this._getSidebarPx();
    const offset = sb ? [Math.round(sb / 2), 0] : [0, 0];
    return { center: lngLat, zoom, offset, padding: 0, duration: 400, easing: t => t, essential: true };
  }

  _easeToWithSidebarOffset(lngLat) {
    const sidebarW = this._getSidebarPx();
    const xOffset = sidebarW / 2;
    this.map.easeTo({ center: lngLat, zoom: this.map.getZoom(), offset: [xOffset, 0], duration: 350, easing: (t) => t, essential: true });
  }

  /* ---------- Rendus HTML ---------- */

  // Utilisé par desktop & popup — choisit peek si ≤1024px
  _renderSpotHTML(props, coords) {
    const name = props.name || "Café";
    const address = props.address || "";
    const description = props.description || "";
    const button_link = props.button_link || "";
    const tags = normalizeArray(props.tags);
    const images = normalizeArray(props.image_urls);
    const spotId = String(props.__fid);
    const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`;

    const usePeek = this._shouldUsePeek();
    const carouselHTML = usePeek
      ? buildPeekCarouselHTML(images, spotId)
      : buildMiniCarouselHTML(images, spotId);

    return `
      <div class="sidebar-card">
        <div class="mp-container">
          <div class="mp-header">
            ${carouselHTML}
          </div>
          <div class="mp-body">
            <h3 class="mp-title">${name}</h3>
            ${address ? `<p class="mp-address">${address}</p>` : ""}
            ${tags.length ? `<div class="mp-tags">${tags.map(t => `<span class="mp-tag">${t}</span>`).join("")}</div>` : ""}
            ${description ? `
              <div class="mp-desc-wrapper">
                <div class="mp-desc" data-collapsed="true">${description}</div>
                <a href="#" class="mp-toggle-link" role="button" aria-expanded="false" style="display:none;margin-top:6px;">Voir plus</a>
              </div>` : ""}
            <div class="mp-actions">
              ${button_link ? `<a class="mp-link" href="${button_link}" target="_blank" rel="noopener">Infos</a>` : ""}
              <a class="mp-primary" href="${gmaps}" target="_blank" rel="noopener">Itinéraire</a>
            </div>
          </div>

          <div class="mp-vote-wrap" data-spot-id="${spotId}">
            <button class="mp-vote-like-fab" type="button" aria-label="Like" data-spot-id="${spotId}">❤</button>
            <button class="mp-vote-fab" type="button" aria-haspopup="true" aria-expanded="false" data-spot-id="${spotId}">♡</button>
            <button class="mp-vote-dislike-fab" type="button" aria-label="Dislike" data-spot-id="${spotId}">✖</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderSpotHTMLDesktop(props, coords) {
    return this._renderSpotHTML(props, coords);
  }

  // Mobile : Infos → Tags → Actions → Images (peek) → Description
  _renderSpotHTMLMobile(props, coords) {
    const name = props.name || "Café";
    const address = props.address || "";
    const description = props.description || "";
    const button_link = props.button_link || "";
    const images = normalizeArray(props.image_urls); // ✅ correction ici
    const tags = normalizeArray(props.tags);
    const spotId = String(props.__fid);
    const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`;

    return `
      <div class="sidebar-card sidebar-card--mobile">
        <div class="mp-container">

          <!-- 1) Infos -->
          <div class="mp-info">
            <h3 class="mp-title">${name}</h3>
            ${address ? `<p class="mp-address">${address}</p>` : ""}
            ${tags.length ? `<div class="mp-tags mp-tags--mobile">${tags.map(t => `<span class="mp-tag">${t}</span>`).join("")}</div>` : ""}
          </div>

          <!-- 2) Actions -->
          <div class="mp-actions mp-actions--top">
            ${button_link ? `<a class="mp-link" href="${button_link}" target="_blank" rel="noopener">Infos</a>` : ""}
            <a class="mp-primary" href="${gmaps}" target="_blank" rel="noopener">Itinéraire</a>
          </div>

          <!-- 3) Images (peek + snap) -->
          <div class="mp-header">
            ${buildPeekCarouselHTML(images, spotId)}
          </div>

          <!-- 4) Description -->
          ${description ? `
            <div class="mp-desc-wrapper">
              <div class="mp-desc" data-collapsed="true">${description}</div>
              <a href="#" class="mp-toggle-link" role="button" aria-expanded="false" style="display:none;margin-top:6px;">Voir plus</a>
            </div>` : ""}

          <!-- Votes -->
          <div class="mp-vote-wrap" data-spot-id="${spotId}">
            <button class="mp-vote-like-fab" type="button" aria-label="Like" data-spot-id="${spotId}">❤</button>
            <button class="mp-vote-fab" type="button" aria-haspopup="true" aria-expanded="false" data-spot-id="${spotId}">♡</button>
            <button class="mp-vote-dislike-fab" type="button" aria-label="Dislike" data-spot-id="${spotId}">✖</button>
          </div>

        </div>
      </div>
    `;
  }

  /* ---------- Sidebar (desktop / tablette) ---------- */
  openSpotSidebar(props, coords) {
    if (!this.hasSidebarTarget) return;

    const html = this._renderSpotHTMLDesktop(props, coords);
    this.sidebarTarget.innerHTML = html;
    this.element.classList.add("has-selection");

    const root = this.sidebarTarget;
    wireMiniCarousel(root);
    wirePeekCarousel(root);
    this._wireExpandableDesc(root);
    this._wireVotes(root);
  }

  _wireExpandableDesc(root) {
    const descEl = root.querySelector(".mp-desc");
    const toggleEl = root.querySelector(".mp-toggle-link");
    if (!(descEl && toggleEl)) return;

    const COLLAPSED_LINES = 2;
    const collapse = () => {
      descEl.classList.remove("expanded");
      descEl.setAttribute("data-collapsed", "true");
      descEl.style.setProperty("--mp-desc-lines", COLLAPSED_LINES);
      toggleEl.textContent = "Voir plus";
      toggleEl.setAttribute("aria-expanded", "false");
    };
    const expand = () => {
      descEl.classList.add("expanded");
      descEl.setAttribute("data-collapsed", "false");
      toggleEl.textContent = "Voir moins";
      toggleEl.setAttribute("aria-expanded", "true");
    };
    const measure = () => {
      const wasExpanded = descEl.classList.contains("expanded");
      if (wasExpanded) { descEl.classList.remove("expanded"); void descEl.offsetHeight; }
      const needs = descEl.scrollHeight > descEl.clientHeight + 1;
      toggleEl.style.display = needs ? "inline" : "none";
      if (wasExpanded) descEl.classList.add("expanded");
    };
    collapse(); requestAnimationFrame(measure); setTimeout(measure, 60);

    const onToggle = (e) => { e.preventDefault(); (descEl.getAttribute("data-collapsed") === "true") ? expand() : collapse(); requestAnimationFrame(measure); };
    toggleEl.addEventListener("click", onToggle);
    toggleEl.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") onToggle(e); });
  }

  _wireVotes(root) {
    const wrap       = root.querySelector(".mp-vote-wrap");
    if (!wrap) return;
    const spotId     = wrap?.dataset?.spotId;
    const mainBtn    = root.querySelector(".mp-vote-fab");
    const likeBtn    = root.querySelector(".mp-vote-like-fab");
    const dislikeBtn = root.querySelector(".mp-vote-dislike-fab");

    this._setupLongPress(mainBtn, wrap);
    this._renderVoteUI(root, spotId);

    mainBtn?.addEventListener("click", (ev) => {
      ev.preventDefault();
      const open = !wrap.classList.contains("is-open");
      wrap.classList.toggle("is-open", open);
      mainBtn.setAttribute("aria-expanded", String(open));
    });

    likeBtn?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      wrap?.classList.add("is-loading");
      const target = (this.voteManager.getVote(spotId) === "like") ? "none" : "like";
      const data = await this.voteManager.toggleVote(spotId, target);
      this._updateFeatureCounts(spotId, data.likes_count, data.dislikes_count);
      this._renderVoteUI(root, spotId);
      wrap?.classList.remove("is-loading");
      this._haptic([8]);
    });

    dislikeBtn?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      wrap?.classList.add("is-loading");
      const target = (this.voteManager.getVote(spotId) === "dislike") ? "none" : "dislike";
      const data = await this.voteManager.toggleVote(spotId, target);
      this._updateFeatureCounts(spotId, data.likes_count, data.dislikes_count);
      this._renderVoteUI(root, spotId);
      wrap?.classList.remove("is-loading");
      this._haptic([8]);
    });
  }

  _renderVoteUI(root, spotId) {
    const mainBtn = root.querySelector(".mp-vote-fab");
    const vote = this.voteManager.getVote(spotId);
    mainBtn?.classList.toggle("is-liked", vote === "like");
    mainBtn?.classList.toggle("is-disliked", vote === "dislike");
  }

  /* ---------- Popup (optionnel/fallback) ---------- */
  openSpotPopup(coords, props) {
    if (this.popup) this.popup.remove();

    const isMobileTiny = window.matchMedia("(max-width: 480px)").matches;
    const el = document.createElement("div");
    el.className = "map-popup";
    el.innerHTML = this._renderSpotHTML(props, coords);

    this.popup = new this.mb.Popup({
      anchor: "bottom",
      offset: [0, -14],
      closeButton: true,
      closeOnClick: false,
      maxWidth: isMobileTiny ? "92vw" : "360px",
      className: `ws-popup ${isMobileTiny ? "ws-popup--mobile" : ""}`,
    }).setLngLat(coords).setDOMContent(el).addTo(this.map);

    wireMiniCarousel(el);
    wirePeekCarousel(el);
    this._wireExpandableDesc(el);
    this._wireVotes(el);

    const wrap = el.querySelector(".mp-vote-wrap");
    const mainBtn = el.querySelector(".mp-vote-fab");
    el.addEventListener("click", (evt) => {
      const inWrap = evt.target.closest(".mp-vote-wrap");
      if (!inWrap) {
        wrap?.classList.remove("is-open");
        mainBtn?.setAttribute("aria-expanded", "false");
      }
    });

    this.popup.on("close", () => {
      this.popup = null;
      this._clearSelection();
    });
  }

  _updateFeatureCounts(spotId, likesCount, dislikesCount) {
    try {
      const src = this.map.getSource("spots-source");
      if (!src) return;
      const data = src._data || src._options?.data;
      if (!data || !data.features) return;
      let changed = false;
      for (const f of data.features) {
        if (String(f.properties?.__fid) === String(spotId)) {
          if (likesCount != null)    f.properties.likes_count    = Number(likesCount);
          if (dislikesCount != null) f.properties.dislikes_count = Number(dislikesCount);
          changed = true; break;
        }
      }
      if (changed) src.setData(data);
    } catch {}
  }

  _clearSelection() {
    if (this.map?.getLayer("spots-circles--selected")) {
      this.map.setFilter("spots-circles--selected", ["==", ["to-string", ["get", "__fid"]], "__none__"]);
    }
    this.popup?.remove();

    this.element.classList.remove("has-selection");
    if (this.hasSidebarTarget) {
      this.sidebarTarget.innerHTML = `
        <div class="sidebar-placeholder">
          <h3>Sélectionnez un café</h3>
          <p>Cliquez sur un point pour afficher la fiche ici.</p>
        </div>`;
    }

    this.closeBottomSheet();
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
