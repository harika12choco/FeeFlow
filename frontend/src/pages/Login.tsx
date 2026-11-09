import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button, Field, Input } from "../components/ui";
import { Logo } from "../components/Logo";
import { LoginArt } from "../components/LoginArt";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarClock,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";

// Demo-only credentials. These unlock ONLY fictional assessment/sample data —
// they are not production credentials and expose no real user information.
// Used solely to auto-fill the form when a demo card is clicked.
const DEMO_PASSWORD = "Passw0rd!";

const DEMO = [
  { label: "Accounts executive", email: "accounts@feeflow.app", icon: ShieldCheck, password: DEMO_PASSWORD },
  { label: "Parent (Ishita Sharma)", email: "parent@feeflow.app", icon: Users, password: DEMO_PASSWORD },
];

const FEATURES = [
  { label: "Fee collection", icon: Wallet },
  { label: "Instalments", icon: CalendarClock },
  { label: "Reminders", icon: BellRing },
  { label: "Parent portal", icon: Smartphone },
];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate(user.role === "accounts" ? "/" : "/portal", { replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const u = await login(email.trim(), password);
      navigate(u.role === "accounts" ? "/" : "/portal", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-navy-50/40">
      {/* ------------------------------------------------ Branding panel */}
      <aside className="relative hidden w-[54%] max-w-[760px] lg:block">
        {/* Background: soft indigo gradient, dot grid, blurred blobs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white via-accent-50 to-navy-100" />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: "radial-gradient(#c7d2fe 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-accent-200/40 blur-3xl" />
          <div className="absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-accent-100/50 blur-3xl" />
        </div>

        <div className="relative z-10 flex h-full max-h-screen flex-col justify-between overflow-y-auto p-10 xl:p-14">
          <Logo />

          <div className="py-8">
            <h1 className="max-w-md text-3xl font-extrabold leading-[1.12] tracking-tight text-navy-900 xl:text-[2.6rem]">
              Every rupee, every instalment — in one calm dashboard.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-navy-500">
              FeeFlow gives your accounts team a crystal-clear fee ledger and gives parents a
              simple place to pay — with reminders that stop the moment a payment lands.
            </p>

            <div className="mt-9">
              <LoginArt />
            </div>

            <div className="mt-9 grid max-w-md grid-cols-2 gap-3 xl:grid-cols-4">
              {FEATURES.map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/70 px-3 py-2 backdrop-blur-sm"
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate text-xs font-semibold text-navy-700">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-navy-400">
            Assessment demo · all data shown is invented sample data.
          </p>
        </div>
      </aside>

      {/* ---------------------------------------------------- Form panel */}
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
          <div className="mb-7 flex flex-col items-center gap-4 text-center lg:hidden">
            <Logo />
            <p className="max-w-xs text-sm text-navy-400">
              Fee tracking for your institute and a simple portal for parents.
            </p>
          </div>

          <div className="ff-card p-6 shadow-card-hover sm:p-8">
            <h2 className="text-2xl font-extrabold tracking-tight text-navy-900">Sign in</h2>
            <p className="mt-1 text-sm text-navy-400">Welcome back. Pick a demo account to explore.</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@institute.com"
                  autoComplete="username"
                  required
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Button
                type="submit"
                loading={loading}
                className="w-full"
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Sign in
              </Button>
            </form>

            <div className="mt-7 border-t border-navy-100 pt-6">
              <p className="ff-label">Demo accounts · click to fill</p>
              <div className="space-y-2">
                {DEMO.map(({ label, email: demoEmail, icon: Icon, password: demoPassword }) => (
                  <button
                    key={demoEmail}
                    type="button"
                    onClick={() => {
                      setEmail(demoEmail);
                      setPassword(demoPassword);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-navy-100 bg-white px-3.5 py-2.5 text-left transition hover:border-accent-300 hover:bg-accent-50/50"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-navy-800">{label}</span>
                      <span className="block truncate text-xs text-navy-400">{demoEmail}</span>
                    </span>
                    <span className="text-xs font-semibold text-accent-600">Use</span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-navy-400">
                Selecting a card fills in the email and password automatically.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
