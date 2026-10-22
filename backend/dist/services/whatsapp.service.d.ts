type SendWhatsAppMessageInput = {
    to: string;
    message: string;
};
type SendWhatsAppMessageResult = {
    sent: boolean;
    provider: "WHATSAPP_CLOUD_API";
    messageId?: string;
    error?: string;
    missingConfig?: boolean;
};
declare function normalizeArgentinaPhone(raw?: string | null): string;
export declare const whatsappService: {
    normalizePhone: typeof normalizeArgentinaPhone;
    sendTextMessage(input: SendWhatsAppMessageInput): Promise<SendWhatsAppMessageResult>;
};
export {};
//# sourceMappingURL=whatsapp.service.d.ts.map