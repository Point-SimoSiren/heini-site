const uiText = document.documentElement.lang === 'en' ? {
  menu: 'Menu', close: 'Close',
  unavailable: 'The contact form will be available when the server is published. You can contact me by email.',
  required: 'Enter your name and message before sending.',
  sending: 'Sending your message…',
  invalidResponse: 'The server returned an invalid response',
  sendFailed: 'Sending failed', unknownError: 'Unknown error',
  success: 'Thank you! Your message was sent successfully.',
  failure: 'Your message could not be sent. Please try again later or contact me by email.',
  consoleError: 'Contact form submission failed:',
} : {
  menu: 'Valikko', close: 'Sulje',
  unavailable: 'Lomakkeen lähetys avataan, kun palvelin on julkaistu. Voit ottaa yhteyttä sähköpostitse.',
  required: 'Täytä nimi ja viesti ennen lähettämistä.',
  sending: 'Lähetetään viestiä…',
  invalidResponse: 'Palvelin palautti virheellisen vastauksen',
  sendFailed: 'Lähetys epäonnistui', unknownError: 'Tuntematon virhe',
  success: 'Kiitos viestistäsi! Viesti lähetettiin onnistuneesti.',
  failure: 'Viestin lähetys epäonnistui. Yritä myöhemmin uudelleen tai lähetä sähköpostia.',
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
  // Vaihda tähän julkinen HTTPS-osoite, kun yhteydenotto-API julkaistaan.
  const API_URL = 'http://127.0.0.1:5000/contact';
  const SITE_ID = 'kaarisilta';
  const status = document.getElementById('contact-status');
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const nameField = contactForm.elements.namedItem('name');
  const emailField = contactForm.elements.namedItem('email');
  const messageField = contactForm.elements.namedItem('message');

  const showStatus = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
  };

  // Julkinen sivu ei voi lähettää viestiä kävijän oman tietokoneen localhostiin.
  const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  if (!isLocalPreview && ['localhost', '127.0.0.1'].includes(new URL(API_URL).hostname)) {
    submitButton.disabled = true;
    showStatus(uiText.unavailable, 'error');
  } else {
    contactForm.addEventListener('submit', async (event) => {
      event.preventDefault();

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
        submitButton.disabled = false;
        contactForm.removeAttribute('aria-busy');
      }
    });
    submitButton.disabled = false;
  }
}
