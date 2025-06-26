class MessageMailer < ApplicationMailer
  default to: "gauthier.nouveau@gmail.com"

  def new_message(message)
    @message = message
    mail(
      from: "\"Workspot\" <#{ENV["GMAIL_USERNAME"]}>",
      reply_to: @message.email,
      subject: "📥 Nouveau message reçu via Workspot"
    )
  end


end
