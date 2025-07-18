class Bar < ApplicationRecord
  def self.ransackable_attributes(_auth_object = nil)
    %w[
      name address arrondissement description
      has_wifi has_power_outlets latitude longitude image_url
      created_at updated_at id
    ]
  end
end
