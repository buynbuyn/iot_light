import React from "react";
import { createBrowserRouter } from "react-router-dom";
import AdminLayout from "../layouts/AdminLayout";
import Dashboard from "../pages/Dashboard";
import AlertPage from "../pages/AlertsPage";

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
      }
    ]
  }
]);

export default router;