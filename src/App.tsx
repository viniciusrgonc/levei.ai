import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "@/lib/auth";
import { AdminRoute } from "@/lib/AdminRoute";
import { DriverRoute } from "@/lib/DriverRoute";
import { RestaurantRoute } from "@/lib/RestaurantRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import RestaurantSetup from "./pages/restaurant/RestaurantSetup";
import RestaurantDashboard from "./pages/restaurant/RestaurantDashboard";
import RestaurantHistory from "./pages/restaurant/RestaurantHistory";
import RestaurantProfile from "./pages/restaurant/RestaurantProfile";
import NewDelivery from "./pages/restaurant/NewDelivery";
import ConfirmDelivery from "./pages/restaurant/ConfirmDelivery";
import DeliveryTracking from "./pages/restaurant/DeliveryTracking";
import RestaurantScheduling from "./pages/restaurant/RestaurantScheduling";
import RestaurantWallet from "./pages/restaurant/RestaurantWallet";
import RestaurantAccount from "./pages/restaurant/RestaurantAccount";
import DriverSetup from "./pages/driver/DriverSetup";
import DriverDashboard from "./pages/driver/DriverDashboard";
import DriverMap from "./pages/driver/DriverMap";
import DriverWallet from "./pages/driver/DriverWallet";
import DriverHistory from "./pages/driver/DriverHistory";
import DriverProfile from "./pages/driver/DriverProfile";
import DriverSettings from "./pages/driver/DriverSettings";
import AvailableDeliveries from "./pages/driver/AvailableDeliveries";
import PickupInProgress from "./pages/driver/PickupInProgress";
import DeliveryInProgress from "./pages/driver/DeliveryInProgress";
import ReturnInProgress from "./pages/driver/ReturnInProgress";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminDrivers from "./pages/admin/AdminDrivers";
import AdminRestaurants from "./pages/admin/AdminRestaurants";
import AdminDeliveries from "./pages/admin/AdminDeliveries";
import AdminDisputes from "./pages/admin/AdminDisputes";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminDeliveryCategories from "./pages/admin/AdminDeliveryCategories";
import AdminProductSettings from "./pages/admin/AdminProductSettings";
import AdminTransactions from "./pages/admin/AdminTransactions";
import AdminFinancialReports from "./pages/admin/AdminFinancialReports";
import AdminRadiusSettings from "./pages/admin/AdminRadiusSettings";
import AdminBatchSettings from "./pages/admin/AdminBatchSettings";
import AdminFeeTypes from "./pages/admin/AdminFeeTypes";
import NotFound from "./pages/NotFound";
import { PwaUpdateHandler } from "./components/PwaUpdateHandler";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PwaUpdateHandler />
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/restaurant/setup"
              element={
                <RestaurantRoute>
                  <RestaurantSetup />
                </RestaurantRoute>
              }
            />
            <Route
              path="/restaurant/dashboard"
              element={
                <RestaurantRoute>
                  <RestaurantDashboard />
                </RestaurantRoute>
              }
            />
            <Route
              path="/restaurant/history"
              element={
                <RestaurantRoute>
                  <RestaurantHistory />
                </RestaurantRoute>
              }
            />
            <Route
              path="/restaurant/profile"
              element={
                <RestaurantRoute>
                  <RestaurantProfile />
                </RestaurantRoute>
              }
            />
            <Route
              path="/restaurant/new-delivery"
              element={
                <RestaurantRoute>
                  <NewDelivery />
                </RestaurantRoute>
              }
            />
            <Route
              path="/restaurant/confirm-delivery"
              element={
                <RestaurantRoute>
                  <ConfirmDelivery />
                </RestaurantRoute>
              }
            />
            <Route
              path="/restaurant/delivery/:deliveryId"
              element={
                <RestaurantRoute>
                  <DeliveryTracking />
                </RestaurantRoute>
              }
            />
            <Route
              path="/restaurant/scheduling"
              element={
                <RestaurantRoute>
                  <RestaurantScheduling />
                </RestaurantRoute>
              }
            />
            <Route
              path="/restaurant/wallet"
              element={
                <RestaurantRoute>
                  <RestaurantWallet />
                </RestaurantRoute>
              }
            />
            <Route
              path="/restaurant/account"
              element={
                <RestaurantRoute>
                  <RestaurantAccount />
                </RestaurantRoute>
              }
            />
            <Route
              path="/driver/setup"
              element={
                <DriverRoute>
                  <DriverSetup />
                </DriverRoute>
              }
            />
            <Route
              path="/driver/dashboard"
              element={
                <DriverRoute>
                  <DriverDashboard />
                </DriverRoute>
              }
            />
            <Route
              path="/driver/available"
              element={
                <DriverRoute>
                  <AvailableDeliveries />
                </DriverRoute>
              }
            />
            <Route
              path="/driver/pickup/:deliveryId"
              element={
                <DriverRoute>
                  <PickupInProgress />
                </DriverRoute>
              }
            />
            <Route
              path="/driver/delivery/:deliveryId"
              element={
                <DriverRoute>
                  <DeliveryInProgress />
                </DriverRoute>
              }
            />
            <Route
              path="/driver/return/:deliveryId"
              element={
                <DriverRoute>
                  <ReturnInProgress />
                </DriverRoute>
              }
            />
            <Route
              path="/driver/map"
              element={
                <DriverRoute>
                  <DriverMap />
                </DriverRoute>
              }
            />
            <Route
              path="/driver/wallet"
              element={
                <DriverRoute>
                  <DriverWallet />
                </DriverRoute>
              }
            />
            <Route
              path="/driver/history"
              element={
                <DriverRoute>
                  <DriverHistory />
                </DriverRoute>
              }
            />
            <Route
              path="/driver/profile"
              element={
                <DriverRoute>
                  <DriverProfile />
                </DriverRoute>
              }
            />
            <Route
              path="/driver/settings"
              element={
                <DriverRoute>
                  <DriverSettings />
                </DriverRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/drivers"
              element={
                <AdminRoute>
                  <AdminDrivers />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/restaurants"
              element={
                <AdminRoute>
                  <AdminRestaurants />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/deliveries"
              element={
                <AdminRoute>
                  <AdminDeliveries />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/disputes"
              element={
                <AdminRoute>
                  <AdminDisputes />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <AdminRoute>
                  <AdminSettings />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/delivery-categories"
              element={
                <AdminRoute>
                  <AdminDeliveryCategories />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/product-settings"
              element={
                <AdminRoute>
                  <AdminProductSettings />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/transactions"
              element={
                <AdminRoute>
                  <AdminTransactions />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <AdminRoute>
                  <AdminFinancialReports />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/radius-settings"
              element={
                <AdminRoute>
                  <AdminRadiusSettings />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/batch-settings"
              element={
                <AdminRoute>
                  <AdminBatchSettings />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/fee-types"
              element={
                <AdminRoute>
                  <AdminFeeTypes />
                </AdminRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
