class AddEmailToMessages < ActiveRecord::Migration[7.1]
  def change
    add_column :messages, :email, :string
  end
end
