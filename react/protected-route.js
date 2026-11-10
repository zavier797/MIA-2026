function ProtectedRoute() {
    const { isLoggedIn, authReady } = useAuth();
    const { Navigate, Outlet } = ReactRouterDOM;
    if (!authReady) return React.createElement('div', { role: 'status' }, 'Memeriksa sesi akun...');
    return isLoggedIn ? React.createElement(Outlet) : React.createElement(Navigate, { to: '/', replace: true });
}
