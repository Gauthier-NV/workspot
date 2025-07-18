# frozen_string_literal: true
ActiveAdmin.register_page "Dashboard" do
  menu priority: 1, label: proc { I18n.t("active_admin.dashboard") }

  content title: proc { I18n.t("active_admin.dashboard") } do
    div class: "blank_slate_container", id: "dashboard_default_message" do
      span class: "blank_slate" do
        span I18n.t("active_admin.dashboard_welcome.welcome")
        small I18n.t("active_admin.dashboard_welcome.call_to_action")
      end
    end


    # -------- content for the dashboard -------- !!

  columns do

        column do
          panel "Derniers bars ajoutés" do
            ul do
              Bar.order(created_at: :desc).limit(5).map do |bar|
                li link_to(bar.name, admin_bar_path(bar))
              end
            end
          end
        end


        column do
          panel "Statistiques rapides" do
            para "Nombre total de bars : #{Bar.count}"
            para "Avec Wi-Fi : #{Bar.where(has_wifi: true).count}"
            para "Avec prises électriques : #{Bar.where(has_power_outlets: true).count}"
          end
        end
      end

  end
end
