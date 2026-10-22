export type UploadCertificateDto = {
    certificatePem: string;
    certAlias?: string;
    certExpiresAt?: string;
};
export type UploadCertificateWithPrivateKeyDto = UploadCertificateDto & {
    privateKeyPem?: string;
};
//# sourceMappingURL=upload-certificate.dto.d.ts.map