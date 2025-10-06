// app/javascript/application.js

// Import Turbo et Stimulus (via importmap)
import "@hotwired/turbo-rails"
import { Application } from "@hotwired/stimulus"
import "controllers"

// Lance l'application Stimulus
const application = Application.start()

// Configure Stimulus pour le dev
application.debug = false
window.Stimulus = application

export { application }
