import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Target, Briefcase, LogOut, User, Bell, FileText } from 'lucide-react';
import useUserStore from '../store/userStore';
import { getTasksByType } from '../api/taskApi';
import './Layout.css';

function Layout({ children }) {
    const navigate = useNavigate();
    const { user, clearUser } = useUserStore();
    const [notInputtedCount, setNotInputtedCount] = useState({
        oi: 0,
        key: 0
    });

    const isAdmin = user?.role === '관리자';

    // 미입력 과제 수 조회
    useEffect(() => {
        if (!user) return;

        const loadNotInputtedCounts = async () => {
            try {
                // 사용자 ID 가져오기 (일반 사용자인 경우)
                const skid = !isAdmin ? (user?.skid || user?.userId) : null;

                // OI 과제 조회 (일반 사용자는 자신이 담당한 과제만 조회)
                const oiTasks = await getTasksByType('OI', skid);
                // 중점추진과제 조회 (일반 사용자는 자신이 담당한 과제만 조회)
                const keyTasks = await getTasksByType('중점추진', skid);

                let oiNotInputted, keyNotInputted;

                if (isAdmin) {
                    // 관리자: 전체 과제 중 미입력
                    oiNotInputted = oiTasks.filter(task => task.isInputted !== 'Y').length;
                    keyNotInputted = keyTasks.filter(task => task.isInputted !== 'Y').length;
                } else {
                    // 일반 사용자: 백엔드에서 이미 자신이 담당한 과제만 반환되므로 필터링만 수행
                    oiNotInputted = oiTasks.filter(task => task.isInputted !== 'Y').length;
                    keyNotInputted = keyTasks.filter(task => task.isInputted !== 'Y').length;
                }

                setNotInputtedCount({
                    oi: oiNotInputted,
                    key: keyNotInputted
                });
            } catch (error) {
                console.error('미입력 과제 수 조회 실패:', error);
            }
        };

        loadNotInputtedCounts();
        // 5분마다 자동 갱신
        const interval = setInterval(loadNotInputtedCounts, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user, isAdmin]);

    const handleLogout = () => {
        clearUser();
        navigate('/');
    };

    if (!user) {
        navigate('/');
        return null;
    }

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1>경영성과관리</h1>
                </div>

                <nav className="sidebar-nav">
                    {/* 통합 대시보드 - 관리자만 표시 */}
                    {isAdmin && (
                        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                            <LayoutDashboard size={20} />
                            <span>통합 대시보드</span>
                        </NavLink>
                    )}

                    {/* AI 보고서 생성 */}
                    <NavLink to="/ai-report" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <FileText size={20} />
                        <span>AI 보고서 생성</span>
                    </NavLink>

                    <NavLink to="/oi-tasks" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <Target size={20} />
                        <span>OI 과제</span>
                        {notInputtedCount.oi > 0 && (
                            <span 
                                className="nav-badge" 
                                title="미입력과제"
                                data-tooltip="미입력과제"
                            >
                                {notInputtedCount.oi}
                            </span>
                        )}
                    </NavLink>

                    <NavLink to="/key-tasks" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <Briefcase size={20} />
                        <span>중점추진과제</span>
                        {notInputtedCount.key > 0 && (
                            <span 
                                className="nav-badge" 
                                title="미입력과제"
                                data-tooltip="미입력과제"
                            >
                                {notInputtedCount.key}
                            </span>
                        )}
                    </NavLink>

                    {/* 알림 관리 - 관리자만 표시 */}
                    {isAdmin && (
                        <NavLink to="/notifications" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                            <Bell size={20} />
                            <span>알림 관리</span>
                        </NavLink>
                    )}
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
