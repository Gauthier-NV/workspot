class MessagesController < ApplicationController
  def new
    @message = Message.new
  end

  def create
    @message = Message.new(message_params)
    if @message.save
      # Envoie l’email après sauvegarde
      MessageMailer.new_message(@message).deliver_now
      redirect_to root_path, notice: "L'équipe Workspot vous remercie pour votre message !"
    else
      redirect_to root_path, alert: "Une erreur est survenue."
    end
  end

  private

  def message_params
    params.require(:message).permit(:name, :email, :establishment, :address, :role, :content)

  end
end
