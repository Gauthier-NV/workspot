Rails.application.routes.draw do
  devise_for :admin_users, ActiveAdmin::Devise.config
  ActiveAdmin.routes(self)
  # Page principale : liste des bars + carte
  root to: "spots#index"

  resources :messages, only: [:new, :create]

  # Health check (à laisser pour Heroku)
  get "up" => "rails/health#show", as: :rails_health_check
end
