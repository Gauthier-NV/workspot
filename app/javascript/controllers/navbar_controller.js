import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.shrunk = false;
    window.addEventListener("scroll", this.handleScroll);
  }

  disconnect() {
    window.removeEventListener("scroll", this.handleScroll);
  }

  handleScroll = () => {
    const shouldShrink = window.scrollY > 10;

    if (shouldShrink && !this.shrunk) {
      this.element.classList.add("shrink");
      this.shrunk = true;
    } else if (!shouldShrink && this.shrunk) {
      this.element.classList.remove("shrink");
      this.shrunk = false;
    }
  }
}
