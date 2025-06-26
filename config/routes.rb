Rails.application.routes.draw do
  # Page principale : liste des bars + carte
  root to: "bars#index"

  resources :messages, only: [:new, :create]

  # Health check (à laisser pour Heroku)
  get "up" => "rails/health#show", as: :rails_health_check
end
