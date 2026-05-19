import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api, { formatApiError } from "../utils/api";
import { toast } from "sonner";
import { CreditCard, Eye, EyeOff } from "lucide-react";

export default function Register() {
  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "User" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await api.post("/auth/register", form);
      const { access_token, ...userData } = res.data;
      if (access_token) localStorage.setItem("subtrack_token", access_token);
      // Now login to set user state
      await login(form.email, form.password);
      toast.success("Account created successfully!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 bg-[#3B82F6] rounded flex items-center justify-center">
            <CreditCard size={16} className="text-white" />
          </div>
          <span className="font-bold text-[#F8FAFC]" style={{ fontFamily: "Chivo" }}>SubTrack Pro</span>
        </div>
        <h1 className="text-3xl font-light text-[#F8FAFC] mb-2" style={{ fontFamily: "Chivo" }}>Create account</h1>
        <p className="text-[#64748B] text-sm mb-8">Start managing your subscriptions today</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[#94A3B8] mb-1.5">Full Name</label>
            <input type="text" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} required
              className="w-full bg-[#14151C] border border-[#1E202B] rounded px-4 py-2.5 text-[#F8FAFC] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition-all"
              placeholder="John Doe" data-testid="register-name-input" />
          </div>
          <div>
            <label className="block text-sm text-[#94A3B8] mb-1.5">Email address</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required
              className="w-full bg-[#14151C] border border-[#1E202B] rounded px-4 py-2.5 text-[#F8FAFC] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition-all"
              placeholder="you@company.com" data-testid="register-email-input" />
          </div>
          <div>
            <label className="block text-sm text-[#94A3B8] mb-1.5">Password</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required
                className="w-full bg-[#14151C] border border-[#1E202B] rounded px-4 py-2.5 pr-10 text-[#F8FAFC] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition-all"
                placeholder="Min. 8 characters" data-testid="register-password-input" />
              <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#94A3B8]">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#94A3B8] mb-1.5">Role</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              className="w-full bg-[#14151C] border border-[#1E202B] rounded px-4 py-2.5 text-[#F8FAFC] text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition-all"
              data-testid="register-role-select">
              <option value="User">User</option>
              <option value="Manager">Manager</option>
              <option value="MD">Managing Director</option>
            </select>
            {form.role !== "User" && <p className="text-xs text-[#FACC15] mt-1">MD/Manager roles will require approval by admin.</p>}
          </div>
          <button type="submit" disabled={loading} data-testid="register-submit-button"
            className="w-full bg-[#3B82F6] hover:bg-[#60A5FA] text-white rounded py-2.5 text-sm font-medium transition-colors disabled:opacity-50 mt-2">
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-[#64748B] mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-[#3B82F6] hover:text-[#60A5FA] transition-colors" data-testid="login-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
