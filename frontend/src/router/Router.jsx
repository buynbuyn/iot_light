import React from "react";
import { createBrowserRouter } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout";
import Dashboard from "../pages/Dashboard";
import AlertPage from "../pages/AlertsPage";
import ReportPage from "../pages/Report";
import SystemManagement from "../pages/Systemmanagement";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <Dashboard />
      },
      {
        path: "alerts",      
        element: <AlertPage />
      },
      {
        path: "reports",      
        element: <ReportPage />
      },
      {
        path: "system-management",      
        element: <SystemManagement />
      }
    ]
  }
]);

export default router;