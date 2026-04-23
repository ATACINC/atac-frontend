// frontend/src/pages/SignupPage.jsx
// Dedicated signup page at /signup.
// Renders the Login component in register mode via the defaultAction prop.
// This keeps all UI logic (form, hCaptcha, consent checkbox, validation,
// styling, particles) in a single source of truth: Login.jsx.

import Login from './Login';

export default function SignupPage() {
  return <Login defaultAction="register" />;
}
