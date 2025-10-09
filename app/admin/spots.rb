ActiveAdmin.register Spot do
  # --- Autorisations d'édition ---
  # On NE permet PAS d'éditer likes_count à la main (c’est un counter cache)
  permit_params :name, :address, :description, :has_wifi, :has_power_outlets,
                :latitude, :longitude, :arrondissement, :button_link, :tags,
                :image_url, :image_url1, :image_url2, :image_url3

  # --- Scopes utiles ---
  scope :all, default: true
  scope("Top likés") { |s| s.order(likes_count: :desc) }

  # --- Filtres (Ransack) ---
  # Assure-toi que likes_count est bien exposé côté modèle (ransackable_attributes)
  filter :name
  filter :arrondissement
  filter :has_wifi
  filter :has_power_outlets
  filter :likes_count
  filter :created_at

  # --- Index (liste) ---
  index do
    selectable_column
    id_column
    column :name
    column :arrondissement
    column :has_wifi
    column :has_power_outlets
    column("Likes", :likes_count)   # triable si :likes_count est ransackable dans Spot
    actions
  end

  # --- Show (fiche) ---
  show do
    attributes_table do
      row :id
      row :name
      row :address
      row :description
      row :arrondissement
      row :has_wifi
      row :has_power_outlets
      row :button_link
      row :tags
      row("Likes") { |spot| spot.likes_count }

      row "Prévisualisation" do |spot|
        safe_join(
          spot.image_urls.map { |u| image_tag(u, style: "max-width:160px; margin-right:8px; border-radius:8px;") }
        )
      end
    end
    active_admin_comments
  end

  # --- Formulaire ---
  form do |f|
    f.inputs "Infos Spot" do
      f.input :name
      f.input :address
      f.input :description
      f.input :arrondissement
      f.input :has_wifi
      f.input :has_power_outlets
      f.input :button_link
      f.input :latitude
      f.input :longitude
      f.input :tags, hint: "Ex: lumineux, silencieux..."
    end

    f.inputs "Photos (3 max — URLs)" do
      f.input :image_url1, placeholder: "https://.../photo1.jpg"
      f.input :image_url2, placeholder: "https://.../photo2.jpg"
      f.input :image_url3, placeholder: "https://.../photo3.jpg"
    end
    f.actions
  end

  # --- Actions de maintenance (optionnelles) ---
  # Bouton pour recalculer le counter cache si besoin
  action_item :recount_likes, only: :show do
    link_to "Recalculer likes_count", recount_likes_admin_spot_path(resource), method: :post
  end

  member_action :recount_likes, method: :post do
    Spot.reset_counters(resource.id, :likes)
    redirect_to resource_path, notice: "likes_count recalculé."
  end

  # Recalcul en masse depuis l’index
  batch_action :recount_likes_counters do |ids|
    Spot.where(id: ids).find_each { |s| Spot.reset_counters(s.id, :likes) }
    redirect_to collection_path, notice: "likes_count recalculé pour #{ids.size} spot(s)."
  end

  # --- Export CSV (avec likes_count) ---
  csv do
    column :id
    column :name
    column :arrondissement
    column(:likes) { |s| s.likes_count }
    column :created_at
    column :updated_at
  end
end
