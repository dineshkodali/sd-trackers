/**
 * SDTracker Pitch Deck — Interactive Presentation Engine
 */

(function () {
  let currentSlideIndex = 0;
  const slides = document.querySelectorAll('.slide');
  const totalSlides = slides.length;

  const counterEl = document.getElementById('hud-counter');
  const progressFill = document.getElementById('progress-fill');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const overviewBtn = document.getElementById('overview-btn');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const printBtn = document.getElementById('print-btn');
  const overviewModal = document.getElementById('overview-modal');
  const closeOverviewBtn = document.getElementById('close-overview');
  const overviewGrid = document.getElementById('overview-grid');

  function updateSlide(index) {
    if (index < 0) index = 0;
    if (index >= totalSlides) index = totalSlides - 1;

    currentSlideIndex = index;

    slides.forEach((slide, idx) => {
      slide.classList.remove('active', 'prev');
      if (idx === currentSlideIndex) {
        slide.classList.add('active');
      } else if (idx < currentSlideIndex) {
        slide.classList.add('prev');
      }
    });

    if (counterEl) {
      counterEl.textContent = `${currentSlideIndex + 1} / ${totalSlides}`;
    }

    if (progressFill) {
      const percentage = ((currentSlideIndex + 1) / totalSlides) * 100;
      progressFill.style.width = `${percentage}%`;
    }

    // Trigger any active slide animations
    const activeSlide = slides[currentSlideIndex];
    if (activeSlide) {
      const animatedBars = activeSlide.querySelectorAll('.bar-fill[data-width]');
      animatedBars.forEach((bar) => {
        bar.style.width = '0%';
        setTimeout(() => {
          bar.style.width = bar.getAttribute('data-width') || '100%';
        }, 150);
      });
    }
  }

  function nextSlide() {
    if (currentSlideIndex < totalSlides - 1) {
      updateSlide(currentSlideIndex + 1);
    }
  }

  function prevSlide() {
    if (currentSlideIndex > 0) {
      updateSlide(currentSlideIndex - 1);
    }
  }

  // Keyboard Navigation
  window.addEventListener('keydown', (e) => {
    if (overviewModal && overviewModal.classList.contains('open')) {
      if (e.key === 'Escape') toggleOverview();
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
      case ' ':
      case 'PageDown':
        e.preventDefault();
        nextSlide();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault();
        prevSlide();
        break;
      case 'Home':
        e.preventDefault();
        updateSlide(0);
        break;
      case 'End':
        e.preventDefault();
        updateSlide(totalSlides - 1);
        break;
      case 'f':
      case 'F':
        toggleFullscreen();
        break;
      case 'o':
      case 'O':
        toggleOverview();
        break;
      case 'p':
      case 'P':
        window.print();
        break;
    }
  });

  // Touch Swipe Support
  let touchStartX = 0;
  window.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
  }, { passive: true });

  // Buttons
  if (prevBtn) prevBtn.addEventListener('click', prevSlide);
  if (nextBtn) nextBtn.addEventListener('click', nextSlide);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
  if (printBtn) printBtn.addEventListener('click', () => window.print());

  // Overview Drawer
  function toggleOverview() {
    if (!overviewModal) return;
    const isOpen = overviewModal.classList.toggle('open');
    if (isOpen && overviewGrid) {
      overviewGrid.innerHTML = '';
      slides.forEach((slide, idx) => {
        const titleEl = slide.querySelector('.slide-title');
        const tagEl = slide.querySelector('.slide-tag');
        const title = titleEl ? titleEl.innerText.split('\n')[0] : `Slide ${idx + 1}`;
        const tag = tagEl ? tagEl.innerText : 'Overview';

        const card = document.createElement('div');
        card.className = `overview-card ${idx === currentSlideIndex ? 'active' : ''}`;
        card.innerHTML = `
          <div style="font-size: 11px; text-transform: uppercase; color: var(--accent-sky); margin-bottom: 6px;">${tag}</div>
          <div style="font-size: 15px; font-weight: 700; color: #ffffff;">${idx + 1}. ${title}</div>
        `;
        card.addEventListener('click', () => {
          updateSlide(idx);
          toggleOverview();
        });
        overviewGrid.appendChild(card);
      });
    }
  }

  if (overviewBtn) overviewBtn.addEventListener('click', toggleOverview);
  if (closeOverviewBtn) closeOverviewBtn.addEventListener('click', toggleOverview);

  // Initialize
  updateSlide(0);
})();
