document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const appWindow = document.getElementById('app-window');
  const tabs = document.querySelectorAll('.tab-item');
  const contentArea = document.querySelector('.content-area');
  const btnReset = document.getElementById('btn-reset');
  const btnScrollTop = document.getElementById('btn-scroll-top');
  const contentTabTitle = document.getElementById('content-tab-title');
  const segmentBtns = document.querySelectorAll('.segment-btn');

  // Header Window Control Capsule Actions
  const btnMinimize = document.getElementById('btn-minimize');
  const btnExpand = document.getElementById('btn-expand');
  const btnClose = document.getElementById('btn-close');

  if (btnMinimize) {
    btnMinimize.addEventListener('click', () => {
      appWindow.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      appWindow.style.transform = 'scale(0.85) translateY(40px)';
      appWindow.style.opacity = '0.4';
      setTimeout(() => {
        appWindow.style.transform = 'none';
        appWindow.style.opacity = '1';
      }, 1000);
    });
  }

  if (btnExpand) {
    btnExpand.addEventListener('click', () => {
      appWindow.classList.toggle('maximized');
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      appWindow.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      appWindow.style.opacity = '0';
      appWindow.style.transform = 'scale(0.95)';
      setTimeout(() => {
        appWindow.style.opacity = '1';
        appWindow.style.transform = 'none';
      }, 1200);
    });
  }

  // Segmented Control Button Click Handler (excluding window controls)
  segmentBtns.forEach(btn => {
    if (!btn.classList.contains('btn-minimize') && 
        !btn.classList.contains('btn-expand') && 
        !btn.classList.contains('btn-close')) {
      btn.addEventListener('click', () => {
        // Toggle active status within functional segment control group
        const group = btn.closest('.liquid-segmented-control');
        if (group && !group.classList.contains('window-controls-segment')) {
          group.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        }
      });
    }
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

    // Reset functional segment control to first item
    const functionalSegment = document.querySelector('.liquid-segmented-control:not(.window-controls-segment)');
    if (functionalSegment) {
      const fBtns = functionalSegment.querySelectorAll('.segment-btn');
      fBtns.forEach(b => b.classList.remove('active'));
      if (fBtns.length > 0) fBtns[0].classList.add('active');
    }
  });
});
