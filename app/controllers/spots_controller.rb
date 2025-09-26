# app/controllers/spots_controller.rb
class SpotsController < ApplicationController
  def index
    @spots = Spot.all

    respond_to do |format|
      format.html # app/views/spots/index.html.erb
      format.json do
        spots = @spots.where.not(latitude: nil, longitude: nil)

        render json: spots.map { |s|
          {
            id:           s.id,
            name:         s.name,
            address:      s.address,
            description:  s.description,
            lat:          s.latitude,   # Mapbox attend lat/lng
            lng:          s.longitude,
            tags:         s.tags,
            button_link:  s.button_link,
            image_urls:   s.image_urls  # 👈 renvoie un tableau [url1, url2, url3]
          }
        }
      end
    end
  end
end
