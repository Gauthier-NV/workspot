# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).
#
# Example:
#
#   ["Action", "Comedy", "Drama", "Horror"].each do |genre_name|
#     MovieGenre.find_or_create_by!(name: genre_name)
#   end

puts "🧹 Nettoyage de la base..."
Bar.destroy_all

puts "🌱 Création des bars avec images..."

bars = [
  {
    name: "Café Lomi",
    address: "3 ter rue Marcadet, 75018 Paris",
    description: "Torréfacteur avec grande salle lumineuse, idéal pour bosser au calme.",
    has_wifi: true,
    has_power_outlets: true,
    image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4"
  },
  {
    name: "Le Peloton Café",
    address: "17 rue du Pont Louis-Philippe, 75004 Paris",
    description: "Ambiance cosy, bons cafés, et clients habitués à travailler sur place.",
    has_wifi: true,
    has_power_outlets: false,
    image_url: "https://images.unsplash.com/photo-1524758631624-e2822e304c36"
  },
  {
    name: "Anticafé Beaubourg",
    address: "79 rue Quincampoix, 75003 Paris",
    description: "Coworking café, tarifs à l'heure avec boissons/snacks illimités.",
    has_wifi: true,
    has_power_outlets: true,
    image_url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93"
  },
  {
    name: "KB Coffee Roasters",
    address: "53 avenue Trudaine, 75009 Paris",
    description: "Excellent café, très bon pour une session de travail en solo.",
    has_wifi: true,
    has_power_outlets: false,
    image_url: "https://images.unsplash.com/photo-1511920170033-f8396924c348"
  },
  {
    name: "Café Craft",
    address: "24 rue des Vinaigriers, 75010 Paris",
    description: "Un classique du travail en café, calme et spacieux.",
    has_wifi: true,
    has_power_outlets: true,
    image_url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836"
  },
  {
    name: "La Recyclerie",
    address: "83 boulevard Ornano, 75018 Paris",
    description: "Lieu atypique et éco-responsable avec des espaces pour travailler.",
    has_wifi: true,
    has_power_outlets: false,
    image_url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38"
  },
  {
    name: "Shakespeare and Company Café",
    address: "37 rue de la Bûcherie, 75005 Paris",
    description: "Petit café à côté de la célèbre librairie, ambiance littéraire.",
    has_wifi: false,
    has_power_outlets: false,
    image_url: "https://images.unsplash.com/photo-1517686469429-8bdb88b9f907"
  },
  {
    name: "Matamata Coffee",
    address: "58 rue d'Argout, 75002 Paris",
    description: "Café australien avec bonne ambiance de travail et wifi rapide.",
    has_wifi: true,
    has_power_outlets: true,
    image_url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085"
  },
  {
    name: "Bonjour Jacob",
    address: "34 rue de Paradis, 75010 Paris",
    description: "Charmant café-restaurant, parfait pour travailler en journée.",
    has_wifi: true,
    has_power_outlets: false,
    image_url: "https://images.unsplash.com/photo-1527090496-346715b01d37"
  },
  {
    name: "Café Pimpin",
    address: "64 rue Ramey, 75018 Paris",
    description: "Lieu très lumineux, calme et agréable avec bonne connexion.",
    has_wifi: true,
    has_power_outlets: true,
    image_url: "https://images.unsplash.com/photo-1600891964599-f61ba0e24092"
  }
]

bars.each do |bar_attrs|
  bar = Bar.create!(bar_attrs)
  puts "✅ #{bar.name} créé"
end

puts "🌱 Seed terminée avec images !"
