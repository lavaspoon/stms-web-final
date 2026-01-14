import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Target, Briefcase, LogOut, User } from 'lucide-react';
import useUserStore from '../store/userStore';
import './Layout.css';

function Layout({ children }) {
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

    const isAdmin = user.role === '관리자' || user.role === '매니저';

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1>경영성과관리</h1>
                </div>

                <nav className="sidebar-nav">
                    <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <LayoutDashboard size={20} />
                        <span>통합 대시보드</span>
                    </NavLink>

                    <NavLink to="/oi-tasks" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <Target size={20} />
                        <span>OI 과제</span>
                    </NavLink>

                    <NavLink to="/key-tasks" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <Briefcase size={20} />
                        <span>중점추진과제</span>
                    </NavLink>
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <User size={18} />
                        <div className="user-details">
                            <div className="user-name">{user.userName}</div>
                            <div className="user-role">{user.role} · {user.deptName}</div>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="logout-btn">
                        <LogOut size={18} />
                        <span>로그아웃</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    );
}

export default Layout;
