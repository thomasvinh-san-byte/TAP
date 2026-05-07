'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { decryptNirAction } from '../actions';

interface Props {
  patientId: string;
  maskedNir: string;
}

/**
 * Affiche le NIR masqué par défaut. Bouton « Afficher le NIR complet »
 * déclenche un déchiffrement on-demand via Edge Function (D-05) ; chaque
 * révélation est consignée automatiquement dans audit_logs côté serveur
 * (T-05-04). Aucun stockage du NIR clair (state mémoire uniquement, ni
 * localStorage ni sessionStorage — T-05-01).
 */
export function PatientNirDisplay({ patientId, maskedNir }: Props) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleReveal() {
    setLoading(true);
    const res = await decryptNirAction(patientId);
    setLoading(false);
    if ('error' in res) {
      toast.error(res.error);
      return;
    }
    setRevealed(res.nir);
    toast.success("NIR affiché. Action consignée dans l'audit.");
  }

  return (
    <div className="flex items-center gap-12">
      <code className="font-mono text-base tabular-nums">
        {revealed ?? maskedNir}
      </code>
      {revealed === null ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReveal}
          disabled={loading}
        >
          <Eye className="mr-8 h-16 w-16" aria-hidden />
          {loading ? 'Déchiffrement…' : 'Afficher le NIR complet'}
        </Button>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setRevealed(null)}>
          <EyeOff className="mr-8 h-16 w-16" aria-hidden />
          Masquer
        </Button>
      )}
    </div>
  );
}
