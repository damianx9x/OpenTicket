'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface Step2Props {
  onContinue: (email: string, password: string, organizationName: string) => void;
  onBack: () => void;
  defaultEmail: string;
  defaultPassword: string;
  defaultOrg: string;
}

/**
 * Step 2: Admin Credentials
 * User creates admin account and optionally specifies organization name
 */
export function InitStep2({
  onContinue,
  onBack,
  defaultEmail,
  defaultPassword,
  defaultOrg,
}: Step2Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [passwordConfirm, setPasswordConfirm] = useState(defaultPassword);
  const [organizationName, setOrganizationName] = useState(defaultOrg);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!email || email.trim().length === 0) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!password || password.length === 0) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (password !== passwordConfirm) {
      newErrors.passwordConfirm = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (validateForm()) {
      onContinue(email, password, organizationName);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          👤 Create Admin Account
        </h2>
        <p className="text-gray-600">
          Set up your administrator account to manage the ticket system.
        </p>
      </div>

      <div className="space-y-4">
        {/* Email Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Admin Email *
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
            }}
            placeholder="admin@company.com"
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.email && (
            <p className="text-red-600 text-sm mt-1">⚠️ {errors.email}</p>
          )}
        </div>

        {/* Password Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password *
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
              }}
              placeholder="Enter a strong password"
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.password ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-red-600 text-sm mt-1">⚠️ {errors.password}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            💡 Use at least 8 characters with mixed case and numbers
          </p>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password *
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={passwordConfirm}
            onChange={(e) => {
              setPasswordConfirm(e.target.value);
              if (errors.passwordConfirm)
                setErrors((prev) => ({ ...prev, passwordConfirm: '' }));
            }}
            placeholder="Re-enter password"
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.passwordConfirm ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.passwordConfirm && (
            <p className="text-red-600 text-sm mt-1">⚠️ {errors.passwordConfirm}</p>
          )}
        </div>

        {/* Organization Name (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Organization Name (Optional)
          </label>
          <input
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder="e.g., John's Services"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Add the name of your business or service provider
          </p>
        </div>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-900">
          <strong>🔐 Security reminder:</strong> Store your password securely. You'll use this to log in to the system. There is no password recovery option for local setups.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleContinue}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Continue to Review →
        </button>
      </div>
    </div>
  );
}
