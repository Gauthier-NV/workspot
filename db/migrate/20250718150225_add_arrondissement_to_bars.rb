class AddArrondissementToBars < ActiveRecord::Migration[7.1]
  def change
    add_column :bars, :arrondissement, :string
  end
end
