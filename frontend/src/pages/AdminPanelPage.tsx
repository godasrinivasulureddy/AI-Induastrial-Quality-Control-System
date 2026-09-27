import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Shield, Users, Edit, Trash2, Check, X, ShieldAlert } from "lucide-react";

import { useAppStore } from "../store/useAppStore";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Panel } from "../components/ui/panel";
import { Badge } from "../components/ui/badge";

interface AdminUser {
  id: number;
  email: string;
  is_active: boolean;
  is_admin: boolean;
}

export function AdminPanelPage() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    is_active: false,
    is_admin: false,
  });

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<AdminUser[]>("/users/");
      setUsersList(response.data);
    } catch (err: any) {
      console.error("Failed to fetch users:", err);
      setError(err.response?.data?.detail || "Failed to load operator database.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && !user.is_admin) {
      setError("Access Denied: Only administrators can view this page.");
      setLoading(false);
      return;
    }
    fetchUsers().catch(() => undefined);
  }, [user]);

  const handleEditClick = (target: AdminUser) => {
    setSelectedUser(target);
    setEditFormData({
      is_active: target.is_active,
      is_admin: target.is_admin,
    });
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!selectedUser) return;

    try {
      await api.put(`/users/${selectedUser.id}`, editFormData);
      setSuccess(`Operator ${selectedUser.email} status updated!`);
      handleModalClose();
      await fetchUsers();
    } catch (err: any) {
      console.error("Failed to update user:", err);
      setError(err.response?.data?.detail || "Failed to save user updates.");
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm("Are you sure you want to delete this operator record?")) return;
    setError("");
    setSuccess("");
    try {
      await api.delete(`/users/${userId}`);
      setSuccess("Operator removed successfully.");
      setUsersList(usersList.filter((item) => item.id !== userId));
    } catch (err: any) {
      console.error("Failed to delete user:", err);
      setError(err.response?.data?.detail || "Failed to delete operator.");
    }
  };

  if (loading) {
    return <div className="text-zinc-400">Verifying secure admin authorization...</div>;
  }

  if (error && !usersList.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert className="h-16 w-16 text-rose-400" />
        <h2 className="mt-4 text-2xl font-bold text-white">Access Denied</h2>
        <p className="mt-2 text-zinc-500 max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge className="mb-3 border-cyan-300/30 bg-cyan-300/10 text-cyan-100">OptiVision Operations Control</Badge>
          <h1 className="text-4xl font-semibold text-white">Admin Management</h1>
          <p className="mt-2 text-zinc-400">Review operations logins, modify operator statuses, and delete user entries.</p>
        </div>
      </div>

      {success && <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 p-4 text-center text-sm text-emerald-200">{success}</div>}
      {error && <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-center text-sm text-rose-200">{error}</div>}

      <Panel className="p-6">
        <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Users className="h-5 w-5 text-cyan-300" />
          Active Operators
        </h3>
        {usersList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="text-zinc-500 border-b border-white/5 uppercase text-xs">
                <tr>
                  <th className="pb-3">ID</th>
                  <th className="pb-3">Email Address</th>
                  <th className="pb-3">Active Status</th>
                  <th className="pb-3">Admin Privileges</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {usersList.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition">
                    <td className="py-4">{item.id}</td>
                    <td className="py-4 font-semibold text-white">{item.email}</td>
                    <td className="py-4">
                      {item.is_active ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs">
                          <Check className="h-3.5 w-3.5" />
                          Enabled
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-zinc-500 text-xs">
                          <X className="h-3.5 w-3.5" />
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="py-4">
                      {item.is_admin ? (
                        <span className="flex items-center gap-1 text-cyan-400 text-xs font-semibold">
                          <Shield className="h-3.5 w-3.5" />
                          Admin
                        </span>
                      ) : (
                        <span className="text-zinc-500 text-xs">Standard</span>
                      )}
                    </td>
                    <td className="py-4 text-right space-x-2">
                      <Button variant="secondary" onClick={() => handleEditClick(item)}>
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => handleDeleteUser(item.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-zinc-500">No operator database logs available.</p>
        )}
      </Panel>

      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md border border-white/10 bg-surface-900 p-8 rounded-xl shadow-2xl"
          >
            <h2 className="text-2xl font-bold text-white mb-6">Modify: {selectedUser.email}</h2>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-4">
                <div>
                  <p className="text-sm font-semibold text-white">Operator Active State</p>
                  <p className="text-xs text-zinc-500">Allows/denies logging into dashboard.</p>
                </div>
                <input
                  type="checkbox"
                  name="is_active"
                  className="h-5 w-5 accent-cyan-300"
                  checked={editFormData.is_active}
                  onChange={handleFormChange}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-4">
                <div>
                  <p className="text-sm font-semibold text-white">Administrator access</p>
                  <p className="text-xs text-zinc-500">Grants user role control permissions.</p>
                </div>
                <input
                  type="checkbox"
                  name="is_admin"
                  className="h-5 w-5 accent-cyan-300"
                  checked={editFormData.is_admin}
                  onChange={handleFormChange}
                />
              </div>

              <div className="flex justify-end space-x-4 pt-6">
                <Button variant="secondary" type="button" onClick={handleModalClose}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save Changes
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
export default AdminPanelPage;
