class AddLikesCountToSpots < ActiveRecord::Migration[7.1]
  def change
    add_column :spots, :likes_count, :integer, default: 0, null: false
    add_index  :spots, :likes_count
  end
end
