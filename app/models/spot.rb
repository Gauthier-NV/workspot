class Spot < ApplicationRecord
  TAGS = %w[lumineux service_continu team_friendly silencieux comfortable].freeze

  # URL propre
  validates :button_link, format: URI::DEFAULT_PARSER.make_regexp(%w[http https]), allow_blank: true

  # Helpers tags (stockés en CSV dans la colonne :tags)
  def tags_list
    return [] if tags.blank?
    tags.split(",").map { |t| normalize_tag(t) }.select { |t| TAGS.include?(t) }.uniq
  end

  def tags_list=(arr)
    normalized = Array(arr).map { |t| normalize_tag(t) }.select { |t| TAGS.include?(t) }.uniq
    self.tags = normalized.join(",")
  end

  def has_tag?(slug) = tags_list.include?(normalize_tag(slug))

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
