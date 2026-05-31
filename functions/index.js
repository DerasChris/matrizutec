const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Resend } = require('resend');

admin.initializeApp();

const FROM_ADDRESS = 'LabTrack UTEC <onboarding@resend.dev>';

/**
 * Se dispara cuando se crea un documento en la colección `mail/`.
 * Llama a Resend y actualiza el documento con el estado de entrega.
 */
exports.procesarEmailQueue = functions.firestore
  .document('mail/{mailId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    const { to, message } = data;

    if (!to || !message?.subject) {
      await snap.ref.update({
        'delivery.state': 'ERROR',
        'delivery.error': 'Documento inválido: faltan campos to o message.subject',
        'delivery.attempts': 1,
      });
      return null;
    }

    const apiKey = functions.config().resend?.api_key;
    if (!apiKey) {
      await snap.ref.update({
        'delivery.state': 'ERROR',
        'delivery.error': 'API key de Resend no configurada. Corre: firebase functions:config:set resend.api_key="re_xxx"',
        'delivery.attempts': 1,
      });
      return null;
    }

    const resend = new Resend(apiKey);

    try {
      const { data: resendData, error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: Array.isArray(to) ? to : [to],
        subject: message.subject,
        ...(message.html && { html: message.html }),
        ...(message.text && { text: message.text }),
      });

      if (error) throw new Error(error.message);

      functions.logger.info(`Email enviado a ${to} — Resend ID: ${resendData?.id}`);

      await snap.ref.update({
        'delivery.state': 'SUCCESS',
        'delivery.attempts': 1,
        'delivery.messageId': resendData?.id ?? null,
        'delivery.endTime': new Date().toISOString(),
      });
    } catch (err) {
      functions.logger.error('Error Resend:', err.message);
      await snap.ref.update({
        'delivery.state': 'ERROR',
        'delivery.error': err.message,
        'delivery.attempts': 1,
      });
    }

    return null;
  });
