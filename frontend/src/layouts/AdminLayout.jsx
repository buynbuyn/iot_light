import Navbar from "../components/Navbar";
import Sidebar from "../components/SideBar";
import { Outlet } from "react-router-dom";
import React from "react";

export default function AdminLayout() {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

      <Sidebar />

      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100vh"
      }}>

        <Navbar />

        <div style={{
          flex: 1,
          padding: "20px",
          overflowY: "auto",
          backgroundColor: "#f4f7fe"
        }}>
          <Outlet />
        </div>

      </div>

    </div>
  );
}