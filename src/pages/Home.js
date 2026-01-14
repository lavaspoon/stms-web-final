import React from 'react';
import { useNavigate } from 'react-router-dom';
import useUserStore from '../store/userStore';
import './Home.css';

function Home() {
    const navigate = useNavigate();
    const { user, clearUser } = useUserStore();

    const handleLogout = () => {
        clearUser();
        navigate('/');
    };

    if (!user) {
        navigate('/');
        return null;
    }

    return (
        <div className="home-container">
            <header className="home-header">
                <h1>경영성과관리 시스템</h1>
                <button onClick={handleLogout} className="logout-button">
                    로그아웃
                </button>
            </header>

            <div className="user-info-section">
                <h2>사용자 정보</h2>
                <div className="user-info-grid">
                    <div className="info-item">
                        <span className="info-label">사번:</span>
                        <span className="info-value">{user.skid}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">이름:</span>
                        <span className="info-value">{user.userName}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">직책:</span>
                        <span className="info-value">{user.role}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">회사 코드:</span>
                        <span className="info-value">{user.comCode}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">부서:</span>
                        <span className="info-value">{user.deptName}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">부서 인덱스:</span>
                        <span className="info-value">{user.deptIdx}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">직급:</span>
                        <span className="info-value">{user.mbPosition}</span>
                    </div>
                </div>
            </div>

            <div className="welcome-section">
                <h2>환영합니다, {user.userName}님!</h2>
                <p>{user.deptName}의 {user.role}로 로그인하셨습니다.</p>
            </div>
        </div>
    );
}

export default Home;
