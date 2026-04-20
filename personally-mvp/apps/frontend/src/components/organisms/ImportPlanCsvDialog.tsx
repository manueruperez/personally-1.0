import { useState } from 'react';
import { Upload } from 'lucide-react';
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
import { useImportPlanCsv } from '@/features/plans/hooks';
import type { ImportCsvSummary } from '@/features/plans/api';

export function ImportPlanCsvDialog({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [summary, setSummary] = useState<ImportCsvSummary | null>(null);
  const importMut = useImportPlanCsv(planId);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsv(text);
    setSummary(null);
  }

  async function onImport() {
    const result = await importMut.mutateAsync(csv);
    setSummary(result);
  }

  function onClose() {
    setOpen(false);
    setTimeout(() => {
      setCsv('');
      setFileName('');
      setSummary(null);
      importMut.reset();
    }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : onClose())}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar plan desde CSV</DialogTitle>
          <DialogDescription>
            El formato esperado coincide con <code>rutina-demo-12-semanas.csv</code>: columnas
            Week, Day, Session, Exercise, Prescription, Rest_s, RPE_Target, Cues. Solo funciona si
            el plan esta en estado <strong>draft</strong>. Si el plan ya tenia ejercicios, se borran
            y se reemplazan.
          </DialogDescription>
        </DialogHeader>

        {!summary && (
          <div className="space-y-4">
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">
                {fileName || 'Click para elegir un .csv'}
              </span>
              {fileName && (
                <span className="text-xs text-muted-foreground mt-1">
                  {csv.split('\n').length} lineas
                </span>
              )}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={onFileChange}
              />
            </label>

            {importMut.isError && (
              <p className="text-sm text-destructive">
                {(importMut.error as Error)?.message ?? 'No se pudo importar'}
              </p>
            )}
          </div>
        )}

        {summary && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-4 space-y-1">
              <Row label="Dias creados" value={summary.daysCreated} />
              <Row label="Ejercicios del plan" value={summary.itemsCreated} />
              <Row
                label="Ejercicios nuevos en catalogo"
                value={summary.exercisesCreated}
              />
              <Row label="Ejercicios reutilizados" value={summary.exercisesReused} />
              <Row label="Filas saltadas" value={summary.rowsSkipped} />
            </div>
            {summary.warnings.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">
                  {summary.warnings.length} advertencias
                </summary>
                <ul className="mt-2 space-y-1 max-h-32 overflow-auto">
                  {summary.warnings.slice(0, 20).map((w, i) => (
                    <li key={i}>· {w}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {summary ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!summary && (
            <Button onClick={onImport} disabled={!csv || importMut.isPending}>
              {importMut.isPending ? 'Importando...' : 'Importar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
