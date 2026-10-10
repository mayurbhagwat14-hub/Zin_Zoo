export const adminSidebarMenu = [
  {
    type: "link",
    label: "Dashboard",
    path: "/admin/food",
    icon: "LayoutDashboard",
  },

  {
    type: "section",
    label: "FOOD MANAGEMENT",
    items: [

      {
        type: "link",
        label: "Foods List",
        icon: "Utensils",
        path: "/admin/food/foods",
      },
      {
        type: "link",
        label: "Categories",
        icon: "FolderTree",
        path: "/admin/food/categories",
      },
      {
        type: "expandable",
        label: "Orders",
        icon: "FileText",
        subItems: [
          { label: "All Orders", path: "/admin/food/orders/all" },
          { label: "Pending Orders", path: "/admin/food/orders/pending" },
          { label: "Accepted Orders", path: "/admin/food/orders/accepted" },
          { label: "Processing Orders", path: "/admin/food/orders/processing" },
          { label: "Delivered Orders", path: "/admin/food/orders/delivered" },
          { label: "Canceled Orders", path: "/admin/food/orders/canceled" },
        ],
      },
    ],
  },
  {
    type: "section",
    label: "RESTAURANT MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Restaurants List",
        icon: "Building2",
        path: "/admin/food/restaurants",
      },
      /* Commented out as restaurant subscription flow is not currently needed
      {
        type: "expandable",
        label: "Restaurants",
        icon: "Building2",
        subItems: [
          { label: "Restaurants List", path: "/admin/food/restaurants" },
          { label: "Subscription Settings", path: "/admin/food/restaurants/subscription-settings" },
          { label: "Subscription History", path: "/admin/food/restaurants/subscription-history" },
        ],
      },
      */
      {
        type: "link",
        label: "Restaurant Commissions",
        icon: "DollarSign",
        path: "/admin/food/restaurant-commissions",
      },
    ],
  },
  {
    type: "section",
    label: "GROCERY MANAGEMENT",
    items: [
      {
        type: "expandable",
        label: "Products",
        icon: "ShoppingBag",
        subItems: [
          { label: "Products List", path: "/admin/food/grocery-products" },
        ],
      },
      {
        type: "expandable",
        label: "Grocery Orders",
        icon: "FileText",
        subItems: [
          { label: "All Orders", path: "/admin/food/grocery-orders/all" },
          { label: "Pending Orders", path: "/admin/food/grocery-orders/pending" },
          { label: "Accepted Orders", path: "/admin/food/grocery-orders/accepted" },
          { label: "Processing Orders", path: "/admin/food/grocery-orders/processing" },
          { label: "Delivered Orders", path: "/admin/food/grocery-orders/delivered" },
          { label: "Canceled Orders", path: "/admin/food/grocery-orders/canceled" },
        ],
      },
      {
        type: "link",
        label: "Categories",
        icon: "LayoutGrid",
        path: "/admin/food/grocery-categories",
      },
    ],
  },
  {
    type: "section",
    label: "ACCESSORIES MANAGEMENT",
    items: [
      {
        type: "expandable",
        label: "Products",
        icon: "Watch",
        subItems: [
          { label: "Products List", path: "/admin/food/accessories-products" },
        ],
      },
      {
        type: "expandable",
        label: "Accessories Orders",
        icon: "FileText",
        subItems: [
          { label: "All Orders", path: "/admin/food/accessories-orders/all" },
          { label: "Pending Orders", path: "/admin/food/accessories-orders/pending" },
          { label: "Accepted Orders", path: "/admin/food/accessories-orders/accepted" },
          { label: "Processing Orders", path: "/admin/food/accessories-orders/processing" },
          { label: "Delivered Orders", path: "/admin/food/accessories-orders/delivered" },
          { label: "Canceled Orders", path: "/admin/food/accessories-orders/canceled" },
        ],
      },
      {
        type: "link",
        label: "Categories",
        icon: "LayoutGrid",
        path: "/admin/food/accessories-categories",
      },
    ],
  },
  {
    type: "section",
    label: "SERVICE MANAGEMENT",
    items: [

      {
        type: "expandable",
        label: "Services",
        icon: "Briefcase",
        subItems: [
          { label: "Services List", path: "/admin/food/services" },
        ],
      },
      {
        type: "expandable",
        label: "Bookings",
        icon: "Calendar",
        subItems: [
          { label: "All Bookings", path: "/admin/food/bookings/all" },
          { label: "Pending Bookings", path: "/admin/food/bookings/pending" },
          { label: "Completed Bookings", path: "/admin/food/bookings/completed" },
        ],
      },
      {
        type: "link",
        label: "Categories",
        icon: "LayoutGrid",
        path: "/admin/food/service-categories",
      },
    ],
  },


  {
    type: "section",
    label: "PROMOTIONS & REWARDS",
    items: [
      { type: "link", label: "Offers & Coupons", path: "/admin/food/coupons", icon: "Megaphone" },
      { type: "link", label: "Referral Settings", path: "/admin/food/referral-settings", icon: "Gift" },
      { type: "link", label: "Reward Coin Settings", path: "/admin/food/coin-settings", icon: "Coins" },
      { type: "link", label: "Coin Requests", path: "/admin/food/coin-requests", icon: "FileSpreadsheet" },
    ],
  },

  {
    type: "section",
    label: "CUSTOMER MANAGEMENT",
    items: [
      {
        type: "link",
        label: "Customers",
        path: "/admin/food/customers",
        icon: "Users",
      },
    ],
  },
  // {

  {
    type: "section",
    label: "HELP & SUPPORT",
    items: [
      { type: "link", label: "Support Tickets", path: "/admin/food/support-tickets", icon: "MessageSquare" },
      { type: "link", label: "User Feedback", path: "/admin/food/contact-messages", icon: "Mail" },
      { type: "link", label: "Safety Emergency Reports", path: "/admin/food/safety-emergency-reports", icon: "AlertTriangle" },
    ],
  },
  {
    type: "section",
    label: "REPORT MANAGEMENT",
    items: [
      { type: "link", label: "Transaction Report", path: "/admin/food/transaction-report", icon: "FileText" },
      { type: "link", label: "Order Report", path: "/admin/food/order-report/regular", icon: "FileText" },
      { type: "link", label: "Restaurant Report", path: "/admin/food/restaurant-report", icon: "FileText" },
      { type: "link", label: "Tax Report", path: "/admin/food/tax-report", icon: "Receipt" },
      {
        type: "expandable",
        label: "Customer Report",
        icon: "FileText",
        subItems: [{ label: "Feedback Experience", path: "/admin/food/customer-report/feedback-experience" }],
      },
    ],
  },

  {
    type: "section",
    label: "BANNER SETTINGS",
    items: [
      { type: "link", label: "Landing Page Management", path: "/admin/food/hero-banner-management", icon: "Image" },
      // { type: "link", label: "General Banners", path: "/admin/food/banners", icon: "Image" },
    ],
  },

  {
    type: "section",
    label: "SYSTEM SETTINGS",
    items: [
      { type: "link", label: "Zone Setup", path: "/admin/food/zones", icon: "MapPin" },
      { type: "link", label: "Delivery & Fee Settings", path: "/admin/food/fee-settings", icon: "CreditCard" },
      { type: "link", label: "Broadcast Notification", path: "/admin/food/broadcast-notification", icon: "Bell" },
      { type: "link", label: "Business Setup", path: "/admin/food/business-setup", icon: "Settings" },
    ],
  },
  {
    type: "section",
    label: "SUPER POWERS",
    items: [
      { type: "link", label: "Feature Settings", path: "/admin/food/feature-settings", icon: "Settings" },
      { type: "link", label: "Power Scanning", path: "/admin/food/power-scanning", icon: "Zap" },
    ],
  },
  {
    type: "section",
    label: "PAGES & SOCIAL MEDIA",
    items: [
      { type: "link", label: "About Us", path: "/admin/food/pages-social-media/about", icon: "Globe" },
      { type: "link", label: "Terms & Conditions", path: "/admin/food/pages-social-media/terms", icon: "FileText" },
      { type: "link", label: "Privacy Policy", path: "/admin/food/pages-social-media/privacy", icon: "Lock" },
      { type: "link", label: "Support", path: "/admin/food/pages-social-media/support", icon: "Headset" },
      { type: "link", label: "Refund Policy", path: "/admin/food/pages-social-media/refund", icon: "Receipt" },
      { type: "link", label: "Shipping Policy", path: "/admin/food/pages-social-media/shipping", icon: "Truck" },
      { type: "link", label: "Cancellation Policy", path: "/admin/food/pages-social-media/cancellation", icon: "X" },
    ],
  },
];
