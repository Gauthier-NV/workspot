puts "🧹 Nettoyage de la base..."
Bar.destroy_all

puts "🌱 Création des bars avec tes images fournies..."

images = [
  "https://daily.sevenfifty.com/wp-content/uploads/2018/05/SFD_Coworking_Spaces_CR_courtesy_KettleSpace_2520x1420.jpg",
  "https://www.ktchnrebel.com/wp-content/uploads/2020/02/Lobby.Rezeption.Bar_c_Hotel.Schani.Wien_by_Arnold.Poeschl_0066.jpg",
  "https://cdn.prod.website-files.com/63b6f93906af9412a200e9a2/63b6fa4c5fae865f1a4e5349_Hubsy-cafe%CC%81-coworking-Paris-saint-lazare-coworkers-2.jpg",
  "https://cdn.sortiraparis.com/images/80/98938/779572-the-place-to-gare-de-l-est.jpg",
  "https://www.paristipps.com/wp-content/uploads/2023/01/Mezcaleria-Speakeasy-Bar-in-Paris.jpg",
  "https://thenudge.com/wp-content/uploads/2023/04/swans-bar-maison-assouline-st-jamess-1.jpeg"
]

bars = [
  {
    name: "Café Lomi",
    address: "3 ter rue Marcadet, 75018 Paris",
    description: "Torréfacteur avec grande salle lumineuse, idéal pour bosser au calme.",
    has_wifi: true,
    has_power_outlets: true
  },
  {
    name: "Le Peloton Café",
    address: "17 rue du Pont Louis-Philippe, 75004 Paris",
    description: "Ambiance cosy, bons cafés, et clients habitués à travailler sur place.",
    has_wifi: true,
    has_power_outlets: false
  },
  {
    name: "Anticafé Beaubourg",
    address: "79 rue Quincampoix, 75003 Paris",
    description: "Coworking café, tarifs à l'heure avec boissons/snacks illimités.",
    has_wifi: true,
    has_power_outlets: true
  },
  {
    name: "KB Coffee Roasters",
    address: "53 avenue Trudaine, 75009 Paris",
    description: "Excellent café, très bon pour une session de travail en solo.",
    has_wifi: true,
    has_power_outlets: false
  },
  {
    name: "Café Craft",
    address: "24 rue des Vinaigriers, 75010 Paris",
    description: "Un classique du travail en café, calme et spacieux.",
    has_wifi: true,
    has_power_outlets: true
  },
  {
    name: "La Recyclerie",
    address: "83 boulevard Ornano, 75018 Paris",
    description: "Lieu atypique et éco-responsable avec des espaces pour travailler.",
    has_wifi: true,
    has_power_outlets: false
  },
  {
    name: "Shakespeare and Company Café",
    address: "37 rue de la Bûcherie, 75005 Paris",
    description: "Petit café à côté de la célèbre librairie, ambiance littéraire.",
    has_wifi: false,
    has_power_outlets: false
  },
  {
    name: "Matamata Coffee",
    address: "58 rue d'Argout, 75002 Paris",
    description: "Café australien avec bonne ambiance de travail et wifi rapide.",
    has_wifi: true,
    has_power_outlets: true
  },
  {
    name: "Bonjour Jacob",
    address: "34 rue de Paradis, 75010 Paris",
    description: "Charmant café-restaurant, parfait pour travailler en journée.",
    has_wifi: true,
    has_power_outlets: false
  },
  {
    name: "Café Pimpin",
    address: "64 rue Ramey, 75018 Paris",
    description: "Lieu très lumineux, calme et agréable avec bonne connexion.",
    has_wifi: true,
    has_power_outlets: true
  }
]

bars.each_with_index do |bar_attrs, i|
  bar_attrs[:image_url] = images[i % images.length] # on boucle sur les 6 images
  bar = Bar.create!(bar_attrs)
  puts "✅ #{bar.name} créé avec image"
end

puts "🌱 Seed terminée avec succès !"

AdminUser.find_or_create_by!(email: ENV["ADMIN_EMAIL"]) do |admin|
  admin.password = ENV["ADMIN_PASSWORD"]
  admin.password_confirmation = ENV["ADMIN_PASSWORD"]
end
