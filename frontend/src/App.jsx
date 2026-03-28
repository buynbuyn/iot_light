import Dashboard from "./pages/Dashboard"
import AdminLayout from "./layouts/AdminLayout"
import AlertPage from "./pages/AlertsPage";

function App() {

  return (
    <BrowserRouter>

      <AdminLayout>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/alerts" element={<AlertPage />} />
        </Routes>

      </AdminLayout>

    </BrowserRouter>
  )
}

export default App