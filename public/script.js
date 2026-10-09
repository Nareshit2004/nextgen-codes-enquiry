/**
 * NextGen Codes - Student Project Enquiry Website Script
 * Handles responsive navigation, dynamic conditional form fields,
 * accessible validations, duplicate prevention, and persistent backend storage.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const mobileNavToggle = document.getElementById('mobileNavToggle');
  const mainNav = document.getElementById('mainNav');
  const form = document.getElementById('projectEnquiryForm');
  const submitBtn = document.getElementById('submitBtn');
  const submitBtnText = document.getElementById('submitBtnText');
  const submitSpinner = document.getElementById('submitSpinner');
  const formCard = document.getElementById('formCard');
  const successPanel = document.getElementById('successPanel');
  const submitAnotherBtn = document.getElementById('submitAnotherBtn');
  const formAlert = document.getElementById('formAlert');

  // Conditional elements
  const academicYearSelect = document.getElementById('academic_year');
  const academicYearOtherWrap = document.getElementById('academic_year_other_wrap');
  const academicYearOtherInput = document.getElementById('academic_year_other');

  const projectTypeSelect = document.getElementById('project_type');
  const projectTypeOtherWrap = document.getElementById('project_type_other_wrap');
  const projectTypeOtherInput = document.getElementById('project_type_other');

  const domainOtherCheckbox = document.getElementById('domain_other_checkbox');
  const domainOtherWrap = document.getElementById('project_domain_other_wrap');
  const domainOtherInput = document.getElementById('project_domain_other');

  const budgetPrefSelect = document.getElementById('budget_preference');
  const specificBudgetWrap = document.getElementById('specific_budget_amount_wrap');
  const specificBudgetInput = document.getElementById('specific_budget_amount');

  // Multi-select style sync
  const checkboxes = document.querySelectorAll('.checkbox-item input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const parentLabel = cb.closest('.checkbox-item');
      if (parentLabel) {
        if (cb.checked) {
          parentLabel.classList.add('checked');
        } else {
          parentLabel.classList.remove('checked');
        }
      }
    });
  });

  // Mobile menu toggle
  if (mobileNavToggle && mainNav) {
    mobileNavToggle.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('open');
      mobileNavToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Close menu on link click
    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        mobileNavToggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && !mobileNavToggle.contains(e.target)) {
        if (mainNav.classList.contains('open')) {
          mainNav.classList.remove('open');
          mobileNavToggle.setAttribute('aria-expanded', 'false');
        }
      }
    });
  }

  // Handle Conditional Displays
  function toggleConditionalField(condition, wrapElement, inputElement) {
    if (condition) {
      wrapElement.style.display = 'block';
    } else {
      wrapElement.style.display = 'none';
      if (inputElement) {
        inputElement.value = '';
        inputElement.classList.remove('is-invalid');
        const errElem = document.getElementById(`err_${inputElement.id}`);
        if (errElem) errElem.classList.remove('visible');
      }
    }
  }

  // 1. Academic Year 'Other'
  if (academicYearSelect && academicYearOtherWrap) {
    academicYearSelect.addEventListener('change', () => {
      toggleConditionalField(academicYearSelect.value === 'Other', academicYearOtherWrap, academicYearOtherInput);
    });
  }

  // 2. Project Type 'Other'
  if (projectTypeSelect && projectTypeOtherWrap) {
    projectTypeSelect.addEventListener('change', () => {
      toggleConditionalField(projectTypeSelect.value === 'Other', projectTypeOtherWrap, projectTypeOtherInput);
    });
  }

  // 3. Project Domain 'Other'
  if (domainOtherCheckbox && domainOtherWrap) {
    domainOtherCheckbox.addEventListener('change', () => {
      toggleConditionalField(domainOtherCheckbox.checked, domainOtherWrap, domainOtherInput);
    });
  }

  // 4. Budget Preference 'Have a specific budget'
  if (budgetPrefSelect && specificBudgetWrap) {
    budgetPrefSelect.addEventListener('change', () => {
      toggleConditionalField(budgetPrefSelect.value === 'Have a specific budget', specificBudgetWrap, specificBudgetInput);
    });
  }

  // Field validation helpers
  function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errElem = document.getElementById(`err_${fieldId}`);
    if (field) field.classList.add('is-invalid');
    if (errElem) {
      if (message) errElem.textContent = message;
      errElem.classList.add('visible');
    }
  }

  function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const errElem = document.getElementById(`err_${fieldId}`);
    if (field) field.classList.remove('is-invalid');
    if (errElem) errElem.classList.remove('visible');
  }

  function clearAllErrors() {
    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    form.querySelectorAll('.field-error-msg').forEach(el => el.classList.remove('visible'));
    if (formAlert) {
      formAlert.style.display = 'none';
      formAlert.textContent = '';
      formAlert.className = 'form-alert';
    }
  }

  // Live error clear on input/change
  form.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('input', () => {
      if (input.classList.contains('is-invalid')) {
        clearFieldError(input.id);
      }
    });
    input.addEventListener('change', () => {
      if (input.classList.contains('is-invalid')) {
        clearFieldError(input.id);
      }
    });
  });

  // Client-Side Validation
  function validateForm() {
    clearAllErrors();
    let isValid = true;
    let firstInvalidField = null;

    // 1. Student Name
    const nameInput = document.getElementById('student_name');
    if (!nameInput.value.trim()) {
      showFieldError('student_name', 'Please enter your full name.');
      isValid = false;
      if (!firstInvalidField) firstInvalidField = nameInput;
    } else if (nameInput.value.trim().length < 2) {
      showFieldError('student_name', 'Name must be at least 2 characters.');
      isValid = false;
      if (!firstInvalidField) firstInvalidField = nameInput;
    }

    // 2. WhatsApp Number
    const waInput = document.getElementById('whatsapp_number');
    const waVal = waInput.value.trim();
    const digitsOnly = waVal.replace(/\D/g, '');
    if (!waVal) {
      showFieldError('whatsapp_number', 'WhatsApp number is required.');
      isValid = false;
      if (!firstInvalidField) firstInvalidField = waInput;
    } else if (digitsOnly.length < 8 || digitsOnly.length > 15) {
      showFieldError('whatsapp_number', 'Please enter a valid phone number (8–15 digits).');
      isValid = false;
      if (!firstInvalidField) firstInvalidField = waInput;
    }

    // 3. Email Address (Optional)
    const emailInput = document.getElementById('email_address');
    if (emailInput.value.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInput.value.trim())) {
        showFieldError('email_address', 'Please enter a valid email address or leave blank.');
        isValid = false;
        if (!firstInvalidField) firstInvalidField = emailInput;
      }
    }

    // 4. College Name
    const collegeInput = document.getElementById('college_name');
    if (!collegeInput.value.trim()) {
      showFieldError('college_name', 'Please enter your college name.');
      isValid = false;
      if (!firstInvalidField) firstInvalidField = collegeInput;
    }

    // 5. Department
    const deptInput = document.getElementById('department');
    if (!deptInput.value.trim()) {
      showFieldError('department', 'Please specify your department.');
      isValid = false;
      if (!firstInvalidField) firstInvalidField = deptInput;
    }

    // 6. Current Academic Year
    if (!academicYearSelect.value) {
      showFieldError('academic_year', 'Please select your academic year.');
      isValid = false;
      if (!firstInvalidField) firstInvalidField = academicYearSelect;
    } else if (academicYearSelect.value === 'Other') {
      if (!academicYearOtherInput.value.trim()) {
        showFieldError('academic_year_other', 'Please specify your academic year.');
        isValid = false;
        if (!firstInvalidField) firstInvalidField = academicYearOtherInput;
      }
    }

    // 7. Project Type
    if (!projectTypeSelect.value) {
      showFieldError('project_type', 'Please select your project type.');
      isValid = false;
      if (!firstInvalidField) firstInvalidField = projectTypeSelect;
    } else if (projectTypeSelect.value === 'Other') {
      if (!projectTypeOtherInput.value.trim()) {
        showFieldError('project_type_other', 'Please specify your project type.');
        isValid = false;
        if (!firstInvalidField) firstInvalidField = projectTypeOtherInput;
      }
    }

    if (!isValid && firstInvalidField) {
      firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalidField.focus();
    }

    return isValid;
  }

  // Handle Form Submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Gather Form Data
    const formData = new FormData(form);

    // Collect multi-select project domains
    const projectDomains = [];
    form.querySelectorAll('input[name="project_domain"]:checked').forEach(cb => {
      projectDomains.push(cb.value);
    });

    // Collect multi-select assistance
    const requiredAssistance = [];
    form.querySelectorAll('input[name="required_assistance"]:checked').forEach(cb => {
      requiredAssistance.push(cb.value);
    });

    const payload = {
      student_name: formData.get('student_name') ? formData.get('student_name').trim() : '',
      whatsapp_number: formData.get('whatsapp_number') ? formData.get('whatsapp_number').trim() : '',
      email_address: formData.get('email_address') ? formData.get('email_address').trim() : null,
      college_name: formData.get('college_name') ? formData.get('college_name').trim() : '',
      department: formData.get('department') ? formData.get('department').trim() : '',
      academic_year: formData.get('academic_year') || '',
      academic_year_other: formData.get('academic_year_other') ? formData.get('academic_year_other').trim() : null,
      project_type: formData.get('project_type') || '',
      project_type_other: formData.get('project_type_other') ? formData.get('project_type_other').trim() : null,
      project_domains: projectDomains,
      project_domain_other: formData.get('project_domain_other') ? formData.get('project_domain_other').trim() : null,
      project_requirements: formData.get('project_requirements') ? formData.get('project_requirements').trim() : null,
      preferred_technologies: formData.get('preferred_technologies') ? formData.get('preferred_technologies').trim() : null,
      college_guidelines: formData.get('college_guidelines') ? formData.get('college_guidelines').trim() : null,
      budget_preference: formData.get('budget_preference') || null,
      specific_budget_amount: formData.get('specific_budget_amount') ? formData.get('specific_budget_amount').trim() : null,
      required_assistance: requiredAssistance,
      additional_requirements: formData.get('additional_requirements') ? formData.get('additional_requirements').trim() : null
    };

    // Set UI to loading state & prevent duplicate submission
    submitBtn.disabled = true;
    submitBtnText.textContent = 'SUBMITTING...';
    submitSpinner.style.display = 'inline-block';

    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Success: Only clear form now and show confirmation panel
        form.reset();
        // Reset checkbox active styling
        form.querySelectorAll('.checkbox-item').forEach(lbl => lbl.classList.remove('checked'));
        // Hide conditional containers
        academicYearOtherWrap.style.display = 'none';
        projectTypeOtherWrap.style.display = 'none';
        domainOtherWrap.style.display = 'none';
        specificBudgetWrap.style.display = 'none';

        // Switch to success view
        formCard.style.display = 'none';
        successPanel.classList.add('visible');
        successPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

      } else {
        // Server validation error or failure: preserve user data
        if (result.errors) {
          for (const [field, msg] of Object.entries(result.errors)) {
            showFieldError(field, msg);
          }
        }
        formAlert.textContent = result.message || 'Submission failed. Please check your inputs and try again.';
        formAlert.className = 'form-alert alert-error';
        formAlert.style.display = 'block';
        formAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (err) {
      console.error('Fetch error:', err);
      formAlert.textContent = 'Network or connection error. Please check your connection or connect with us directly on WhatsApp.';
      formAlert.className = 'form-alert alert-error';
      formAlert.style.display = 'block';
      formAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
      submitBtn.disabled = false;
      submitBtnText.textContent = 'SUBMIT PROJECT ENQUIRY';
      submitSpinner.style.display = 'none';
    }
  });

  // Submit Another Enquiry handler
  if (submitAnotherBtn) {
    submitAnotherBtn.addEventListener('click', () => {
      successPanel.classList.remove('visible');
      formCard.style.display = 'block';
      clearAllErrors();
      formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // =========================================================================
  // Stacked Draggable Gallery Animation ("How Can We Help You?")
  // =========================================================================
  function initStackedCardCarousel() {
    const stage = document.getElementById('stackedCardsStage');
    if (!stage) return;

    const cards = Array.from(stage.querySelectorAll('.stacked-card'));
    const prevBtn = document.getElementById('carouselPrevBtn');
    const nextBtn = document.getElementById('carouselNextBtn');
    const dots = Array.from(document.querySelectorAll('#carouselIndicators .carousel-dot'));
    const total = cards.length;
    if (total === 0) return;

    let activeIndex = 0;
    let isDragging = false;
    let startX = 0;
    let currentDragX = 0;
    let dragVelocity = 0;
    let lastDragX = 0;
    let lastDragTime = 0;

    // Responsive configuration
    function getConfig() {
      const w = window.innerWidth;
      const isTinyMobile = w <= 360;
      const isMobile = w > 360 && w <= 640;
      const isTablet = w > 640 && w <= 1024;
      return {
        xOffset: isTinyMobile ? 32 : isMobile ? 46 : isTablet ? 72 : 95,
        rotationDeg: isTinyMobile ? 2 : isMobile ? 2.8 : 4.5,
        scaleStep: isTinyMobile ? 0.09 : isMobile ? 0.08 : 0.07,
        maxVisible: isTinyMobile ? 1 : isMobile ? 2 : 3
      };
    }

    // Render cards position with spring-inspired styling
    function renderCards(dragOffset = 0, isDirectDrag = false) {
      const cfg = getConfig();

      cards.forEach((card, index) => {
        // Calculate relative position to active index: -2, -1, 0, 1, 2, ...
        let offset = index - activeIndex;
        // Circular wrap so stack feels continuous
        if (offset > total / 2) offset -= total;
        if (offset < -total / 2) offset += total;

        // Apply dragOffset continuously to the active card and slightly to adjacent cards
        const dragEffect = dragOffset / (cfg.xOffset * 1.5);
        const effectiveOffset = offset + dragEffect;

        const absOffset = Math.abs(effectiveOffset);
        const isCenter = Math.abs(effectiveOffset) < 0.45;

        // Depth calculations
        const zIndex = Math.round(50 - absOffset * 10);
        const scale = Math.max(0.72, 1 - absOffset * cfg.scaleStep);
        const translateX = effectiveOffset * cfg.xOffset;
        const rotateZ = effectiveOffset * cfg.rotationDeg;
        const opacity = absOffset > cfg.maxVisible ? 0 : Math.max(0.15, 1 - absOffset * 0.25);
        const translateY = absOffset * 4; // subtle arch

        // Apply CSS transform
        if (isDirectDrag) {
          card.style.transition = 'none';
        } else {
          // Smooth spring physics transition
          card.style.transition = 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.4s ease, box-shadow 0.3s ease';
        }

        card.style.zIndex = zIndex;
        card.style.opacity = opacity;
        card.style.pointerEvents = isCenter ? 'auto' : 'none';
        card.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale}) rotate(${rotateZ}deg)`;

        if (isCenter) {
          card.classList.add('is-active');
          card.setAttribute('aria-hidden', 'false');
        } else {
          card.classList.remove('is-active');
          card.setAttribute('aria-hidden', 'true');
        }
      });

      // Update indicator dots
      dots.forEach((dot, idx) => {
        const isActive = idx === activeIndex;
        dot.classList.toggle('active', isActive);
        dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    function setActive(newIndex, direction = 0) {
      activeIndex = (newIndex + total) % total;
      renderCards(0, false);
    }

    function next() {
      setActive(activeIndex + 1, 1);
    }

    function prev() {
      setActive(activeIndex - 1, -1);
    }

    // Controls listeners
    if (nextBtn) nextBtn.addEventListener('click', next);
    if (prevBtn) prevBtn.addEventListener('click', prev);

    dots.forEach((dot, idx) => {
      dot.addEventListener('click', () => setActive(idx));
    });

    // Keyboard support when focused
    stage.setAttribute('tabindex', '0');
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        next();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        prev();
        e.preventDefault();
      }
    });

    // Touch & Pointer Drag Gestures
    function handleDragStart(clientX) {
      isDragging = true;
      startX = clientX;
      currentDragX = 0;
      lastDragX = clientX;
      lastDragTime = Date.now();
      dragVelocity = 0;
    }

    function handleDragMove(clientX) {
      if (!isDragging) return;
      const diffX = clientX - startX;
      currentDragX = diffX;

      const now = Date.now();
      const dt = now - lastDragTime;
      if (dt > 10) {
        dragVelocity = (clientX - lastDragX) / dt;
        lastDragX = clientX;
        lastDragTime = now;
      }

      renderCards(currentDragX, true);
    }

    function handleDragEnd() {
      if (!isDragging) return;
      isDragging = false;

      const threshold = 55;
      const velocityThreshold = 0.35;

      if (currentDragX < -threshold || dragVelocity < -velocityThreshold) {
        // Swiped Left -> show Next
        setActive(activeIndex + 1);
      } else if (currentDragX > threshold || dragVelocity > velocityThreshold) {
        // Swiped Right -> show Prev
        setActive(activeIndex - 1);
      } else {
        // Spring back to current card
        renderCards(0, false);
      }
      currentDragX = 0;
    }

    // Pointer events (handles Mouse + Touch smoothly without interference)
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      handleDragStart(e.clientX);
      stage.setPointerCapture(e.pointerId);
    });

    stage.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      handleDragMove(e.clientX);
    });

    stage.addEventListener('pointerup', (e) => {
      handleDragEnd();
      try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
    });

    stage.addEventListener('pointercancel', (e) => {
      handleDragEnd();
      try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
    });

    // Responsive resize & orientation listener
    window.addEventListener('resize', () => {
      renderCards(0, false);
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => renderCards(0, false), 100);
    });

    // Initial render
    renderCards(0, false);
  }

  // Initialize Stacked Card Gallery
  initStackedCardCarousel();

  // Initialize Data Rain Background (Contained within #pageBackgroundWrapper)
  if (typeof window.initDataRain === 'function') {
    window.initDataRain();
  }
});
