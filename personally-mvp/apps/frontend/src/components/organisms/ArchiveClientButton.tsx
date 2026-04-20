import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/atoms/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/atoms/Dialog';
import { useArchiveClient } from '@/features/clients/hooks';

export function ArchiveClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [open, setOpen] = useState(false);
  const archive = useArchiveClient();
  const navigate = useNavigate();

  async function onConfirm() {
    await archive.mutateAsync(clientId);
    setOpen(false);
    navigate('/clients');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Archivar</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archivar cliente</DialogTitle>
          <DialogDescription>
            Vas a archivar a <strong>{clientName}</strong>. No se borra su historial, pero deja de recibir
            rutinas por WhatsApp.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={archive.isPending}>
            {archive.isPending ? 'Archivando...' : 'Si, archivar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
