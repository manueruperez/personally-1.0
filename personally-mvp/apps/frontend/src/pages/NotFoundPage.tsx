import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-heading font-semibold">404</h1>
      <p className="text-muted-foreground">Pagina no encontrada.</p>
      <Link to="/" className="text-primary underline">
        Volver al inicio
      </Link>
    </div>
  );
}
