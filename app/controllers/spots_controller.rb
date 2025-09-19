# app/controllers/spots_controller.rb
class SpotsController < ApplicationController
  def index
    @spots = Spot.all

    respond_to do |format|
      format.html # app/views/spots/index.html.erb
      format.json do
        spots = @spots
          .where.not(latitude: nil, longitude: nil)
          .select(:id, :name, :address, :description, :latitude, :longitude, :tags, :button_link, :image_url)

        render json: spots.map { |s|
          {
            id:           s.id,
            name:         s.name,
            address:      s.address,
            description:  s.description,   # 👈 maintenant inclus
            lat:          s.latitude,      # le front attend lat/lng
            lng:          s.longitude,
            tags:         s.tags,
            button_link:  s.button_link,
            image_url:    s.image_url      # 👈 pour ton carrousel (CSV ou JSON)
          }
        }
      end
    end
  end
end
