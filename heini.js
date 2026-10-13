const uiText = document.documentElement.lang === 'en' ? {
  menu: 'Menu', close: 'Close',
  required: 'Enter your name and message before sending.',
  sending: 'Sending your message…',
  invalidResponse: 'The server returned an invalid response',
  sendFailed: 'Sending failed', unknownError: 'Unknown error',
  success: 'Thank you! Your message was sent successfully.',
  failure: 'Your message could not be sent. Please try again later or contact me by email.',
  preparing: 'Preparing the contact form. This may take about a minute…',
  ready: 'The contact form is ready.',
  unavailable: 'The contact form could not be prepared. Please try again or send an email.',
  retry: 'Try again',
  consoleError: 'Contact form submission failed:',
} : {
  menu: 'Valikko', close: 'Sulje',
  required: 'Täytä nimi ja viesti ennen lähettämistä.',
  sending: 'Lähetetään viestiä…',
  invalidResponse: 'Palvelin palautti virheellisen vastauksen',
  sendFailed: 'Lähetys epäonnistui', unknownError: 'Tuntematon virhe',
  success: 'Kiitos viestistäsi! Viesti lähetettiin onnistuneesti.',
  failure: 'Viestin lähetys epäonnistui. Yritä myöhemmin uudelleen tai lähetä sähköpostia.',
  preparing: 'Valmistellaan yhteydenottolomaketta. Tämä voi kestää noin minuutin…',
  ready: 'Yhteydenottolomake on valmis.',
  unavailable: 'Lomaketta ei saatu valmiiksi. Yritä uudelleen tai lähetä sähköpostia.',
  retry: 'Yritä uudelleen',
  consoleError: 'Yhteydenottolomakkeen lähetys epäonnistui:',
};

// Mobile navigation for the standalone site.
const siteHeader = document.querySelector('.site-header');
if (siteHeader) {
  const updateHeaderHeight = () => {
    document.documentElement.style.setProperty('--header-height', `${siteHeader.getBoundingClientRect().height}px`);
  };
  updateHeaderHeight();
  new ResizeObserver(updateHeaderHeight).observe(siteHeader);
}

const menuButton = document.querySelector('.menu-toggle');
const mainNavigation = document.getElementById('paavalikko');

if (menuButton && mainNavigation) {
  document.documentElement.classList.add('js');
  menuButton.hidden = false;
  const closeMenu = () => {
    mainNavigation.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.textContent = uiText.menu;
  };
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    mainNavigation.classList.toggle('open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.textContent = open ? uiText.close : uiText.menu;
  });
  mainNavigation.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mainNavigation.classList.contains('open')) {
      closeMenu();
      menuButton.focus();
    }
  });
  window.matchMedia('(max-width: 760px)').addEventListener('change', closeMenu);
}

const contactForm = document.getElementById('yhteydenottolomake');
if (contactForm) {
  const API_URL = 'https://tcg-lomakeapi.onrender.com/contact';
  const HEALTH_URL = 'https://tcg-lomakeapi.onrender.com/health';
  const SITE_ID = 'kaarisilta';
  const status = document.getElementById('contact-status');
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const nameField = contactForm.elements.namedItem('name');
  const emailField = contactForm.elements.namedItem('email');
  const messageField = contactForm.elements.namedItem('message');
  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className = 'form-retry';
  retryButton.textContent = uiText.retry;
  retryButton.hidden = true;
  status.insertAdjacentElement('afterend', retryButton);
  let apiReady = false;

  const showStatus = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
  };

  const prepareForm = async () => {
    apiReady = false;
    submitButton.disabled = true;
    retryButton.hidden = true;
    showStatus(uiText.preparing, 'loading');

    // A sleeping Render service can take about a minute to start. Retry if
    // the first response is a temporary loading page or a network error.
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(HEALTH_URL, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const result = await response.json();
        if (response.ok && result.status === 'ok') {
          apiReady = true;
          submitButton.disabled = false;
          showStatus(uiText.ready, 'ready');
          return;
        }
      } catch {
        // A cold start may temporarily fail; keep checking until the deadline.
      } finally {
        clearTimeout(timeout);
      }
      if (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    }

    showStatus(uiText.unavailable, 'error');
    retryButton.hidden = false;
  };

  retryButton.addEventListener('click', prepareForm);
  prepareForm();

  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!apiReady) return;

    const name = nameField.value.trim();
    const email = emailField.value.trim();
    const message = messageField.value.trim();
    if (!name || !message) {
      showStatus(uiText.required, 'error');
      (!name ? nameField : messageField).focus();
      return;
    }

    submitButton.disabled = true;
    contactForm.setAttribute('aria-busy', 'true');
    showStatus(uiText.sending, 'sending');

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: SITE_ID, name, email, message }),
      });

      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error(`${uiText.invalidResponse} (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(`${uiText.sendFailed} (${response.status}): ${result?.error ?? uiText.unknownError}`);
      }

      contactForm.reset();
      showStatus(uiText.success, 'success');
    } catch (error) {
      console.error(uiText.consoleError, error);
      showStatus(uiText.failure, 'error');
    } finally {
      submitButton.disabled = !apiReady;
      contactForm.removeAttribute('aria-busy');
    }
  });
}
