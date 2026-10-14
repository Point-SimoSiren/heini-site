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
  personalIdWarning: 'This form appears to contain a Finnish personal identity code. Remove it before sending.',
  birthDateWarning: 'This form contains a date that could be a date of birth. Please remove dates of birth before sending. For privacy, the form does not accept full dates.',
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
  personalIdWarning: 'Lomakkeessa näyttää olevan henkilötunnus. Poista se ennen lähettämistä.',
  birthDateWarning: 'Lomakkeessa on päivämäärä, joka voi olla syntymäaika. Älä lähetä syntymäaikaa lomakkeella. Tietosuojan vuoksi lomake ei hyväksy kokonaisia päivämääriä.',
  consoleError: 'Yhteydenottolomakkeen lähetys epäonnistui:',
};

const isPlausibleBirthDate = (day, month, year) => {
  const currentYear = new Date().getFullYear();
  if (year < currentYear - 125 || year > currentYear || month < 1 || month > 12) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth && new Date(year, month - 1, day) <= new Date();
};

const detectSensitiveDate = (value) => {
  // Finnish personal identity codes: original and newer century separators.
  const personalId = /(?:^|[^0-9A-Za-z])(\d{2})(\d{2})(\d{2})\s*([+\-ABCDEFYXWVU])\s*\d{3}[0-9A-Y](?![0-9A-Za-z])/gi;
  for (const match of value.matchAll(personalId)) {
    const separator = match[4].toUpperCase();
    const century = separator === '+' ? 1800 : '-YXWVU'.includes(separator) ? 1900 : 2000;
    if (isPlausibleBirthDate(Number(match[1]), Number(match[2]), century + Number(match[3]))) {
      return 'personalId';
    }
  }

  const numericDates = [
    /\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4}|\d{2})\b/g,
    /\b(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})\b/g,
    /(?:^|[\s(])(\d{2})(\d{2})(\d{4})(?!\d)/g,
  ];
  for (const [index, pattern] of numericDates.entries()) {
    for (const match of value.matchAll(pattern)) {
      const day = Number(index === 1 ? match[3] : match[1]);
      const month = Number(match[2]);
      const yearText = index === 1 ? match[1] : match[3];
      const shortYear = Number(yearText);
      const year = yearText.length === 2 ? (shortYear <= new Date().getFullYear() % 100 ? 2000 : 1900) + shortYear : shortYear;
      if (isPlausibleBirthDate(day, month, year)) return 'birthDate';
    }
  }

  if (/(?:syntymäaika(?:ni)?|syntymäpäivä(?:ni)?|syntynyt|date of birth|birthdate|born)\b.{0,30}\d{2,4}/i.test(value)) {
    return 'birthDate';
  }
  return null;
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
  const personalDataWarning = document.getElementById('personal-data-warning');
  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className = 'form-retry';
  retryButton.textContent = uiText.retry;
  retryButton.hidden = true;
  status.insertAdjacentElement('afterend', retryButton);
  let apiReady = false;
  let isSending = false;

  const updateSensitiveWarning = () => {
    const nameIssue = detectSensitiveDate(nameField.value);
    const messageIssue = detectSensitiveDate(messageField.value);
    const issue = nameIssue || messageIssue;
    if (personalDataWarning.dataset.kind !== (issue || '')) {
      personalDataWarning.textContent = issue === 'personalId' ? uiText.personalIdWarning : issue === 'birthDate' ? uiText.birthDateWarning : '';
      personalDataWarning.dataset.kind = issue || '';
    }
    personalDataWarning.hidden = !issue;
    nameField.setAttribute('aria-invalid', String(Boolean(nameIssue)));
    messageField.setAttribute('aria-invalid', String(Boolean(messageIssue)));
    submitButton.disabled = !apiReady || isSending || Boolean(issue);
    return issue;
  };

  nameField.addEventListener('input', updateSensitiveWarning);
  messageField.addEventListener('input', updateSensitiveWarning);

  const showStatus = (message, state) => {
    status.textContent = message;
    status.dataset.state = state;
  };

  const prepareForm = async () => {
    apiReady = false;
    updateSensitiveWarning();
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
          updateSensitiveWarning();
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
    const sensitiveIssue = updateSensitiveWarning();
    if (sensitiveIssue) {
      (detectSensitiveDate(nameField.value) ? nameField : messageField).focus();
      return;
    }

    const name = nameField.value.trim();
    const email = emailField.value.trim();
    const message = messageField.value.trim();
    if (!name || !message) {
      showStatus(uiText.required, 'error');
      (!name ? nameField : messageField).focus();
      return;
    }

    isSending = true;
    updateSensitiveWarning();
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
      isSending = false;
      updateSensitiveWarning();
      contactForm.removeAttribute('aria-busy');
    }
  });
}
