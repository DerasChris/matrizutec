const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Resend } = require('resend');

admin.initializeApp();

const FROM_ADDRESS = 'LabTrack UTEC <onboarding@resend.dev>';

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

    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      functions.logger.error('RESEND_API_KEY no encontrada en variables de entorno');
      await snap.ref.update({
        'delivery.state': 'ERROR',
        'delivery.error': 'RESEND_API_KEY no configurada en functions/.env',
        'delivery.attempts': 1,
      });
      return null;
    }

    const resend = new Resend(apiKey);

    // Si OVERRIDE_TO_EMAIL está definido (modo sin dominio verificado),
    // todos los emails van a ese correo con el destinatario real en el asunto.
    const overrideTo = process.env.OVERRIDE_TO_EMAIL;
    const realTo = Array.isArray(to) ? to.join(', ') : to;
    const finalTo = overrideTo ? [overrideTo] : (Array.isArray(to) ? to : [to]);
    const finalSubject = overrideTo
      ? `[Para: ${realTo}] ${message.subject}`
      : message.subject;

    try {
      const { data: resendData, error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to: finalTo,
        subject: finalSubject,
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
