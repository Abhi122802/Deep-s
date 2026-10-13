import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { WishlistProvider } from './context/WishlistContext';
import { CartProvider } from './context/CartContext';
import { AdminAuthProvider } from './context/AdminAuthContext';

import { AnnouncementBar } from './components/common/AnnouncementBar';
import { Navbar } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { CartDrawer } from './components/common/CartDrawer';
import { ToastContainer } from './components/common/ToastContainer';
import { ScrollToTop } from './components/common/ScrollToTop';

// Customer Storefront Pages
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CustomCakePage } from './pages/CustomCakePage';
import { CartPage } from './pages/CartPage';
import { WishlistPage } from './pages/WishlistPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Admin Dashboard Components
import { AdminRoute } from './routes/AdminRoute';
import { AdminLayout } from './layouts/AdminLayout';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminCakesPage } from './pages/admin/AdminCakesPage';
import { AdminCakeFormPage } from './pages/admin/AdminCakeFormPage';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage';
import { AdminInquiriesPage } from './pages/admin/AdminInquiriesPage';
import { AdminNotificationsPage } from './pages/admin/AdminNotificationsPage';

/**
 * Customer Storefront Layout with Announcement Bar, Navbar, and Footer
 */
const CustomerLayout = () => (
  <div className="min-h-screen flex flex-col bg-[#FDFBF7] text-[#2B1810]">
    <AnnouncementBar />
    <Navbar />
    <main className="flex-1">
      <Outlet />
    </main>
    <Footer />
    <CartDrawer />
  </div>
);

export function App() {
  return (
    <ToastProvider>
      <WishlistProvider>
        <CartProvider>
          <AdminAuthProvider>
            <BrowserRouter>
              <ScrollToTop />
              <Routes>
                {/* Admin Authentication */}
                <Route path="/admin/login" element={<AdminLoginPage />} />

                {/* Protected Admin Console Routes */}
                <Route path="/admin" element={<AdminRoute />}>
                  <Route element={<AdminLayout />}>
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="dashboard" element={<AdminDashboardPage />} />
                    <Route path="cakes" element={<AdminCakesPage />} />
                    <Route path="cakes/new" element={<AdminCakeFormPage />} />
                    <Route path="cakes/:id/edit" element={<AdminCakeFormPage />} />
                    <Route path="categories" element={<AdminCategoriesPage />} />
                    <Route path="orders" element={<AdminOrdersPage />} />
                    <Route path="inquiries" element={<AdminInquiriesPage />} />
                    <Route path="notifications" element={<AdminNotificationsPage />} />
                  </Route>
                </Route>

                {/* Customer Storefront Routes */}
                <Route element={<CustomerLayout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/cakes" element={<CatalogPage />} />
                  <Route path="/product/:id" element={<ProductDetailPage />} />
                  <Route path="/custom-cake" element={<CustomCakePage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/wishlist" element={<WishlistPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
              <ToastContainer />
            </BrowserRouter>
          </AdminAuthProvider>
        </CartProvider>
      </WishlistProvider>
    </ToastProvider>
  );
}

export default App;
