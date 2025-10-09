class ApplicationController < ActionController::Base
  before_action :no_store_for_html
  before_action :ensure_visitor_id

  private

  # Empêche le cache navigateur sur les pages HTML (utile pour la fraîcheur des données)
  def no_store_for_html
    return unless request.format.html?
    response.headers['Cache-Control'] = 'no-store'
  end

  # Assigne un identifiant unique et persistant à chaque visiteur
  def ensure_visitor_id
    return if cookies.signed[:visitor_id].present?

    cookies.permanent.signed[:visitor_id] = {
      value: SecureRandom.uuid,
      httponly: true,         # empêche l’accès JS au cookie
      same_site: :lax,        # évite les fuites inter-sites
      secure: Rails.env.production? # cookie HTTPS only en prod
    }
  end
end
