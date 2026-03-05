import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loginApi } from '../api/authApi';
import useUserStore from '../store/userStore';

function AutoLogin() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const setUser = useUserStore((state) => state.setUser);
    const [error, setError] = useState(null);

    useEffect(() => {
        const encoded = searchParams.get('skid');

        if (!encoded) {
            navigate('/', { replace: true });
            return;
        }

        let skid;
        try {
            skid = atob(encoded);
        } catch {
            setError('잘못된 인증 링크입니다.');
            return;
        }

        if (!skid || !skid.trim()) {
            setError('잘못된 인증 링크입니다.');
            return;
        }

        loginApi(skid.trim())
            .then((data) => {
                setUser(data);
                navigate('/dashboard', { replace: true });
            })
            .catch(() => {
                setError('로그인에 실패했습니다. 사번을 확인해주세요.');
            });
    }, []);

    if (error) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                gap: '16px',
                fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                color: '#1d1d1f'
            }}>
                <div style={{ fontSize: '48px' }}>⚠️</div>
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{error}</div>
                <button
                    onClick={() => navigate('/', { replace: true })}
                    style={{
                        marginTop: '8px',
                        padding: '10px 24px',
                        background: '#007aff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    로그인 페이지로 이동
                </button>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: '12px',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            color: '#6b7280'
        }}>
            <div style={{
                width: '36px',
                height: '36px',
                border: '3px solid #e5e7eb',
                borderTop: '3px solid #007aff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <span style={{ fontSize: '15px' }}>로그인 중...</span>
        </div>
    );
}

export default AutoLogin;
