import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    window.addEventListener("scroll", this.handleScroll.bind(this));
  }

  disconnect() {
    window.removeEventListener("scroll", this.handleScroll.bind(this));
  }

  handleScroll() {
    if (window.scrollY > 50) {
      this.element.classList.add("shrink");
    } else {
      this.element.classList.remove("shrink");
    }
  }

  handleScroll() {
  console.log("scroll position:", window.scrollY)

  }
}
