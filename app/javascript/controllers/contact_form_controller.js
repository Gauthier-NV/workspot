// app/javascript/controllers/contact_form_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["textarea", "counter", "fileInput", "fileName"]

  connect() {
    this.t0 = performance.now?.() || Date.now()
    this.setHidden("msg_current_url", window.location.href)
    this.setHidden("msg_referrer", document.referrer || "")
    this.setHidden("msg_ua", navigator.userAgent)
    this.setHidden("msg_vw", window.innerWidth)
    this.setHidden("msg_vh", window.innerHeight)
  }

  submit() {
    const ms = (performance.now?.() || Date.now()) - this.t0
    this.setHidden("msg_submit_ms", Math.round(ms))
  }

  updateCount() {
    if (this.hasTextareaTarget && this.hasCounterTarget) {
      this.counterTarget.textContent = this.textareaTarget.value.length
    }
  }

  showFileName() {
    if (this.hasFileInputTarget && this.hasFileNameTarget) {
      this.fileNameTarget.textContent = this.fileInputTarget.files?.[0]?.name || ""
    }
  }

  setHidden(id, value) {
    const el = document.getElementById(id)
    if (el) el.value = value
  }
}
