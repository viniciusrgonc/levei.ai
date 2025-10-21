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
import DriverSetup from "./pages/driver/DriverSetup";
import DriverDashboard from "./pages/driver/DriverDashboard";
import DriverHistory from "./pages/driver/DriverHistory";
import DriverProfile from "./pages/driver/DriverProfile";
import ActiveDelivery from "./pages/driver/ActiveDelivery";
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
              path="/driver/delivery/:deliveryId"
              element={
                <ProtectedRoute>
                  <ActiveDelivery />
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
