document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const tabs = document.querySelectorAll('.tab-item');
  const contentArea = document.querySelector('.content-area');
  const btnReset = document.getElementById('btn-reset');
  const btnScrollTop = document.getElementById('btn-scroll-top');
  const contentTabTitle = document.getElementById('content-tab-title');
  const segmentBtns = document.querySelectorAll('.segment-btn');

  // Segmented Control Button Click Handler
  segmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active status within segment control group
      segmentBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Tab switching logic (Title is updated inside the content area)
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabName = tab.querySelector('span').textContent;
      if (contentTabTitle) {
        contentTabTitle.textContent = tabName;
      }

      // Scroll smoothly back to top when tab changes
      contentArea.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  });

  // Scroll to Top functionality
  btnScrollTop.addEventListener('click', () => {
    contentArea.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });

  // Reset functionality
  btnReset.addEventListener('click', () => {
    // Reset Scroll Position
    contentArea.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    // Reset Active Tab to first tab
    tabs.forEach(t => t.classList.remove('active'));
    if (tabs.length > 0) {
      tabs[0].classList.add('active');
      const tabName = tabs[0].querySelector('span').textContent;
      if (contentTabTitle) {
        contentTabTitle.textContent = tabName;
      }
    }

    // Reset segment control to first item
    segmentBtns.forEach(b => b.classList.remove('active'));
    if (segmentBtns.length > 0) {
      segmentBtns[0].classList.add('active');
    }
  });
});
