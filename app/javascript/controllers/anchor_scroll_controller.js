import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    // Gère les clics sur les liens avec ancre
    document.querySelectorAll("a[href^='#']").forEach(link => {
      link.addEventListener("click", this.handleAnchorClick)
    })

    // Si l'URL contient une ancre au chargement (ex: /#contact)
    if (window.location.hash) {
      setTimeout(() => {
        this.scrollToAnchor(window.location.hash)
      }, 100) // attend un peu que le shrink s'applique
    }
  }

  disconnect() {
    document.querySelectorAll("a[href^='#']").forEach(link => {
      link.removeEventListener("click", this.handleAnchorClick)
    })
  }

  handleAnchorClick = (event) => {
    const targetId = event.currentTarget.getAttribute("href")
    const targetElement = document.querySelector(targetId)

    if (targetElement) {
      event.preventDefault()
      this.scrollToAnchor(targetId)
      history.replaceState(null, null, targetId)
    }
  }

  scrollToAnchor(id) {
    const element = document.querySelector(id)
    const navbar = document.querySelector(".navbar-workspot")
    if (!element || !navbar) return

    const navbarHeight = navbar.offsetHeight
    const elementPosition = element.getBoundingClientRect().top + window.scrollY
    const offset = 10 // espace de respiration

    const finalScrollPosition = elementPosition - navbarHeight - offset

    window.scrollTo({
      top: finalScrollPosition,
      behavior: "smooth"
    })
  }
}
