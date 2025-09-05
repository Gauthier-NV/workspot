// app/javascript/controllers/navbar_controller.js
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.shrunk = false

    // shrink uniquement sur desktop
    if (window.innerWidth > 768) {
      window.addEventListener("scroll", this.handleScroll)
    }

    // hide sur la bannière About Us (mobile + desktop)
    const about = document.querySelector(".banner.about-banner")
    if (about) {
      this.observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          this.element.classList.add("is-hidden")
        } else {
          this.element.classList.remove("is-hidden")
        }
      }, { threshold: 0.7 }) // 0.5 = moitié visible → navbar cachée
      this.observer.observe(about)
    }
  }

  disconnect() {
    window.removeEventListener("scroll", this.handleScroll)
    if (this.observer) this.observer.disconnect()
  }

  handleScroll = () => {
    const shouldShrink = window.scrollY > 3
    if (shouldShrink && !this.shrunk) {
      this.element.classList.add("shrink")
      this.shrunk = true
    } else if (!shouldShrink && this.shrunk) {
      this.element.classList.remove("shrink")
      this.shrunk = false
    }
  }
}
