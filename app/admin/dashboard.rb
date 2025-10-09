# frozen_string_literal: true
ActiveAdmin.register_page "Dashboard" do
  menu priority: 1, label: proc { I18n.t("active_admin.dashboard") }

  content title: proc { I18n.t("active_admin.dashboard") } do
    # Message d'accueil par défaut
    div class: "blank_slate_container", id: "dashboard_default_message" do
      span class: "blank_slate" do
        span I18n.t("active_admin.dashboard_welcome.welcome")
        small I18n.t("active_admin.dashboard_welcome.call_to_action")
      end
    end

    # ====== Ligne 1 : Derniers spots / Stats rapides / KPI Likes ======
    columns do
      column do
        panel "Derniers spots ajoutés" do
          ul do
            Spot.order(created_at: :desc).limit(5).map do |spot|
              li link_to(spot.name, admin_spot_path(spot))
            end
          end
        end
      end

      column do
        panel "Statistiques rapides" do
          para "Nombre total de Spots : #{Spot.count}"
          para "Avec Wi-Fi : #{Spot.where(has_wifi: true).count}"
          para "Avec prises électriques : #{Spot.where(has_power_outlets: true).count}"
        end
      end

      column do
        panel "KPI Likes" do
          # Sécurise au cas où Like n'existerait pas encore en dev
          if defined?(Like)
            total_likes    = Like.count
            unique_visitors= Like.select(:visitor_id).distinct.count
            top_spot       = Spot.order(likes_count: :desc).first

            para "Total likes : #{total_likes}"
            para "Visiteurs uniques (ayant liké) : #{unique_visitors}"
            if top_spot
              para do
                "Top spot : ".html_safe +
                link_to("##{top_spot.id} #{top_spot.name}", admin_spot_path(top_spot)) +
                " — #{top_spot.likes_count} ❤️"
              end
            end
          else
            status_tag "Le modèle Like n'est pas encore disponible", :warning
          end
        end
      end
    end

    # ====== Ligne 2 : Top 10 populaires / Likes par jour (14j) ======
    columns do
      column do
        panel "Top 10 spots (par likes)" do
          if Spot.column_names.include?("likes_count")
            table_for Spot.order(likes_count: :desc).limit(10) do
              column(:id)        { |s| link_to s.id, admin_spot_path(s) }
              column(:name)      { |s| link_to s.name, admin_spot_path(s) }
              column("Likes")    { |s| s.likes_count }
              column(:created_at)
            end
          else
            status_tag "Colonne likes_count manquante (migration non appliquée ?)", :error
          end
        end
      end

      column do
        panel "Likes par jour (14 derniers jours)" do
          if defined?(Like)
            rows = Like.where("created_at >= ?", 14.days.ago.beginning_of_day)
                       .group("DATE(created_at)")
                       .order("DATE(created_at)")
                       .count
            if rows.any?
              table_for rows do
                column("Date")  { |(d, _)| d }
                column("Likes") { |(_, c)| c }
              end
            else
              em "Aucun like sur la période."
            end
          else
            status_tag "Le modèle Like n'est pas encore disponible", :warning
          end
        end
      end
    end

    # ====== Ligne 3 : Maintenance rapide ======
    columns do
      column do
        panel "Maintenance likes_count" do
          para "Si les compteurs semblent désynchronisés (import, seed, etc.), vous pouvez les recalculer depuis la page du spot (action 'Recalculer likes_count') ou via la batch action dans l'index des spots."
          para do
            link_to "Aller à la liste des spots", admin_spots_path, class: "button"
          end
        end
      end
    end
  end
end
