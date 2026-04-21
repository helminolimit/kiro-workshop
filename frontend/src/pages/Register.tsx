import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const PASSWORD_RULES = [
  { label: 'At least 8 characters',      test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter',        test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter',        test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number',                  test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character',       test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [formError, setFormError] = useState('');
  
  const { register, loading, error } = useAuth();
  const navigate = useNavigate();

  const passwordChecks = useMemo(
    () => PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(password) })),
    [password]
  );
  const passwordValid = passwordChecks.every((r) => r.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    if (!username || !email || !password || !confirmPassword || !displayName) {
      setFormError('Please fill in all fields');
      return;
    }
    
    if (!passwordValid) {
      setFormError('Password does not meet all requirements');
      return;
    }
    
    if (password !== confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }
    
    try {
      await register(username, email, password, displayName);
      navigate('/');
    } catch (err) {
      // Error is handled by the auth context
    }
  };

  return (
    <div className="register-container">
      <h2>Create an Account</h2>
      <form onSubmit={handleSubmit}>
        {(formError || error) && (
          <div className="error-message">
            {formError || error}
          </div>
        )}
        
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="displayName">Display Name</label>
          <input
            type="text"
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />
          {password.length > 0 && (
            <ul className="password-requirements" aria-label="Password requirements">
              {passwordChecks.map((rule) => (
                <li key={rule.label} className={rule.met ? 'requirement met' : 'requirement'}>
                  <span className="requirement-icon" aria-hidden="true">
                    {rule.met ? '✓' : '○'}
                  </span>
                  {rule.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        
        <button type="submit" disabled={loading || !passwordValid}>
          {loading ? 'Creating Account...' : 'Register'}
        </button>
      </form>
      
      <p>
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
};

export default Register;