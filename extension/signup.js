document.getElementById('signupForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = '';

  // Check all fields are filled
  if (!email || !password || !confirmPassword) {
    errorMsg.textContent = "All fields are required.";
    return;
  }

  // Check password match
  if (password !== confirmPassword) {
    errorMsg.textContent = "Passwords do not match.";
    return;
  }

  try {
    const response = await fetch('http://localhost:5000/auth/manual/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (result.success) {
      alert("Signup successful! Please login.");
      window.close(); // Close popup after successful signup
    } else {
      errorMsg.textContent = result.message || "Signup failed.";
    }
  } catch (error) {
    console.error("Signup error:", error);
    errorMsg.textContent = "Something went wrong. Try again.";
  }
});
