import { Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center" role="status" aria-label="Verificando acesso">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>
);

export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement }) {
  const { isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();
  if (isLoadingAuth || !authChecked) return fallback;
  if (authError) return <div className="p-8 text-center"><p>Não foi possível verificar seu acesso.</p><button type="button" onClick={checkUserAuth}>Tentar novamente</button></div>;
  if (!isAuthenticated) return unauthenticatedElement;
  return <Outlet />;
}
