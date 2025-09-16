class SpotsController < ApplicationController
  def index
    @spots = Spot.all

    respond_to do |format|
      format.html # rend app/views/spots/index.html.erb
      format.json do
        render json: @spots
          .where.not(latitude: nil, longitude: nil)
          .select(:id, :name, :address, :latitude, :longitude, :tags, :button_link)
          .map { |s|
            {
              id: s.id,
              name: s.name,
              address: s.address,
              lat: s.latitude,      # ← le front attend lat/lng (pas latitude/longitude)
              lng: s.longitude,
              tags: s.tags,
              button_link: s.button_link
            }
          }
      end
    end
  end
end
