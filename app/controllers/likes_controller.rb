class LikesController < ApplicationController
  before_action :set_spot, only: [:create, :destroy]

  def index
    vid = cookies.signed[:visitor_id]
    render json: { spot_ids: Like.where(visitor_id: vid).pluck(:spot_id) }
  end

  def create
    vid = cookies.signed[:visitor_id]
    begin
      @spot.likes.create!(visitor_id: vid)
    rescue ActiveRecord::RecordNotUnique
      # déjà liké : OK
    end
    render json: { likes_count: @spot.reload.likes_count }, status: :ok
  end

  def destroy
    vid = cookies.signed[:visitor_id]
    @spot.likes.find_by(visitor_id: vid)&.destroy
    render json: { likes_count: @spot.reload.likes_count }, status: :ok
  end

  private

  def set_spot
    @spot = Spot.find(params[:spot_id])
  end
end
