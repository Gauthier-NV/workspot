class CreateMessages < ActiveRecord::Migration[7.1]
  def change
    create_table :messages do |t|
      t.string :name
      t.string :establishment
      t.string :address
      t.string :role
      t.text :content

      t.timestamps
    end
  end
end
