import { useState } from 'react';
import { LogIn, ScanBarcode, ShieldCheck, WifiOff, Eye, EyeOff } from 'lucide-react';
import { loginSchema } from '@shared/schemas/index.js';
import { useAuth } from '@/context/AuthContext.jsx';
import { useForm } from '@/hooks/useForm.js';
import { useToast } from '@/context/ToastContext.jsx';
import { Button, TextInput } from '@/components/ui/index.js';
import logo from '@/assets/logo.jpg';

export function LoginPage() {
  const { signIn } = useAuth();
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm(loginSchema, { username: '', password: '' });

  const submit = form.handleSubmit(async (values) => {
    const user = await signIn(values);
    toast.success(`Welcome, ${user.fullName.split(' ')[0]}`);
  });

  return (
    <div className="auth-screen">
      <section className="auth-hero">
        <img className="auth-hero-logo" src={logo} alt="Sriya Motors (Pvt) Ltd" />
        <div>
          <h1>
            Genuine parts. <span>Fast billing.</span>
          </h1>
          <p>Scan, bill and track every spare part in the shop — sales, stock and returns in one place.</p>
        </div>
        <div className="auth-hero-points">
          <div>
            <ScanBarcode size={16} /> Barcode billing
          </div>
          <div>
            <ShieldCheck size={16} /> Role based access
          </div>
          <div>
            <WifiOff size={16} /> Works offline
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit} noValidate>
          <h2>Sign in</h2>
          <p>Enter your user name and password to continue.</p>
          <div className="stack">
            <TextInput
              label="User name"
              size="lg"
              autoFocus
              autoComplete="username"
              {...form.bind('username')}
              error={form.errors.username}
            />
            <div style={{ position: 'relative' }}>
              <TextInput
                label="Password"
                size="lg"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                {...form.bind('password')}
                error={form.errors.password}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                style={{ position: 'absolute', right: 8, top: 34 }}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              block
              icon={LogIn}
              loading={form.submitting}
              className="mt-2"
            >
              Sign in
            </Button>
          </div>
          <p className="muted small mt-3 text-center">Forgot your password? Ask the shop admin to reset it.</p>
        </form>
      </section>
    </div>
  );
}
