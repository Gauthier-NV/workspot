class AddTagsToSpots < ActiveRecord::Migration[7.1]
  def change
    add_column :spots, :tags, :text
  end
end
