import mapboxgl from "mapbox-gl";

// Mets ta propre clé ici
mapboxgl.accessToken = "pk.eyJ1Ijoid29ya3Nwb3RzIiwiYSI6ImNtZmwyZ2s2djAwanoya3M3dTE3N3BqcXkifQ.WK6ZLjalksr_cWvfHKXIKg";

const map = new mapboxgl.Map({
  container: "map", // id du div
  style: "mapbox://styles/mapbox/streets-v12", // style par défaut
  center: [2.3488, 48.8534], // [lng, lat] - ici Paris
  zoom: 12
});

// Exemple : ajouter un marqueur
new mapboxgl.Marker()
  .setLngLat([2.3488, 48.8534])
  .setPopup(new mapboxgl.Popup().setHTML("<h3>Un café sympa</h3><p>Wifi & prises</p>"))
  .addTo(map);
