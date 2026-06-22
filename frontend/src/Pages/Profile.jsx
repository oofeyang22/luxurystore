import React, { useContext, useEffect, useRef, useState } from "react";
import { ShopContext } from "../context/ShopContext";
import axios from "axios";
import { toast } from "react-toastify";

const Profile = () => {
  const { token, backendUrl, navigate, setToken, setCartItems } = useContext(ShopContext);
  const [user, setUser] = useState({ name: "", email: "", profilePicture: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [confirmModal, setConfirmModal] = useState(null); 
  const fileRef = useRef();

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    axios
      .get(`${backendUrl}/api/user/profile`, { headers: { token } })
      .then(({ data }) => {
        if (data.success) setUser(data.user);
        else toast.error(data.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("name", user.name);
      formData.append("email", user.email);
      if (imageFile) formData.append("image", imageFile);

      const { data } = await axios.post(`${backendUrl}/api/user/profile`, {}, { headers: { token } });
      if (data.success) {
        setUser(data.user);
        setImageFile(null);
        toast.success("Profile updated");
      } else toast.error(data.message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      const { data } = await axios.patch(
        `${backendUrl}/api/user/deactivate`, {}, { headers: { token } }
      );
      if (data.success) {
        toast.success("Account deactivated");
        localStorage.removeItem("token");
        setToken(""); setCartItems({});
        navigate("/login");
      } else toast.error(data.message);
    } catch (err) { toast.error(err.message); }
  };

  const handleDelete = async () => {
    try {
      const { data } = await axios.delete(`${backendUrl}/api/user/profile`, {
        headers: { token },
      });
      if (data.success) {
        toast.success("Account deleted");
        localStorage.removeItem("token");
        setToken(""); setCartItems({});
        navigate("/login");
      } else toast.error(data.message);
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-[60vh] text-gray-500 text-sm">
      Loading profile...
    </div>
  );

  const avatarSrc = preview || user.profilePicture;

  return (
    <div className="max-w-lg mx-auto py-10 px-4">
      {/* Avatar + name header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="relative w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden cursor-pointer flex-shrink-0"
          onClick={() => fileRef.current.click()}
        >
          {avatarSrc ? (
            <img src={avatarSrc} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-blue-600 font-medium text-xl">{initials}</span>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-black/40 flex items-center justify-center h-7">
            <span className="text-white text-xs">Edit</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </div>
        <div>
          <p className="text-lg font-medium text-gray-900">{user.name || "Your Name"}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>

      {/* Personal info card */}
      <div className="border border-gray-200 rounded-xl p-5 mb-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-4">Personal info</p>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Full name</label>
            <input
              type="text"
              value={user.name}
              onChange={(e) => setUser({ ...user, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Email address</label>
            <input
              type="email"
              value={user.email}
              onChange={(e) => setUser({ ...user, email: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>
        </div>
        <div className="flex justify-end mt-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-gray-900 cursor-pointer text-white text-sm px-5 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="border border-red-200 rounded-xl p-5">
        <p className="text-xs font-medium text-red-400 uppercase tracking-widest mb-4">Account actions</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-red-600 mb-1">Deactivate account</p>
            <p className="text-xs text-gray-500 mb-3">Temporarily disable your account. Reactivate any time by logging back in.</p>
            <button
              onClick={() => setConfirmModal("deactivate")}
              className="text-sm border cursor-pointer border-red-300 text-red-500 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              Deactivate
            </button>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-600 mb-1">Delete account</p>
            <p className="text-xs text-gray-500 mb-3">Permanently erase your account and all data. This cannot be undone.</p>
            <button
              onClick={() => setConfirmModal("delete")}
              className="text-sm border cursor-pointer border-red-300 text-red-500 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete account
            </button>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-[90%] border border-red-200">
            <p className="font-medium text-red-600 mb-2">
              {confirmModal === "delete" ? "Delete account permanently?" : "Deactivate account?"}
            </p>
            <p className="text-sm text-gray-500 mb-5">
              {confirmModal === "delete"
                ? "All your orders, preferences, and data will be erased. This cannot be undone."
                : "Your account will be paused. You can reactivate by logging back in."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="text-sm border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmModal(null);
                  confirmModal === "delete" ? handleDelete() : handleDeactivate();
                }}
                className="text-sm border border-red-300 text-red-500 px-4 py-2 rounded-lg hover:bg-red-50"
              >
                {confirmModal === "delete" ? "Yes, delete" : "Yes, deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;