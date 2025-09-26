class AddMultiImageUrlsToSpots < ActiveRecord::Migration[7.1]
  def change
    add_column :spots, :image_url1, :string
    add_column :spots, :image_url2, :string
    add_column :spots, :image_url3, :string
  end

  def data
    # (facultatif) si tu veux migrer l’ancienne colonne dans image_url1
    Spot.reset_column_information
    Spot.find_each do |s|
      s.update_columns(image_url1: s.image_url) if s.image_url.present? && s.image_url1.blank?
    end
  end
end
