import { useState } from 'react';
import Link from 'next/link';

export default function SignupPage() {
  const [form, setForm] = useState({ email: '', username: '', password: '', acceptTerms: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sign up');
      window.location.href = '/profile';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Create your account</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          className="w-full rounded-md bg-gray-900 border border-gray-800 px-3 py-2"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />
        <input
          type="text"
          placeholder="Username"
          className="w-full rounded-md bg-gray-900 border border-gray-800 px-3 py-2"
          value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full rounded-md bg-gray-900 border border-gray-800 px-3 py-2"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          required
        />
        <label className="flex items-start gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={form.acceptTerms}
            onChange={(e) => setForm((f) => ({ ...f, acceptTerms: e.target.checked }))}
            className="mt-1"
          />
          <span>
            I agree my conversations may be anonymized and sold for AI training.
          </span>
        </label>
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-600 hover:bg-brand-500 px-3 py-2 font-medium"
        >
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>
      <p className="text-sm text-gray-400 mt-4">
        Already have an account? <Link className="underline" href="/login">Log in</Link>
      </p>
    </div>
  );
} 