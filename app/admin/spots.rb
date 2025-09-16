ActiveAdmin.register Spot do
  menu label: "Spots"

  permit_params :name, :address, :arrondissement, :description,
                :has_wifi, :has_power_outlets, :latitude, :longitude,
                :image_url, :button_link,               # ← ajout
                tags_list: []                           # ← ajout (champ virtuel)

  index do
    selectable_column
    id_column
    column :name
    column :address
    column :arrondissement
    column("Tags") { |s| s.tags_list.join(" · ") }      # ← ajout
    column :button_link                                 # ← ajout
    column :has_wifi
    column :has_power_outlets
    actions
  end

  form do |f|
    f.inputs "Informations générales" do
      f.input :name
      f.input :address
      f.input :arrondissement
      f.input :description
      f.input :button_link, label: "Button Link (URL)"  # ← ajout
      f.input :has_wifi, label: "Wi-Fi disponible"
      f.input :has_power_outlets, label: "Prises électriques"
      f.input :latitude
      f.input :longitude
      f.input :image_url, label: "URL de l'image"

      f.input :tags_list, as: :check_boxes, label: "Tags",  # ← ajout
              collection: Spot::TAGS.map { |t| [t.tr("_", " ").capitalize, t] }
    end
    f.actions
  end
end
