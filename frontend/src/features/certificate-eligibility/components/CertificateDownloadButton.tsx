import { useRef, useState } from 'react';
import { Button } from '../../../components';
import { certificateEligibilityMessages as messages } from '../../../locales/uz-Latn/certificate-eligibility';
import { certificateEligibilityApi } from '../api/certificate-eligibility.api';
import type {
  CertificateReadScope,
  CertificateReference,
} from '../types/certificate-eligibility.types';

interface CertificateDownloadButtonProps {
  certificate: CertificateReference;
  scope: CertificateReadScope;
}

function safeFileName(certificateNumber: string): string {
  const safeNumber = certificateNumber.replaceAll(/[^a-zA-Z0-9_-]/gu, '-');
  return `turk-tili-sertifikat-${safeNumber}.pdf`;
}

export function CertificateDownloadButton({ certificate, scope }: CertificateDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const downloadInFlight = useRef(false);

  async function download(): Promise<void> {
    if (!certificate.canDownload || downloadInFlight.current) return;
    downloadInFlight.current = true;
    setIsDownloading(true);
    setHasError(false);
    let objectUrl: string | null = null;

    try {
      const content = await certificateEligibilityApi.downloadCertificate(
        certificate.certificateId,
        scope,
      );
      objectUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = safeFileName(certificate.certificateNumber);
      link.hidden = true;
      document.body.append(link);
      try {
        link.click();
      } finally {
        link.remove();
      }
    } catch {
      setHasError(true);
    } finally {
      const objectUrlToRevoke = objectUrl;
      if (objectUrlToRevoke) {
        window.setTimeout(() => URL.revokeObjectURL(objectUrlToRevoke), 0);
      }
      downloadInFlight.current = false;
      setIsDownloading(false);
    }
  }

  if (!certificate.canDownload) return null;

  return (
    <div className="mt-5">
      <Button loading={isDownloading} onClick={() => void download()}>
        {isDownloading ? messages.downloading : messages.download}
      </Button>
      {hasError ? (
        <p className="mt-2 text-body-sm text-danger-text" role="alert">
          {messages.downloadError}
        </p>
      ) : null}
    </div>
  );
}
