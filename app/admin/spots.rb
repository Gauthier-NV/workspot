ActiveAdmin.register Spot do
  menu label: "Spots"

  permit_params :name, :address, :arrondissement, :description,
                :has_wifi, :has_power_outlets, :latitude, :longitude,
                :image_url, :button_link,
                tags_list: []

  # --- Filtres Ransack explicites ---
  filter :name
  filter :address
  filter :arrondissement
  filter :has_wifi
  filter :has_power_outlets
  filter :created_at

  # Filtre par un seul tag (utilise le scope ransackable :tagged_with)
  filter :tagged_with,
         as: :select,
         collection: Spot::TAGS.map { |t| [t.tr("_", " ").capitalize, t] },
         label: "Tag"

  # OU, filtre par plusieurs tags (renvoie les spots ayant l’un des tags choisis)
  # filter :tagged_any,
  #        as: :check_boxes,
  #        collection: Spot::TAGS.map { |t| [t.tr("_", " ").capitalize, t] },
  #        label: "Tags (au moins un)"

  index do
    selectable_column
    id_column
    column :name
    column :address
    column :arrondissement
    column("Tags") { |s| s.tags_list.join(" · ") }
    column :button_link
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
      f.input :button_link, label: "Button Link (URL)"
      f.input :has_wifi, label: "Wi-Fi disponible"
      f.input :has_power_outlets, label: "Prises électriques"
      f.input :latitude
      f.input :longitude
      f.input :image_url, label: "URL de l'image"
      f.input :tags_list, as: :check_boxes, label: "Tags",
              collection: Spot::TAGS.map { |t| [t.tr("_", " ").capitalize, t] }
    end
    f.actions
  end
end
