/* Contact page's "Send Us A Message" form has nowhere to actually submit to
   (no email backend here — same situation as checkout, see js/cart.js), so
   instead of posting anywhere it builds a readable message and opens
   WhatsApp's click-to-chat link, pre-filled and ready to send, to the same
   store number used for order checkout. */
(function () {
  'use strict';

  // Same store WhatsApp number used for checkout (js/cart.js), kept in sync
  // here since this is a separate static page with no shared config file.
  const WHATSAPP_NUMBER = '923342111595'; //  digits only, no leading 0/+

  function buildContactMessage(details) {
    const lines = ['Hi! I have a question from the JF Fashion contact page:', ''];
    if (details.name) lines.push(`Name: ${details.name}`);
    if (details.email) lines.push(`Email: ${details.email}`);
    lines.push('', details.message);
    return lines.join('\n');
  }

  function init() {
    const form = document.getElementById('contact-form');
    if (!form) return; // not on the contact page

    const msgBox = form.querySelector('.js-contact-form-msg');

    function showMessage(text, type) {
      if (!msgBox) return;
      msgBox.textContent = text;
      msgBox.classList.remove('is-error', 'is-success');
      msgBox.classList.add('show', type);
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = form.querySelector('#contact-name').value.trim();
      const email = form.querySelector('#contact-email').value.trim();
      const message = form.querySelector('#contact-message').value.trim();

      if (!message) {
        showMessage('Please write a message before sending.', 'is-error');
        return;
      }

      const text = buildContactMessage({ name, email, message });
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank', 'noopener');

      showMessage('Opening WhatsApp with your message ready to send…', 'is-success');
      form.reset();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
