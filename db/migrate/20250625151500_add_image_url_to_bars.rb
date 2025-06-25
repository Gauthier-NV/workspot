class AddImageUrlToBars < ActiveRecord::Migration[7.1]
  def change
    add_column :bars, :image_url, :string
  end
end
