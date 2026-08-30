import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import Nav from '../Admin/nav/Nav';
import Dashboard from '../Admin/dashboard/Dashboard';
import TopNav from '../Admin/nav/TopNav';
import BlogDash from '../Admin/blog/BlogDash';
import BlogEditForm from '../Admin/blog/BlogEditForm';
import ReadBlog from '../Admin/blog/ReadBlog';
import { useAdminContext } from '../context/AdminContext';
import AdminLogin from '../Admin/Signin/AdminLogin';
import AdminPrivateRoute from './AdminPrivateRoute';
import ManageCar from '../Admin/ManageCar/ManageCar';
import ManageRide from '../Admin/ManageRide/ManageRide';
import ManageUser from '../Admin/ManageUser/ManageUser';
import ManageMessages from '../Admin/ManageMessages/ManageMessages';
import ManageTestimonials from '../Admin/ManageTestimonials/ManageTestimonials';
import ManageFormEntries from '../Admin/ManageFormEntries/ManageFormEntries';
import '../Admin/admin-theme.css';

const AdminLayout = () => {
  const location = useLocation();
  const { admin } = useAdminContext();
  const isLogin = location.pathname === '/admin/login';

  if (isLogin) {
    return (
      <Routes>
        <Route
          path="/admin/login"
          element={admin ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />}
        />
      </Routes>
    );
  }

  return (
    <div className="admin-shell">
      <Nav />
      <div className="admin-workspace">
        <TopNav />
        <main className="admin-main">
          <Routes>
            <Route
              path="/admin"
              element={
                admin ? (
                  <Navigate to="/admin/dashboard" replace />
                ) : (
                  <Navigate to="/admin/login" replace />
                )
              }
            />

            <Route
              path="/admin/dashboard"
              element={
                <AdminPrivateRoute>
                  <Dashboard />
                </AdminPrivateRoute>
              }
            />

            <Route
              path="/admin/blog"
              element={
                <AdminPrivateRoute>
                  <BlogDash />
                </AdminPrivateRoute>
              }
            />
            <Route
              path="/admin/blog/:name"
              element={
                <AdminPrivateRoute>
                  <ReadBlog />
                </AdminPrivateRoute>
              }
            />
            <Route
              path="/admin/blog/edit"
              element={
                <AdminPrivateRoute>
                  <BlogEditForm />
                </AdminPrivateRoute>
              }
            />

            <Route
              path="/admin/manage-cars"
              element={
                <AdminPrivateRoute>
                  <ManageCar />
                </AdminPrivateRoute>
              }
            />

            <Route
              path="/admin/manage-rides"
              element={
                <AdminPrivateRoute>
                  <ManageRide />
                </AdminPrivateRoute>
              }
            />

            <Route
              path="/admin/manage-users"
              element={
                <AdminPrivateRoute>
                  <ManageUser />
                </AdminPrivateRoute>
              }
            />

            <Route
              path="/admin/manage-contacts"
              element={
                <AdminPrivateRoute>
                  <ManageMessages />
                </AdminPrivateRoute>
              }
            />

            <Route
              path="/admin/manage-form-entries"
              element={
                <AdminPrivateRoute>
                  <ManageFormEntries />
                </AdminPrivateRoute>
              }
            />

            <Route
              path="/admin/manage-testimonials"
              element={
                <AdminPrivateRoute>
                  <ManageTestimonials />
                </AdminPrivateRoute>
              }
            />

            <Route
              path="/admin/login"
              element={admin ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
