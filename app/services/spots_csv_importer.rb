# frozen_string_literal: true
require "csv"

class SpotsCsvImporter
  Result = Struct.new(:created, :updated, :skipped)

  def initialize(path)
    @path = path
  end

  def call
    created = updated = skipped = 0

    CSV.foreach(@path, headers: true) do |row|
      h = normalize_headers(row.to_h) # "Button Link" -> "button_link"

      name  = strip_or_nil(h["name"])
      addr  = strip_or_nil(h["address"])
      lat   = to_f_or_nil(h["latitude"])
      lng   = to_f_or_nil(h["longitude"])
      notes = strip_or_nil(h["notes"])
      link  = strip_or_nil(h["button_link"])
      tags_text = strip_or_nil(h["tags"]) # texte brut du CSV ("wifi, prises, team-friendly")

      next skipped += 1 if name.nil? || addr.nil?

      normalized_tags = normalize_and_filter_tags(tags_text)

      attrs = {
        name:         name,
        address:      addr,
        latitude:     lat,
        longitude:    lng,
        description:  notes,                               # Notes -> description
        arrondissement: extract_arrondissement(addr),      # "75011" etc.
        button_link:  link,                                # Button Link -> button_link
        tags:         normalized_tags.join(",")            # tags normalisés (CSV string)
      }.compact

      # Bonus: déduire booleans s'ils sont mentionnés dans Tags (sans écraser si absent)
      if tags_text
        attrs[:has_wifi]          = true if tags_text.match?(/wi-?fi|wifi/i)
        attrs[:has_power_outlets] = true if tags_text.match?(/prise|outlet|power/i)
      end

      # Ne garder que les colonnes existantes en DB
      attrs.select! { |k,_| Spot.column_names.include?(k.to_s) }

      if (spot = Spot.find_by(name: name, address: addr))
        spot.update!(attrs)
        updated += 1
      else
        Spot.create!(attrs)
        created += 1
      end
    rescue => e
      skipped += 1
      Rails.logger.warn "CSV line skipped: #{e.class} - #{e.message}"
    end

    Result.new(created, updated, skipped)
  end

  private

  def normalize_headers(hash)
    hash.transform_keys { |k| k.to_s.strip.downcase.gsub(/[^a-z0-9]+/, "_") }
  end

  def strip_or_nil(v)
    s = v.to_s.strip
    s.empty? ? nil : s
  end

  def to_f_or_nil(v)
    return nil if v.nil?
    s = v.to_s.strip
    return nil if s.empty?
    s = s.tr(",", ".")
    Float(s)
  rescue ArgumentError
    nil
  end

  # Normalise le texte "Tags" CSV en slugs contrôlés (Spot::TAGS)
  def normalize_and_filter_tags(tags_text)
    return [] if tags_text.nil?
    list = tags_text.split(/[,;]| \/ /).map(&:strip).reject(&:empty?)
    slugs = list.map { |t| t.downcase.tr("’'", "").gsub(/[\s-]+/, "_") }
    if Spot.const_defined?(:TAGS)
      slugs.select { |t| Spot::TAGS.include?(t) }.uniq
    else
      slugs.uniq
    end
  end

  def extract_arrondissement(address)
    return nil if address.nil?
    (m = address.match(/75\s*0?(\d{2})/i)) ? "750#{m[1]}" : nil
  end
end
