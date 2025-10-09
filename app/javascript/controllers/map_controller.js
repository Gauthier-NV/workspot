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

/* ---------- Mini Carousel ---------- */
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
    // target: "like" | "dislike" | "none"
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
    const current = this.getVote(spotId); // après set local
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
  static targets = ["loading"];

  // --- Haptics helper (safe no-op if unsupported) ---
  _haptic(pattern = [12, 60, 12]) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
  }

  // --- Long-press (2s): ouvre les deux boutons + vibration (mobile/pen) ---
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
      container: this.element,
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
      const layers = ["spots-circles","spots-circles--selected"].filter(l => this.map.getLayer(l));
      const hits = this.map.queryRenderedFeatures(e.point, { layers });
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
        const idRaw = s.id;
        if (idRaw == null) return;
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

        // Interactions
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

  _renderVoteUI(root, spotId) {
    const vote = this.voteManager.getVote(spotId);
    const mainBtn   = root.querySelector(".mp-vote-fab");
    const likeFab   = root.querySelector(".mp-vote-like-fab");
    const dislikeFab= root.querySelector(".mp-vote-dislike-fab");

    if (mainBtn) {
      mainBtn.classList.toggle("is-liked", vote === "like");
      mainBtn.classList.toggle("is-disliked", vote === "dislike");
      const label = vote === "like" ? "Vous aimez ce café"
                  : vote === "dislike" ? "Vous n'aimez pas ce café"
                  : "Choisir j’aime / j’aime pas";
      mainBtn.setAttribute("aria-label", label);
    }
    likeFab?.classList.toggle("is-active", vote === "like");
    dislikeFab?.classList.toggle("is-active", vote === "dislike");

    const wrap = root.querySelector(".mp-vote-wrap");
    wrap?.classList.remove("is-open");
    mainBtn?.setAttribute("aria-expanded", "false");
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
    const spotId = String(props.__fid);

    const el = document.createElement("div");
    el.className = "map-popup";
    el.innerHTML = `
      <div class="mp-container">
        <div class="mp-header">
          ${buildMiniCarouselHTML(images, props.__fid)}
        </div>

        <!-- Trois boutons ronds : Like (haut), Choix (centre), Dislike (bas) -->
        <div class="mp-vote-wrap" data-spot-id="${spotId}">
          <!-- bouton like (au-dessus) -->
          <button class="mp-vote-like-fab" type="button" aria-label="Like" data-spot-id="${spotId}">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 9.1371C2 14 6.01943 16.5914 8.96173 18.9109C10 19.7294 11 20.5 12 20.5C13 20.5 14 19.7294 15.0383 18.9109C17.9806 16.5914 22 14 22 9.1371C22 4.27416 16.4998 0.825464 12 5.50063C7.50016 0.825464 2 4.27416 2 9.1371Z" fill="#e63946"></path>
            </svg>
          </button>

          <!-- bouton central (choix) -->
          <button class="mp-vote-fab" type="button" aria-haspopup="true" aria-expanded="false" data-spot-id="${spotId}">
            <span class="mp-vote-icon mp-vote-icon--default" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#000000" stroke-width="0.00024">
                <path d="M8.96173 18.9109L9.42605 18.3219L8.96173 18.9109ZM12 5.50063L11.4596 6.02073C11.601 6.16763 11.7961 6.25063 12 6.25063C12.2039 6.25063 12.399 6.16763 12.5404 6.02073L12 5.50063ZM15.0383 18.9109L15.5026 19.4999L15.0383 18.9109ZM9.42605 18.3219C7.91039 17.1271 6.25307 15.9603 4.93829 14.4798C3.64922 13.0282 2.75 11.3345 2.75 9.1371H1.25C1.25 11.8026 2.3605 13.8361 3.81672 15.4758C5.24723 17.0866 7.07077 18.3752 8.49742 19.4999L9.42605 18.3219ZM2.75 9.1371C2.75 6.98623 3.96537 5.18252 5.62436 4.42419C7.23607 3.68748 9.40166 3.88258 11.4596 6.02073L12.5404 4.98053C10.0985 2.44352 7.26409 2.02539 5.00076 3.05996C2.78471 4.07292 1.25 6.42503 1.25 9.1371H2.75ZM8.49742 19.4999C9.00965 19.9037 9.55954 20.3343 10.1168 20.6599C10.6739 20.9854 11.3096 21.25 12 21.25V19.75C11.6904 19.75 11.3261 19.6293 10.8736 19.3648C10.4213 19.1005 9.95208 18.7366 9.42605 18.3219L8.49742 19.4999ZM15.5026 19.4999C16.9292 18.3752 18.7528 17.0866 20.1833 15.4758C21.6395 13.8361 22.75 11.8026 22.75 9.1371H21.25C21.25 11.3345 20.3508 13.0282 19.0617 14.4798C17.7469 15.9603 16.0896 17.1271 14.574 18.3219L15.5026 19.4999ZM22.75 9.1371C22.75 6.42503 21.2153 4.07292 18.9992 3.05996C16.7359 2.02539 13.9015 2.44352 11.4596 4.98053L12.5404 6.02073C14.5983 3.88258 16.7639 3.68748 18.3756 4.42419C20.0346 5.18252 21.25 6.98623 21.25 9.1371H22.75ZM14.574 18.3219C14.0479 18.7366 13.5787 19.1005 13.1264 19.3648C12.6739 19.6293 12.3096 19.75 12 19.75V21.25C12.6904 21.25 13.3261 20.9854 13.8832 20.6599C14.4405 20.3343 14.9903 19.9037 15.5026 19.4999L14.574 18.3219Z" fill="#000000"></path>
              </svg>
            </span>
            <span class="mp-vote-icon mp-vote-icon--liked" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 9.1371C2 14 6.01943 16.5914 8.96173 18.9109C10 19.7294 11 20.5 12 20.5C13 20.5 14 19.7294 15.0383 18.9109C17.9806 16.5914 22 14 22 9.1371C22 4.27416 16.4998 0.825464 12 5.50063C7.50016 0.825464 2 4.27416 2 9.1371Z" fill="#e63946"></path>
              </svg>
            </span>
            <span class="mp-vote-icon mp-vote-icon--disliked" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.10627 18.2468C5.29819 16.0833 2 13.5422 2 9.1371C2 4.53656 6.9226 1.20176 11.2639 4.81373L9.81064 8.20467C9.6718 8.52862 9.77727 8.90554 10.0641 9.1104L12.8973 11.1341L10.4306 14.012C10.1755 14.3096 10.1926 14.7533 10.4697 15.0304L12.1694 16.7302L11.2594 20.3702C10.5043 20.1169 9.74389 19.5275 8.96173 18.9109C8.68471 18.6925 8.39814 18.4717 8.10627 18.2468Z" fill="#e63946"></path>
                <path d="M12.8118 20.3453C13.5435 20.0798 14.2807 19.5081 15.0383 18.9109C15.3153 18.6925 15.6019 18.4717 15.8937 18.2468C18.7018 16.0833 22 13.5422 22 9.1371C22 4.62221 17.259 1.32637 12.9792 4.61919L11.4272 8.24067L14.4359 10.3898C14.6072 10.5121 14.7191 10.7007 14.7445 10.9096C14.7699 11.1185 14.7064 11.3284 14.5694 11.4882L12.0214 14.4609L13.5303 15.9698C13.7166 16.1561 13.7915 16.4264 13.7276 16.682L12.8118 20.3453Z" fill="#e63946"></path>
              </svg>
            </span>
          </button>

          <!-- bouton dislike (en dessous) -->
          <button class="mp-vote-dislike-fab" type="button" aria-label="Dislike" data-spot-id="${spotId}">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8.10627 18.2468C5.29819 16.0833 2 13.5422 2 9.1371C2 4.53656 6.9226 1.20176 11.2639 4.81373L9.81064 8.20467C9.6718 8.52862 9.77727 8.90554 10.0641 9.1104L12.8973 11.1341L10.4306 14.012C10.1755 14.3096 10.1926 14.7533 10.4697 15.0304L12.1694 16.7302L11.2594 20.3702C10.5043 20.1169 9.74389 19.5275 8.96173 18.9109C8.68471 18.6925 8.39814 18.4717 8.10627 18.2468Z" fill="#e63946"></path>
              <path d="M12.8118 20.3453C13.5435 20.0798 14.2807 19.5081 15.0383 18.9109C15.3153 18.6925 15.6019 18.4717 15.8937 18.2468C18.7018 16.0833 22 13.5422 22 9.1371C22 4.62221 17.259 1.32637 12.9792 4.61919L11.4272 8.24067L14.4359 10.3898C14.6072 10.5121 14.7191 10.7007 14.7445 10.9096C14.7699 11.1185 14.7064 11.3284 14.5694 11.4882L12.0214 14.4609L13.5303 15.9698C13.7166 16.1561 13.7915 16.4264 13.7276 16.682L12.8118 20.3453Z" fill="#e63946"></path>
            </svg>
          </button>
        </div>

        <div class="mp-body">
          <h3 class="mp-title">${name}</h3>
          ${address ? `<p class="mp-address">${address}</p>` : ""}
          ${tags.length ? `<div class="mp-tags">${tags.map(t => `<span class="mp-tag">${t}</span>`).join("")}</div>` : ""}
          ${description ? `
            <div class="mp-desc-wrapper">
<div class="mp-desc" id="${descId}" data-collapsed="true">${description}</div>
              <a href="#" class="mp-toggle-link" role="button" aria-controls="${descId}" aria-expanded="false" style="display:none;margin-top:6px;">Voir plus</a>
            </div>` : ""}
          <div class="mp-actions">
            ${button_link ? `<a class="mp-link" href="${button_link}" target="_blank" rel="noopener">Infos</a>` : ""}
            <a class="mp-primary" href="${gmaps}" target="_blank" rel="noopener">Itinéraire</a>
          </div>
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
  const COLLAPSED_LINES = 2; // ✅ 1 seule ligne

  const collapse = () => {
    descEl.classList.remove("expanded");
    descEl.setAttribute("data-collapsed", "true");
    // pilote la hauteur via la variable CSS (voit le SCSS)
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
    // Si le contenu dépasse en mode collapse, on montre le lien
    const wasExpanded = descEl.classList.contains("expanded");
    if (wasExpanded) {
      descEl.classList.remove("expanded");
      // forcer recalc si besoin
      void descEl.offsetHeight;
    }
    const needs = descEl.scrollHeight > descEl.clientHeight + 1;
    toggleEl.style.display = needs ? "inline" : "none";
    if (wasExpanded) descEl.classList.add("expanded");
  };

  const onToggle = (e) => {
    e.preventDefault();
    const collapsed = descEl.getAttribute("data-collapsed") === "true";
    if (collapsed) expand(); else collapse();
    requestAnimationFrame(measure);
  };

  collapse();                 // applique 1 ligne
  requestAnimationFrame(measure);
  setTimeout(measure, 60);    // petit délai pour images/fonts

  toggleEl.addEventListener("click", onToggle);
  toggleEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") onToggle(e);
  });

  const onResize = () => measure();
  window.addEventListener("resize", onResize, { passive: true });
  cleanupResize = () => window.removeEventListener("resize", onResize);
}


    // Vote UI + handlers
    const wrap       = el.querySelector(".mp-vote-wrap");
    const mainBtn    = el.querySelector(".mp-vote-fab");
    const likeFab    = el.querySelector(".mp-vote-like-fab");
    const dislikeFab = el.querySelector(".mp-vote-dislike-fab");

    // Long-press (mobile) + haptics
    this._setupLongPress(mainBtn, wrap);

    // État initial
    this._renderVoteUI(el, spotId);

    // Desktop: clic pour ouvrir/fermer
    mainBtn?.addEventListener("click", (ev) => {
      ev.preventDefault();
      const open = !wrap.classList.contains("is-open");
      wrap.classList.toggle("is-open", open);
      mainBtn.setAttribute("aria-expanded", String(open));
    }, { passive: false });

    // Like
    likeFab?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      wrap?.classList.add("is-loading");
      const target = (this.voteManager.getVote(spotId) === "like") ? "none" : "like";
      const data = await this.voteManager.toggleVote(spotId, target);
      this._updateFeatureCounts(spotId, data.likes_count, data.dislikes_count);
      this._renderVoteUI(el, spotId);
      wrap?.classList.remove("is-loading");
      this._haptic([8]);
    }, { passive: false });

    // Dislike
    dislikeFab?.addEventListener("click", async (ev) => {
      ev.preventDefault();
      wrap?.classList.add("is-loading");
      const target = (this.voteManager.getVote(spotId) === "dislike") ? "none" : "dislike";
      const data = await this.voteManager.toggleVote(spotId, target);
      this._updateFeatureCounts(spotId, data.likes_count, data.dislikes_count);
      this._renderVoteUI(el, spotId);
      wrap?.classList.remove("is-loading");
      this._haptic([8]);
    }, { passive: false });

    // clic ailleurs dans la popup => referme les deux FAB
    el.addEventListener("click", (evt) => {
      const inWrap = evt.target.closest(".mp-vote-wrap");
      if (!inWrap) {
        wrap?.classList.remove("is-open");
        mainBtn?.setAttribute("aria-expanded", "false");
      }
    });

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
