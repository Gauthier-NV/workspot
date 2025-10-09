class Like < ApplicationRecord
  belongs_to :spot, counter_cache: true
  validates :visitor_id, presence: true
  validates :visitor_id, uniqueness: { scope: :spot_id }
end
