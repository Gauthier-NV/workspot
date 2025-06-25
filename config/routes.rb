Rails.application.routes.draw do
  # Health check (à laisser pour Heroku)
  get "up" => "rails/health#show", as: :rails_health_check

  # Page principale : liste des bars + carte
  root to: "bars#index"
end
