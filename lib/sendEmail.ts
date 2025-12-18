import nodemailer, { TransportOptions } from "nodemailer";

interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  html?: string,
  attachments?: EmailAttachment[],
  from?: string // optional 'from' parameter
) => {
  try {
    // Gmail SMTP configuration
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 100000,
      greetingTimeout: 100000,
    } as TransportOptions);

    const mailOptions = {
      from: from || process.env.GMAIL_USER,
      to,
      subject,
      text,
      html,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error sending email:");
    if (error instanceof Error) {
      console.error(error.message);
      const errWithResponse = error as Error & { response?: unknown };
      if (errWithResponse.response) {
        console.error("SMTP Error Response:", errWithResponse.response);
      }
    }
    throw error; // Re-throw the error so calling code can handle it
  }
};

export default sendEmail;
