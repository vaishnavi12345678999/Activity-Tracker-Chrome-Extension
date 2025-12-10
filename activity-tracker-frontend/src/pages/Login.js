import React from 'react';
const Login=()=>{
    const handleLogin=()=>{
        window.location.href='http://localhost:5000/auth/google';
    };
    return(
    <div>
        <h1>Login</h1>
        <button onClick={handleLogin}></button>
        sign in with Google 

    </div>
    );
};
export default Login;