'use client';

import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Bouton « Exporter PDF » — déclenche le téléchargement de
 * /api/admin/legal/registre/pdf via window.open (target _blank).
 * Real <button role="button"> pour matcher Playwright getByRole('button').
 */
export function ExportPdfButton() {
  function onClick() {
    window.open('/api/admin/legal/registre/pdf', '_blank');
  }

  return (
    <Button variant="outline" type="button" onClick={onClick}>
      <FileDown className="mr-8 h-16 w-16" aria-hidden />
      Exporter PDF
    </Button>
  );
}
