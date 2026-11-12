// Token-hash verification does not depend on the browser that requested the email.
function buildAuthEmailTemplates(config) {
  const updates = {};
  for (const [kind, type, next] of [
    ['magic_link', 'email', '/auth/post-login'],
    ['confirmation', 'email', '/auth/post-login'],
    ['recovery', 'recovery', '/auth/update-password'],
  ]) {
    const field = `mailer_templates_${kind}_content`;
    const original = config[field];
    if (typeof original !== 'string' || !original.includes('{{ .ConfirmationURL }}')) {
      throw new Error(`Expected the existing ConfirmationURL template: ${field}`);
    }
    const link = `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}&amp;next=${encodeURIComponent(next)}`;
    let content = original.replaceAll('{{ .ConfirmationURL }}', link);
    if (kind === 'magic_link') {
      const code = '<p style="font-size:14px;line-height:1.6;color:#FFFFFF;">Using the Home Screen app? Return to the app and enter this sign-in code instead of opening the link:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px;color:#FFFFFF;">{{ .Token }}</p><p style="font-size:12px;color:#FFFFFF;">Use the latest email only. The code and link can each be used only once; using either invalidates the other. Never share your code.</p>';
      if (!content.includes('</body>')) throw new Error(`Expected an HTML email: ${field}`);
      // Put the code before the primary action, inside the existing styled card.
      const marker = '<table role="presentation" cellpadding="0"';
      if (!content.includes(marker)) throw new Error(`Expected an email action: ${field}`);
      content = content.replace(marker, code + marker);
    }
    updates[field] = content;
  }
  return updates;
}
module.exports = { buildAuthEmailTemplates };
