class CreateBars < ActiveRecord::Migration[7.1]
  def change
    create_table :bars do |t|
      t.string :name
      t.string :address
      t.text :description
      t.boolean :has_wifi
      t.boolean :has_power_outlets
      t.float :latitude
      t.float :longitude

      t.timestamps
    end
  end
end
