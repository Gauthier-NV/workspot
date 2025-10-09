Rails.application.routes.draw do
  # --- Admin ---
  devise_for :admin_users, ActiveAdmin::Devise.config
  ActiveAdmin.routes(self)

  # --- Page principale ---
  root to: "spots#index"
  resources :spots, only: [:index, :show] do
    # Routes pour les likes (anonymes)
    resource :like, only: [:create, :destroy]  # /spots/:spot_id/like
  end

  # Liste des likes du visiteur (JSON)
  resources :likes, only: [:index]

  # --- Formulaire contact / messages ---
  resources :messages, only: [:new, :create]

  # --- Redirections legacy ---
  get "/bars",     to: redirect("/spots")
  get "/bars/:id", to: redirect("/spots/%{id}")

  # --- Health check (Heroku) ---
  get "up" => "rails/health#show", as: :rails_health_check
end
