import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static values = { count: Number }

  connect() {
    const n = this.countValue || 0
    const label = n === 1 ? "CAFÉ SÉLECTIONNÉ" : "CAFÉS SÉLECTIONNÉS"
    this.element.textContent = `NOS ${n} ${label} POUR VOUS :`
  }
}
