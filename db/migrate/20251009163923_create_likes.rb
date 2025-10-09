class CreateLikes < ActiveRecord::Migration[7.1]
  def change
    create_table :likes do |t|
      t.references :spot, null: false, foreign_key: true
      t.string :visitor_id, null: false
      t.timestamps
    end

    add_index :likes, [:spot_id, :visitor_id], unique: true, name: "idx_unique_likes_spot_visitor"
    add_index :likes, :visitor_id
  end
end
