const groups = Array.from(document.querySelectorAll(".menu-group"));
const dashboardButton = document.querySelector('[data-section="dashboard"]');

groups.forEach((group) => {
  const trigger = group.querySelector(".menu-card--collapsible");
  trigger.addEventListener("click", () => {
    const isOpen = group.classList.contains("is-open");

    groups.forEach((item) => {
      item.classList.remove("is-open");
      item.querySelector(".menu-card--collapsible")?.setAttribute("aria-expanded", "false");
    });

    dashboardButton.classList.remove("is-active");

    if (!isOpen) {
      group.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
    }
  });
});

dashboardButton.addEventListener("click", () => {
  dashboardButton.classList.add("is-active");
  groups.forEach((group) => {
    group.classList.remove("is-open");
    group.querySelector(".menu-card--collapsible")?.setAttribute("aria-expanded", "false");
  });
});
