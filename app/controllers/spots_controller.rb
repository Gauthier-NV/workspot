# app/controllers/spots_controller.rb
class SpotsController < ApplicationController
  def index
    # Base de la requête : uniquement les spots géolocalisés
    scope = Spot.where.not(latitude: nil, longitude: nil)

    # Si des bounds sont fournis (ex: ?bounds=lng_min,lat_min,lng_max,lat_max), filtre les spots
    if params[:bounds]
      lng_min, lat_min, lng_max, lat_max = params[:bounds].split(',').map(&:to_f)
      scope = scope
                .where("latitude BETWEEN ? AND ?", lat_min, lat_max)
                .where("longitude BETWEEN ? AND ?", lng_min, lng_max)
    end

    # ✅ Compteur sans charger les enregistrements
    @spots_count = scope.count

    respond_to do |format|
      format.html # app/views/spots/index.html.erb
      format.json do
        render json: scope.map { |s|
          {
            id:           s.id,
            name:         s.name,
            address:      s.address,
            description:  s.description,
            lat:          s.latitude,
            lng:          s.longitude,
            tags:         s.tags,
            button_link:  s.button_link,
            image_urls:   s.image_urls
          }
        }
      end
    end
  end
end
