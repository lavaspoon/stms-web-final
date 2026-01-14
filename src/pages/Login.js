import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { loginApi } from '../api/authApi';
import useUserStore from '../store/userStore';
import './Login.css';

function Login() {
    const [skid, setSkid] = useState('');
    const navigate = useNavigate();
    const setUser = useUserStore((state) => state.setUser);

    const loginMutation = useMutation({
        mutationFn: loginApi,
        onSuccess: (data) => {
            setUser(data);
            navigate('/dashboard');
        },
        onError: (error) => {
            alert('로그인에 실패했습니다: ' + error.message);
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (skid.trim()) {
            loginMutation.mutate(skid);
        } else {
            alert('사번을 입력해주세요.');
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h1>경영성과관리 시스템</h1>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="skid">사번</label>
                        <input
                            type="text"
                            id="skid"
                            value={skid}
                            onChange={(e) => setSkid(e.target.value)}
                            placeholder="사번을 입력하세요"
                            disabled={loginMutation.isPending}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loginMutation.isPending}
                        className="login-button"
                    >
                        {loginMutation.isPending ? '로그인 중...' : '로그인'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;
