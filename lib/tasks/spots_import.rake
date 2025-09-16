namespace :workspots do
  desc "Import CSV vers Spot : bin/rails workspots:import_spots[/chemin/fichier.csv]"
  task :import_spots, [:path] => :environment do |_, args|
    path = args[:path] or abort "→ Fournis le chemin du CSV (ex: tmp/spots.csv)"
    abort "→ Fichier introuvable: #{path}" unless File.exist?(path)

    result = SpotsCsvImporter.new(path).call
    puts "Import — Créés: #{result.created}, MAJ: #{result.updated}, Ignorés: #{result.skipped}"
  end
end
