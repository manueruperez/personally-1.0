import { useState } from 'react';
import { Send } from 'lucide-react';
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
import { Label } from '@/components/atoms/Label';
import { useSendTestMessage } from '@/features/clients/hooks';

export function SendTestMessageDialog({
  clientId,
  clientName,
  clientPhone,
}: {
  clientId: string;
  clientName: string;
  clientPhone: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(`Hola ${clientName.split(' ')[0]}! Esto es un mensaje de prueba del bot.`);
  const send = useSendTestMessage(clientId);

  async function onSubmit() {
    await send.mutateAsync(text);
    setTimeout(() => {
      setOpen(false);
      send.reset();
    }, 800);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Send className="h-4 w-4 mr-1" />
          Enviar prueba
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar mensaje de prueba</DialogTitle>
          <DialogDescription>
            Le va a llegar por WhatsApp a <span className="font-mono">{clientPhone}</span>. El agente
            tiene que estar en linea.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="text">Mensaje</Label>
          <textarea
            id="text"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        {send.isError && (
          <p className="text-sm text-destructive">
            {(send.error as Error)?.message ?? 'No se pudo encolar'}
          </p>
        )}
        {send.isSuccess && (
          <p className="text-sm text-primary">
            ✓ Encolado. El agente lo va a enviar en unos segundos.
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
          <Button onClick={onSubmit} disabled={send.isPending || !text.trim()}>
            {send.isPending ? 'Encolando...' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
