ActiveAdmin.register Spot do
  menu label: "Spots" # optionnel, sinon AA affichera "Spots" par défaut

  permit_params :name, :address, :arrondissement, :description,
                :has_wifi, :has_power_outlets, :latitude, :longitude, :image_url

  controller do
    before_action :authorize_ceo!

    private

    def authorize_ceo!
      unless current_admin_user&.email == "admin@workspots.fr"
        redirect_to root_path, alert: "Accès réservé."
      end
    end
  end

  index do
    selectable_column
    id_column
    column :name
    column :address
    column :arrondissement
    column :has_wifi
    column :has_power_outlets
    actions
  end

  filter :name
  filter :address
  filter :arrondissement
  filter :has_wifi
  filter :has_power_outlets

  form do |f|
    f.inputs "Informations générales" do
      f.input :name
      f.input :address
      f.input :arrondissement
      f.input :description
      f.input :has_wifi, label: "Wi-Fi disponible"
      f.input :has_power_outlets, label: "Prises électriques"
      f.input :latitude
      f.input :longitude
      f.input :image_url, label: "URL de l'image"
    end
    f.actions
  end
end
