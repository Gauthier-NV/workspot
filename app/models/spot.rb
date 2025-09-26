class Spot < ApplicationRecord
  TAGS = %w[lumineux service_continu team_friendly silencieux comfortable].freeze

  # --- Ransack allow-list ---
  def self.ransackable_attributes(_auth_object = nil)
    %w[
      id name description address arrondissement
      has_wifi has_power_outlets
      latitude longitude image_url image_url1 image_url2 image_url3 button_link
      tags created_at updated_at
    ]
  end

  # --- Validation URL (bouton) ---
  validates :button_link, format: URI::DEFAULT_PARSER.make_regexp(%w[http https]), allow_blank: true

  # --- Validation URLs images (optionnel mais utile) ---
  validates :image_url1, :image_url2, :image_url3,
           format: URI::DEFAULT_PARSER.make_regexp(%w[http https]),
           allow_blank: true

  # --- Helper photos: retourne max 3 URLs valides ---
  def image_urls
    [image_url1, image_url2, image_url3, image_url].compact_blank.uniq.first(3)
  end

  def self.ransackable_associations(_auth_object = nil)
    []
  end

  # Expose tes scopes à Ransack (pour pouvoir faire q[tagged_with]=..., q[tagged_any][]=...)
  def self.ransackable_scopes(_auth_object = nil)
    %i[tagged_with tagged_any]
  end

  # --- Validation URL ---
  validates :button_link, format: URI::DEFAULT_PARSER.make_regexp(%w[http https]), allow_blank: true

  # --- Helpers tags (stockage CSV dans :tags) ---
  def tags_list
    return [] if tags.blank?
    tags.split(",").map { |t| normalize_tag(t) }.select { |t| TAGS.include?(t) }.uniq
  end

  def tags_list=(arr)
    normalized = Array(arr).map { |t| normalize_tag(t) }.select { |t| TAGS.include?(t) }.uniq
    self.tags = normalized.join(",")
  end

  def has_tag?(slug) = tags_list.include?(normalize_tag(slug))

  # --- Scopes utilisables par Ransack ---
  scope :tagged_with, ->(tag) {
    t = tag.to_s.strip.downcase.gsub(/[\s-]+/, "_")
    where("(',' || tags || ',') LIKE ?", "%,#{t},%")
  }

  scope :tagged_any, ->(tag_list) {
    ts = Array(tag_list).map { |t| t.to_s.strip.downcase.gsub(/[\s-]+/, "_") }.uniq
    ts.empty? ? all : where(ts.map { "(',' || tags || ',') LIKE ?" }.join(" OR "), *ts.map { |t| "%,#{t},%" })
  }

  private

  def normalize_tag(t) = t.to_s.strip.downcase.gsub(/[\s-]+/, "_")
end
