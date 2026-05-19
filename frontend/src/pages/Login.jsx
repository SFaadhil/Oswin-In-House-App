import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatApiError } from "../utils/api";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

const LOGO_URL = "https://customer-assets.emergentagent.com/job_brave-snyder-5/artifacts/s24znd7d_image.png";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#006538] relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #006538 0%, #009d44 100%)" }} />
        <div className="relative z-10 flex flex-col justify-center px-12 max-w-lg">
          <div className="mb-10">
            <div className="inline-block bg-white rounded-xl p-2 mb-6 shadow-lg">
              <img src={LOGO_URL} alt="Oswin Ply" className="h-14 w-14 object-contain" onError={e => e.target.style.display = 'none'} />
            </div>
            <h2 className="text-4xl font-light text-white mb-4" style={{ fontFamily: "Chivo" }}>Manage every resource, <span className="font-bold">effortlessly.</span></h2>
            <p className="text-green-100 text-base leading-relaxed">Track subscriptions, analyse spending by person & category, and secure your credentials — all in one place.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[["Role-Based Access", "MD, Manager & Team"], ["Smart Reports", "Category & person-wise"], ["Password Vault", "Encrypted credentials"], ["Due Alerts", "Never miss a renewal"]].map(([t, d]) => (
              <div key={t} className="bg-white/10 backdrop-blur rounded-lg p-3 border border-white/20">
                <p className="text-sm font-semibold text-white">{t}</p>
                <p className="text-xs text-green-100 mt-0.5">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <div className="inline-block bg-white rounded-xl p-1.5 shadow-md border border-border">
              <img src={LOGO_URL} alt="Oswin Ply" className="h-10 w-10 object-contain" onError={e => e.target.style.display='none'} />
            </div>
          </div>
          <h1 className="text-3xl font-light text-foreground mb-1" style={{ fontFamily: "Chivo" }}>Sign in</h1>
          <p className="text-muted-foreground text-sm mb-8">Enter your credentials to access your dashboard</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email address</label>
              <input id="email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required
                className="w-full bg-card border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder:text-muted-foreground"
                placeholder="you@company.com" data-testid="login-email-input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <input id="password" type={showPass ? "text" : "password"} value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required
                  className="w-full bg-card border border-border rounded-lg px-4 py-2.5 pr-10 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder:text-muted-foreground"
                  placeholder="••••••••" data-testid="login-password-input" />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} data-testid="login-submit-button"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-50">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary hover:text-primary/80 font-medium" data-testid="register-link">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
