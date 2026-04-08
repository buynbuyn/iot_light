import Navbar from "../components/Navbar";
import Sidebar from "../components/SideBar";
import { Outlet } from "react-router-dom";
import React from "react";

export default function AdminLayout() {
  return (
    <div style={{ display: "flex" }}>

      <Sidebar />

      <div style={{ flex: 1 }}>
        <Navbar />

        <div style={{ padding: "20px" }}>
          <Outlet />
        </div>

      </div>

    </div>
  );
}