import { Link } from 'react-router-dom';

export default function PageNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center space-y-6">
        <p className="text-7xl font-light text-muted-foreground/40">404</p>
        <div className="space-y-3">
          <h1 className="font-heading text-3xl">Página não encontrada</h1>
          <p className="text-muted-foreground">Este endereço não está disponível. Continue navegando pela loja.</p>
        </div>
        <Link to="/" className="inline-flex items-center px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted">
          Voltar para a loja
        </Link>
      </div>
    </div>
  );
}
