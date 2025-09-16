class AddButtonLinkToSpots < ActiveRecord::Migration[7.1]
  def change
    add_column :spots, :button_link, :string
  end
end
