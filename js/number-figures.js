// Figure numbers for the Portfolio's image rows. They run continuously through a
// project (every section marked .project-start begins a new count) and each
// caption takes the number of the image it belongs to.
//
// Done here, before the pages are built, rather than with CSS counters: Paged.js
// cuts the book into separate page boxes, and a CSS counter does not carry from
// one box to the next, so every page would start again at 1. The number is stored
// as data-fig and drawn by css/base.css (content: attr(data-fig)).
export function numberFigures(root) {
  let n = 0;
  root.querySelectorAll('section').forEach((sec) => {
    if (sec.classList.contains('project-start')) n = 0;
    const figs = sec.querySelectorAll('.plate-figs .fig');
    if (!figs.length) return;
    const nums = [];
    figs.forEach((fig) => { n += 1; fig.dataset.fig = n; nums.push(n); });
    sec.querySelectorAll('.plate-captions li').forEach((li, i) => {
      if (nums[i]) li.dataset.fig = nums[i];
    });
  });
}
