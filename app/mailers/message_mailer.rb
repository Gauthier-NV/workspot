class MessageMailer < ApplicationMailer
  default from: ENV['INFOMANIAK_EMAIL']

  def new_message(message)
    @message = message
    mail(
      to: ENV['INFOMANIAK_EMAIL'],
      from: "#{@message.name} <#{ENV['INFOMANIAK_EMAIL']}>",
      reply_to: @message.email,
      subject: "📩 Nouveau message via Workspot"
    )
  end
end
