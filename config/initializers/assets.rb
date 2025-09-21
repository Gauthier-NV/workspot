# Be sure to restart your server when you modify this file.

Rails.application.config.assets.version = "1.0"

# Dites à Sprockets où trouver les sources JS gérées par Importmap
Rails.application.config.assets.paths << Rails.root.join("app/javascript")
#Rails.application.config.assets.paths << Rails.root.join("vendor/javascript") # si tu l'utilises

# Ne pas ajouter application.js à assets.precompile ici.
