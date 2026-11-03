import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { CartProvider } from '@/context/CartContext';
import StoreLayout from '@/components/store/StoreLayout';
import AdminLayout from '@/components/admin/AdminLayout';
// Add page imports here
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';
import InstitutionalPage from './pages/InstitutionalPage';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminProductEdit from './pages/admin/AdminProductEdit';
import AdminCategories from './pages/admin/AdminCategories';
import AdminOrders from './pages/admin/AdminOrders';
import AdminImport from './pages/admin/AdminImport';
import AdminImages from './pages/admin/AdminImages';
import AdminPages from './pages/admin/AdminPages';
import AdminSettings from './pages/admin/AdminSettings';
import AdminPlatform from './pages/admin/AdminPlatform';

const AuthenticatedApp = () => {
  return (
    <CartProvider>
      <Routes>
        {/* Add your page Route elements here */}
        <Route element={<StoreLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route path="/produto/:slug" element={<ProductDetail />} />
          <Route path="/carrinho" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/pedido/sucesso" element={<OrderSuccess />} />
          <Route path="/pagina/:slug" element={<InstitutionalPage />} />
          <Route path="/contato" element={<Contact />} />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login?returnTo=%2Fadmin" replace />} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="produtos" element={<AdminProducts />} />
            <Route path="produtos/novo" element={<AdminProductEdit />} />
            <Route path="produtos/:id" element={<AdminProductEdit />} />
            <Route path="categorias" element={<AdminCategories />} />
            <Route path="pedidos" element={<AdminOrders />} />
            <Route path="importar" element={<AdminImport />} />
            <Route path="imagens" element={<AdminImages />} />
            <Route path="paginas" element={<AdminPages />} />
            <Route path="configuracoes" element={<AdminSettings />} />
            <Route path="plataforma" element={<AdminPlatform />} />
          </Route>
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </CartProvider>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App