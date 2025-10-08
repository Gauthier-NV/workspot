require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.enable_reloading = false
  config.eager_load = true

  config.consider_all_requests_local = false
  config.action_controller.perform_caching = true

  # Servir les statiques sur Heroku + cache long
  config.public_file_server.enabled = ENV['RAILS_SERVE_STATIC_FILES'].present?
  config.public_file_server.headers = {
    'Cache-Control' => 'public, max-age=31536000, immutable',
    'Expires' => 1.year.from_now.httpdate
  }

  # Pipeline d’assets
  # config.assets.css_compressor = :sass
  config.assets.compile = false
  config.assets.gzip = true

  # Stockage
  config.active_storage.service = :local

  # Logs
  config.logger = ActiveSupport::TaggedLogging.new(
    ActiveSupport::Logger.new(STDOUT).tap { |l| l.formatter = ::Logger::Formatter.new }
  )
  config.log_tags = [ :request_id ]
  config.log_level = ENV.fetch("RAILS_LOG_LEVEL", "info")

  config.action_mailer.perform_caching = false

  config.i18n.fallbacks = true
  config.active_support.report_deprecations = false
  config.active_record.dump_schema_after_migration = false

  # Mailer (Infomaniak)
  config.action_mailer.delivery_method = :smtp
  config.action_mailer.raise_delivery_errors = true
  config.action_mailer.smtp_settings = {
    address:              'mail.infomaniak.com',
    port:                 587,
    domain:               'workspots.fr',
    user_name:            ENV['INFOMANIAK_EMAIL'],
    password:             ENV['INFOMANIAK_PASSWORD'],
    authentication:       'plain',
    enable_starttls_auto: true
  }
  config.action_mailer.default_url_options = { host: 'www.workspots.fr', protocol: 'https' }

  # SSL
  config.force_ssl = true
  # config.assume_ssl = true # (inutile sur Heroku, tu peux laisser commenté)

  # 🔧 Compression Gzip (indispensable sur Heroku)
  # placé après ActionDispatch::Static pour compresser aussi les fichiers statiques
  config.middleware.insert_after ActionDispatch::Static, Rack::Deflater
end
