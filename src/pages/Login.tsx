import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg("Account created successfully! You can now log in.");
        setIsSignUp(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        navigate("/dashboard");
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', background: '#f9f9fb' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '320px', padding: '2rem', background: '#fff', border: '1px solid #e4e4e7', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>{isSignUp ? 'Create Account' : 'Officer Login'}</h2>
        
        {errorMsg && <p style={{ color: 'red', fontSize: '0.875rem', margin: 0 }}>{errorMsg}</p>}
        {successMsg && <p style={{ color: 'green', fontSize: '0.875rem', margin: 0 }}>{successMsg}</p>}

        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>Email</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} 
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }} 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading} 
          style={{ padding: '0.75rem', cursor: 'pointer', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 600, marginTop: '0.5rem' }}
        >
          {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
        </button>

        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem', color: '#666' }}>
          {isSignUp ? (
            <p>Already have an account? <button type="button" onClick={() => setIsSignUp(false)} style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Sign In</button></p>
          ) : (
            <p>Need a chapter account? <button type="button" onClick={() => setIsSignUp(true)} style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Sign Up</button></p>
          )}
        </div>
      </form>
    </div>
  );
}