Rails.application.routes.draw do
  devise_for :admin_users, ActiveAdmin::Devise.config
  ActiveAdmin.routes(self)

  # Page principale : liste des spots + carte
  root to: "spots#index"
  resources :spots, only: [:index]   # ← ajoute /spots et /spots.json

  resources :messages, only: [:new, :create]

  # Redirections legacy (si d’anciens liens /bars existent)
  get "/bars",     to: redirect("/spots")
  get "/bars/:id", to: redirect("/spots/%{id}")

  # Health check (à laisser pour Heroku)
  get "up" => "rails/health#show", as: :rails_health_check
end
