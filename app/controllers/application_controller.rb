class ApplicationController < ActionController::Base
before_action :no_store_for_html

private
def no_store_for_html
  return unless request.format.html?
  response.headers['Cache-Control'] = 'no-store'
end
end
