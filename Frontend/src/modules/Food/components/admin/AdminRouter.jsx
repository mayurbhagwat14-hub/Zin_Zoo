import { Suspense, lazy, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import AuthRedirect from "@food/components/AuthRedirect";
import AdminLayout from "./AdminLayout";
import Loader from "@food/components/Loader";
import { getCurrentUser } from "@food/utils/auth";
import { canAccessFeatureSettings, canAccessSuperPowers } from "@food/utils/adminPermissions";
import { adminAPI } from "@/services/api";

const AdminHome = lazy(() => import("@food/pages/admin/AdminHome"));
const AdminProfile = lazy(() => import("@food/pages/admin/AdminProfile"));
const AdminSettings = lazy(() => import("@food/pages/admin/AdminSettings"));
const NewRefundRequests = lazy(() => import("@food/pages/admin/refunds/NewRefundRequests"));
const OrdersPage = lazy(() => import("@food/pages/admin/orders/OrdersPage"));
const GlobalOrdersPage = lazy(() => import("@food/pages/admin/orders/GlobalOrdersPage"));
const OrderDetectDelivery = () => null;
const Category = lazy(() => import("@food/pages/admin/categories/Category"));
const GroceryCategory = lazy(() => import("@food/pages/admin/grocery/GroceryCategory"));
const GroceryProductsList = lazy(() => import("@food/pages/admin/grocery/GroceryProductsList"));
const GroceryOrdersPage = lazy(() => import("@food/pages/admin/grocery/GroceryOrdersPage"));

const AccessoriesCategory = lazy(() => import("@food/pages/admin/accessories/AccessoriesCategory"));
const AccessoriesProductsList = lazy(() => import("@food/pages/admin/accessories/AccessoriesProductsList"));
const AccessoriesOrdersPage = lazy(() => import("@food/pages/admin/accessories/AccessoriesOrdersPage"));

const FeeSettings = lazy(() => import("@food/pages/admin/fee-settings/FeeSettings"));
const ReferralSettings = lazy(() => import("@food/pages/admin/referral-settings/ReferralSettings"));
// Food Management
const FoodsList = lazy(() => import("@food/pages/admin/foods/FoodsList"));
const AddonsList = lazy(() => import("@food/pages/admin/addons/AddonsList"));
const RestaurantsList = lazy(() => import("@food/pages/admin/restaurants/RestaurantsList"));
const RestaurantCommissions = lazy(() => import("@food/pages/admin/restaurants/RestaurantCommissions"));

// Services Management
const ServicesList = lazy(() => import("@food/pages/admin/services/ServicesList"));
const ServiceCategories = lazy(() => import("@food/pages/admin/services/ServiceCategories"));
const BookingsList = lazy(() => import("@food/pages/admin/services/BookingsList"));

// Promotions Management
const BasicCampaign = lazy(() => import("@food/pages/admin/campaigns/BasicCampaign"));
const FoodCampaign = lazy(() => import("@food/pages/admin/campaigns/FoodCampaign"));
const Coupons = lazy(() => import("@food/pages/admin/Coupons"));
const Cashback = lazy(() => import("@food/pages/admin/Cashback"));
const Banners = lazy(() => import("@food/pages/admin/Banners"));
const NewAdvertisement = lazy(() => import("@food/pages/admin/advertisement/NewAdvertisement"));
const AdRequests = lazy(() => import("@food/pages/admin/advertisement/AdRequests"));
const AdsList = lazy(() => import("@food/pages/admin/advertisement/AdsList"));

// Help & Support
const Chattings = lazy(() => import("@food/pages/admin/Chattings"));
const ContactMessages = lazy(() => import("@food/pages/admin/ContactMessages"));
const SafetyEmergencyReports = lazy(() => import("@food/pages/admin/SafetyEmergencyReports"));
// Customer Management
const Customers = lazy(() => import("@food/pages/admin/Customers"));
const SupportTickets = lazy(() => import("@food/pages/admin/SupportTickets"));
const AddFund = lazy(() => import("@food/pages/admin/wallet/AddFund"));
const Bonus = lazy(() => import("@food/pages/admin/wallet/Bonus"));
const LoyaltyPointReport = lazy(() => import("@food/pages/admin/loyalty-point/Report"));
const SubscribedMailList = lazy(() => import("@food/pages/admin/SubscribedMailList"));
// Report Management
const TransactionReport = lazy(() => import("@food/pages/admin/reports/TransactionReport"));
const ExpenseReport = lazy(() => import("@food/pages/admin/reports/ExpenseReport"));
const DisbursementReportRestaurants = () => null;
const DisbursementReportDeliverymen = () => null;
const RegularOrderReport = lazy(() => import("@food/pages/admin/reports/RegularOrderReport"));
const CampaignOrderReport = lazy(() => import("@food/pages/admin/reports/CampaignOrderReport"));
const RestaurantReport = lazy(() => import("@food/pages/admin/reports/RestaurantReport"));
const FeedbackExperienceReport = lazy(() => import("@food/pages/admin/reports/FeedbackExperienceReport"));
const TaxReport = lazy(() => import("@food/pages/admin/reports/TaxReport"));
const RestaurantVATReport = () => null;
// Transaction Management
const RestaurantWithdraws = () => null;
const WithdrawMethod = lazy(() => import("@food/pages/admin/transactions/WithdrawMethod"));
// Employee Management
const EmployeeRole = lazy(() => import("@food/pages/admin/employees/EmployeeRole"));
const AddEmployee = lazy(() => import("@food/pages/admin/employees/AddEmployee"));
const EmployeeList = lazy(() => import("@food/pages/admin/employees/EmployeeList"));
// Business Settings
const BusinessSetup = lazy(() => import("@food/pages/admin/settings/BusinessSetup"));
const FeatureSettings = lazy(() => import("@food/pages/admin/settings/FeatureSettings"));
const PowerScanning = lazy(() => import("@food/pages/admin/settings/PowerScanning"));
const ZoneSetup = lazy(() => import("@food/pages/admin/system/ZoneSetup"));
const EmailTemplate = lazy(() => import("@food/pages/admin/settings/EmailTemplate"));
const ThemeSettings = lazy(() => import("@food/pages/admin/settings/ThemeSettings"));
const Gallery = lazy(() => import("@food/pages/admin/settings/Gallery"));
const LoginSetup = lazy(() => import("@food/pages/admin/settings/LoginSetup"));
const TermsAndCondition = lazy(() => import("@food/pages/admin/settings/TermsAndCondition"));
const PrivacyPolicy = lazy(() => import("@food/pages/admin/settings/PrivacyPolicy"));
const AboutUs = lazy(() => import("@food/pages/admin/settings/AboutUs"));
const RefundPolicy = lazy(() => import("@food/pages/admin/settings/RefundPolicy"));
const ShippingPolicy = lazy(() => import("@food/pages/admin/settings/ShippingPolicy"));
const CancellationPolicy = lazy(() => import("@food/pages/admin/settings/CancellationPolicy"));
const ReactRegistration = lazy(() => import("@food/pages/admin/settings/ReactRegistration"));
const SubscriptionSettings = lazy(() => import("@food/pages/admin/settings/SubscriptionSettings"));
const SubscriberList = lazy(() => import("@food/pages/admin/settings/SubscriberList"));
const SupportCMS = lazy(() => import("@food/pages/admin/settings/SupportCMS"));
const CoinSettings = lazy(() => import("@food/pages/admin/settings/CoinSettings"));
const CoinRequests = lazy(() => import("@food/pages/admin/settings/CoinRequests"));


// System Settings
const ThirdParty = lazy(() => import("@food/pages/admin/system/ThirdParty"));
const FirebaseNotification = lazy(() => import("@food/pages/admin/system/FirebaseNotification"));
const OfflinePaymentSetup = lazy(() => import("@food/pages/admin/system/OfflinePaymentSetup"));
const JoinUsPageSetup = lazy(() => import("@food/pages/admin/system/JoinUsPageSetup"));
const AnalyticsScript = lazy(() => import("@food/pages/admin/system/AnalyticsScript"));
const AISetup = lazy(() => import("@food/pages/admin/system/AISetup"));
const AppWebSettings = lazy(() => import("@food/pages/admin/system/AppWebSettings"));
const NotificationChannels = lazy(() => import("@food/pages/admin/system/NotificationChannels"));
const NotificationBroadcast = lazy(() => import("@food/pages/admin/system/NotificationBroadcast"));
const AdminNotifications = lazy(() => import("@food/pages/admin/system/AdminNotifications"));
const LandingPageSettings = lazy(() => import("@food/pages/admin/system/LandingPageSettings"));
const PageMetaData = lazy(() => import("@food/pages/admin/system/PageMetaData"));
const ReactSite = lazy(() => import("@food/pages/admin/system/ReactSite"));
const CleanDatabase = lazy(() => import("@food/pages/admin/system/CleanDatabase"));
const AddonActivation = lazy(() => import("@food/pages/admin/system/AddonActivation"));
const LandingPageManagement = lazy(() => import("@food/pages/admin/system/LandingPageManagement"));
// Dining Admin Removed
const AdminLogin = lazy(() => import("@food/pages/admin/auth/AdminLogin"));
const AdminSignup = lazy(() => import("@food/pages/admin/auth/AdminSignup"));
const AdminForgotPassword = lazy(() => import("@food/pages/admin/auth/AdminForgotPassword"));

function FeatureSettingsRouteGuard() {
  const adminUser = getCurrentUser("admin");
  if (!canAccessFeatureSettings(adminUser)) {
    return <Navigate to="/admin/food" replace />;
  }
  return <FeatureSettings />;
}

function SuperPowersRouteGuard({ children }) {
  const adminUser = getCurrentUser("admin");
  if (!canAccessSuperPowers(adminUser)) {
    return <Navigate to="/admin/food" replace />;
  }
  return children;
}

const AdminServicePlaceholder = lazy(() => import("./AdminServicePlaceholder"));

function UnregisteredRestaurantsRouteGuard() {
  const [loading, setLoading] = useState(true);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    const parseEnabled = (value, fallback = true) => {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
      }
      if (typeof value === "number") {
        if (value === 1) return true;
        if (value === 0) return false;
      }
      return fallback;
    };

    const load = async () => {
      try {
        const res = await adminAPI.getPublicFeatureSettings();
        const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
        const feature = rows.find((row) => row.key === "root_landing_and_unregistered_control");
        if (feature) {
          setIsEnabled(parseEnabled(feature.isEnabled, true));
        }
      } catch (_error) {
        // keep safe default (enabled) on API failure
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Loader />;
  if (!isEnabled) return <Navigate to="/admin/food/restaurants" replace />;
  return <UnregisteredRestaurants />;
}

export default function AdminRouter() {
  // Read admin theme on mount, restore user app theme on unmount
  useEffect(() => {
    const savedAdminTheme = localStorage.getItem('adminTheme') || 'light';
    if (savedAdminTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return () => {
      const savedTheme = localStorage.getItem('appTheme') || 'light';
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
  }, []);

  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Admin Auth Routes */}
        <Route path="login" element={<AuthRedirect module="admin"><AdminLogin /></AuthRedirect>} />
        <Route path="forgot-password" element={<AuthRedirect module="admin"><AdminForgotPassword /></AuthRedirect>} />
        <Route path="signup" element={<AuthRedirect module="admin"><AdminSignup /></AuthRedirect>} />

        {/* Protected Routes - With Layout */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {/* Default Admin Redirect */}
          <Route path="/" element={<Navigate to="food" replace />} />

          {/* FOOD ADMIN - All food related routes nested here */}
          <Route path="food/*">
            <Route index element={<AdminHome />} />
            <Route path="profile" element={<AdminProfile />} />
            <Route path="settings" element={<AdminSettings />} />
            
            {/* GLOBAL ORDERS */}
            <Route path="global-orders/:status" element={<GlobalOrdersPage />} />
            
            {/* ORDER MANAGEMENT */}
            <Route path="orders/all" element={<OrdersPage statusKey="all" />} />
            <Route path="orders/scheduled" element={<OrdersPage statusKey="scheduled" />} />
            <Route path="orders/pending" element={<OrdersPage statusKey="pending" />} />
            <Route path="orders/accepted" element={<OrdersPage statusKey="accepted" />} />
            <Route path="orders/processing" element={<OrdersPage statusKey="processing" />} />
            <Route path="orders/delivered" element={<OrdersPage statusKey="delivered" />} />
            <Route path="orders/canceled" element={<OrdersPage statusKey="canceled" />} />
            <Route path="orders/payment-failed" element={<OrdersPage statusKey="payment-failed" />} />
            <Route path="orders/refunded" element={<OrdersPage statusKey="refunded" />} />
            <Route path="orders/offline-payments" element={<OrdersPage statusKey="offline-payments" />} />
            <Route path="order-refunds/new" element={<NewRefundRequests />} />

            {/* ZONE MANAGEMENT */}
            <Route path="zones" element={<ZoneSetup />} />

            {/* RESTAURANT MANAGEMENT */}
            <Route path="restaurants" element={<RestaurantsList />} />
            <Route path="restaurant-commissions" element={<RestaurantCommissions />} />
            {/* Commented out as restaurant subscription flow is not currently needed
            <Route path="restaurants/subscription-settings" element={<SubscriptionSettings />} />
            <Route path="restaurants/subscription-history" element={<SubscriberList />} />
            */}

            {/* FOOD & CATEGORY MANAGEMENT */}
            <Route path="grocery-categories" element={<GroceryCategory />} />
            <Route path="grocery-products" element={<GroceryProductsList />} />

            {/* Accessories Routes */}
            <Route path="accessories-categories" element={<AccessoriesCategory />} />
            <Route path="accessories-products" element={<AccessoriesProductsList />} />
            <Route path="accessories-orders/:status" element={<AccessoriesOrdersPage />} />

            {/* Services Routes */}
            <Route path="categories" element={<Category />} />
            <Route path="fee-settings" element={<FeeSettings />} />
            <Route path="referral-settings" element={<ReferralSettings />} />
            <Route path="foods" element={<FoodsList />} />
            <Route path="food/list" element={<FoodsList />} />

            {/* GROCERY MANAGEMENT */}
            <Route path="grocery-product-approval" element={<AdminServicePlaceholder title="Product Approval" />} />
            <Route path="grocery-orders/all" element={<GroceryOrdersPage statusKey="all" />} />
            <Route path="grocery-orders/pending" element={<GroceryOrdersPage statusKey="pending" />} />
            <Route path="grocery-orders/accepted" element={<GroceryOrdersPage statusKey="accepted" />} />
            <Route path="grocery-orders/processing" element={<GroceryOrdersPage statusKey="processing" />} />
            <Route path="grocery-orders/delivered" element={<GroceryOrdersPage statusKey="delivered" />} />
            <Route path="grocery-orders/canceled" element={<GroceryOrdersPage statusKey="canceled" />} />
            <Route path="grocery-categories" element={<GroceryCategory />} />

            {/* SERVICE MANAGEMENT */}
            <Route path="services" element={<ServicesList />} />
            <Route path="service-addons" element={<AdminServicePlaceholder title="Service Addons List" />} />
            <Route path="bookings/all" element={<BookingsList statusFilter="all" />} />
            <Route path="bookings/pending" element={<BookingsList statusFilter="pending" />} />
            <Route path="bookings/completed" element={<BookingsList statusFilter="completed" />} />
            <Route path="service-categories" element={<ServiceCategories />} />

            {/* PROMOTIONS, CUSTOMERS, DELIVERYMEN, etc. */}
            <Route path="campaigns/basic" element={<BasicCampaign />} />
            <Route path="campaigns/food" element={<FoodCampaign />} />
            <Route path="coupons" element={<Coupons />} />
            <Route path="cashback" element={<Cashback />} />
            <Route path="banners" element={<Banners />} />
            <Route path="advertisement" element={<AdsList />} />
            <Route path="advertisement/new" element={<NewAdvertisement />} />
            <Route path="advertisement/requests" element={<AdRequests />} />
            
            <Route path="chattings" element={<Chattings />} />
            <Route path="contact-messages" element={<ContactMessages />} />
            <Route path="safety-emergency-reports" element={<SafetyEmergencyReports />} />
            
            <Route path="customers" element={<Customers />} />
            <Route path="support-tickets" element={<SupportTickets />} />
            <Route path="wallet/add-fund" element={<AddFund />} />
            <Route path="wallet/bonus" element={<Bonus />} />
            <Route path="loyalty-point/report" element={<LoyaltyPointReport />} />
            <Route path="subscribed-mail-list" element={<SubscribedMailList />} />

            {/* REPORTS & SETTINGS */}
            <Route path="transaction-report" element={<TransactionReport />} />
            <Route path="expense-report" element={<ExpenseReport />} />
            <Route path="disbursement-report/restaurants" element={<DisbursementReportRestaurants />} />
            <Route path="order-report/regular" element={<RegularOrderReport />} />
            <Route path="order-report/campaign" element={<CampaignOrderReport />} />
            <Route path="restaurant-report" element={<RestaurantReport />} />
            <Route path="customer-report/feedback-experience" element={<FeedbackExperienceReport />} />
            <Route path="tax-report" element={<TaxReport />} />
            <Route path="restaurant-vat-report" element={<RestaurantVATReport />} />
            
            <Route path="restaurant-withdraws" element={<RestaurantWithdraws />} />
            <Route path="withdraw-method" element={<WithdrawMethod />} />
            
            <Route path="employee-role" element={<EmployeeRole />} />
            <Route path="employees" element={<EmployeeList />} />
            <Route path="employees/add" element={<AddEmployee />} />

            {/* SYSTEM & BUSINESS SETTINGS */}
            <Route path="business-setup" element={<BusinessSetup />} />
            <Route path="feature-settings" element={<FeatureSettingsRouteGuard />} />
            <Route path="power-scanning" element={<SuperPowersRouteGuard><PowerScanning /></SuperPowersRouteGuard>} />
            <Route path="email-template" element={<EmailTemplate />} />
            <Route path="theme-settings" element={<ThemeSettings />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="login-setup" element={<LoginSetup />} />
            {/* Reward Coin System */}
            <Route path="coin-settings" element={<CoinSettings />} />
            <Route path="coin-requests" element={<CoinRequests />} />
            {/* PAGES & SOCIAL MEDIA */}
            <Route path="pages-social-media/terms" element={<TermsAndCondition />} />
            <Route path="pages-social-media/privacy" element={<PrivacyPolicy />} />
            <Route path="pages-social-media/support" element={<SupportCMS />} />
            <Route path="pages-social-media/about" element={<AboutUs />} />
            <Route path="pages-social-media/refund" element={<RefundPolicy />} />
            <Route path="pages-social-media/shipping" element={<ShippingPolicy />} />
            <Route path="pages-social-media/cancellation" element={<CancellationPolicy />} />
            <Route path="pages-social-media/react-registration" element={<ReactRegistration />} />

            <Route path="3rd-party-configurations/firebase" element={<FirebaseNotification />} />
            <Route path="3rd-party-configurations/offline-payment" element={<OfflinePaymentSetup />} />
            <Route path="3rd-party-configurations/join-us" element={<JoinUsPageSetup />} />
            <Route path="3rd-party-configurations/analytics" element={<AnalyticsScript />} />
            <Route path="3rd-party-configurations/ai" element={<AISetup />} />
            <Route path="app-web-settings" element={<AppWebSettings />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="broadcast-notification" element={<NotificationBroadcast />} />
            <Route path="notification-channels" element={<NotificationChannels />} />
            <Route path="landing-page-settings/admin" element={<LandingPageSettings type="admin" />} />
            <Route path="landing-page-settings/react" element={<LandingPageSettings type="react" />} />
            <Route path="page-meta-data" element={<PageMetaData />} />
            <Route path="react-site" element={<ReactSite />} />
            <Route path="clean-database" element={<CleanDatabase />} />
            <Route path="addon-activation" element={<AddonActivation />} />
            <Route path="hero-banner-management" element={<LandingPageManagement />} />
            {/* Dining Management Removed */}
          </Route>

          {/* TAXI ADMIN - Placeholder for future implementation */}
          <Route path="taxi/*" element={<div className="p-8 text-center text-gray-500 bg-white min-h-[50vh] flex items-center justify-center border rounded-xl m-4">Taxi Administration - Coming Soon</div>} />

          {/* QUICK COMMERCE ADMIN - Placeholder for future implementation */}
          <Route path="quick-commerce/*" element={<div className="p-8 text-center text-gray-500 bg-white min-h-[50vh] flex items-center justify-center border rounded-xl m-4">Quick Commerce Administration - Coming Soon</div>} />
        </Route>

        {/* Redirect unknown admin routes to food admin */}
        <Route path="*" element={<Navigate to="/admin/food" replace />} />
      </Routes>
    </Suspense>
  );
}
