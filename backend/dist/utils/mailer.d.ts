import nodemailer from "nodemailer";
export declare const transporter: nodemailer.Transporter<import("nodemailer/lib/smtp-transport").SentMessageInfo, import("nodemailer/lib/smtp-transport").Options>;
export declare function sendInvoiceEmail(sale: any, pdfPath: string): Promise<void>;
//# sourceMappingURL=mailer.d.ts.map