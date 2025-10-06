import { Application } from "@hotwired/stimulus"
import { lazyLoadControllersFrom } from "@hotwired/stimulus-loading"

const application = Application.start()
application.debug = false
window.Stimulus = application

// Charge chaque contrôleur seulement s’il est présent dans le DOM
lazyLoadControllersFrom("controllers", application)
