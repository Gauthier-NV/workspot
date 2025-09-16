class RenameBarsToSpots < ActiveRecord::Migration[7.1]
  def change
    rename_table :bars, :spots
  end
end
