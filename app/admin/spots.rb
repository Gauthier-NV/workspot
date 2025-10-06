# app/admin/spots.rb (ou le fichier où tu déclares Spot)
ActiveAdmin.register Spot do
  permit_params :name, :address, :description, :has_wifi, :has_power_outlets,
                :latitude, :longitude, :arrondissement, :button_link, :tags,
                :image_url, :image_url1, :image_url2, :image_url3

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

  show do
    attributes_table do
      row :name
      row :address
      row :description
      row :button_link
      row :tags
      row "Prévisualisation" do |spot|
        safe_join(
          spot.image_urls.map { |u| image_tag(u, style: "max-width:160px; margin-right:8px; border-radius:8px;") }
        )
      end
    end
  end
end
