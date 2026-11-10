const AuthContext = React.createContext(null);

function AuthProvider({ children }) {
    const [user, setUser] = React.useState(null);
    const [authReady, setAuthReady] = React.useState(false);

    React.useEffect(() => {
        if (window.location.protocol === 'file:') {
            setAuthReady(true);
            return;
        }

        fetch('/api/auth/me')
            .then(async (response) => {
                if (!response.ok) throw new Error(`Pemeriksaan sesi gagal (${response.status}).`);
                return response.json();
            })
            .then(({ user: currentUser }) => setUser(currentUser))
            .catch((error) => console.error('Gagal memeriksa sesi akun:', error))
            .finally(() => setAuthReady(true));
    }, []);

    const logout = async () => {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        if (!response.ok) throw new Error('Sesi akun gagal diakhiri.');
        setUser(null);
    };

    return React.createElement(
        AuthContext.Provider,
        { value: { user, isLoggedIn: Boolean(user), authReady, logout } },
        children
    );
}

function useAuth() {
    const context = React.useContext(AuthContext);
    if (!context) throw new Error('useAuth harus digunakan di dalam AuthProvider.');
    return context;
}
