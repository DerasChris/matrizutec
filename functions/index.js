const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

const FROM_ADDRESS = 'LabTrack UTEC <labtrackutec@gmail.com>';

function crearTransporte() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

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

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      functions.logger.error('GMAIL_USER o GMAIL_APP_PASSWORD no configurados');
      await snap.ref.update({
        'delivery.state': 'ERROR',
        'delivery.error': 'Credenciales Gmail no configuradas en functions/.env',
        'delivery.attempts': 1,
      });
      return null;
    }

    const finalTo = Array.isArray(to) ? to : [to];

    try {
      const transporte = crearTransporte();
      const info = await transporte.sendMail({
        from: FROM_ADDRESS,
        to: finalTo.join(', '),
        subject: message.subject,
        ...(message.html && { html: message.html }),
        ...(message.text && { text: message.text }),
      });

      functions.logger.info(`Email enviado a ${finalTo.join(', ')} — ID: ${info.messageId}`);

      await snap.ref.update({
        'delivery.state': 'SUCCESS',
        'delivery.attempts': 1,
        'delivery.messageId': info.messageId ?? null,
        'delivery.endTime': new Date().toISOString(),
      });
    } catch (err) {
      functions.logger.error('Error Gmail SMTP:', err.message);
      await snap.ref.update({
        'delivery.state': 'ERROR',
        'delivery.error': err.message,
        'delivery.attempts': 1,
      });
    }

    return null;
  });
