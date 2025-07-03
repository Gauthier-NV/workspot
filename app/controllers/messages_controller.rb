class MessagesController < ApplicationController
  def new
    @message = Message.new
  end

  def create
    @message = Message.new(message_params)
    if @message.save
      # Envoie l’email après sauvegarde
      MessageMailer.new_message(@message).deliver_now
      flash[:notice] = "L'équipe Workspot vous remercie !"
      redirect_to root_path
    else
      flash[:alert] = "Une erreur est survenue. Merci de vérifier votre formulaire."
      redirect_to root_path # au cas où la validation échoue
    end
  end

  private

  def message_params
    params.require(:message).permit(:name, :email, :establishment, :address, :role, :content)

  end
end
