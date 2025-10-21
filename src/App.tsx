import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "@/lib/auth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import RestaurantSetup from "./pages/restaurant/RestaurantSetup";
import RestaurantDashboard from "./pages/restaurant/RestaurantDashboard";
import RestaurantHistory from "./pages/restaurant/RestaurantHistory";
import RestaurantProfile from "./pages/restaurant/RestaurantProfile";
import NewDelivery from "./pages/restaurant/NewDelivery";
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
import ActiveDelivery from "./pages/driver/ActiveDelivery";
import AdminDashboard from "./pages/admin/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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
                <ProtectedRoute>
                  <RestaurantSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/restaurant/dashboard"
              element={
                <ProtectedRoute>
                  <RestaurantDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/restaurant/history"
              element={
                <ProtectedRoute>
                  <RestaurantHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/restaurant/profile"
              element={
                <ProtectedRoute>
                  <RestaurantProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/restaurant/new-delivery"
              element={
                <ProtectedRoute>
                  <NewDelivery />
                </ProtectedRoute>
              }
            />
            <Route
              path="/restaurant/delivery/:deliveryId"
              element={
                <ProtectedRoute>
                  <DeliveryTracking />
                </ProtectedRoute>
              }
            />
            <Route
              path="/restaurant/scheduling"
              element={
                <ProtectedRoute>
                  <RestaurantScheduling />
                </ProtectedRoute>
              }
            />
            <Route
              path="/restaurant/wallet"
              element={
                <ProtectedRoute>
                  <RestaurantWallet />
                </ProtectedRoute>
              }
            />
            <Route
              path="/restaurant/account"
              element={
                <ProtectedRoute>
                  <RestaurantAccount />
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/setup"
              element={
                <ProtectedRoute>
                  <DriverSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/dashboard"
              element={
                <ProtectedRoute>
                  <DriverDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/map"
              element={
                <ProtectedRoute>
                  <DriverMap />
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/wallet"
              element={
                <ProtectedRoute>
                  <DriverWallet />
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/history"
              element={
                <ProtectedRoute>
                  <DriverHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/profile"
              element={
                <ProtectedRoute>
                  <DriverProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/settings"
              element={
                <ProtectedRoute>
                  <DriverSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/driver/delivery/:deliveryId"
              element={
                <ProtectedRoute>
                  <ActiveDelivery />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
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
