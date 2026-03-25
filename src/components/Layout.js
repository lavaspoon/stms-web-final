import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Target, Briefcase, Bell, FileText, TrendingUp, Handshake } from 'lucide-react';
import Lottie from 'lottie-react';
import aiLottieData from '../assets/lotties/ailottie.json';
import useUserStore from '../store/userStore';
import { getTasksByType } from '../api/taskApi';
import './Layout.css';

function Layout({ children }) {
    const navigate = useNavigate();
    const { user } = useUserStore();
    const [totalTasksCount, setTotalTasksCount] = useState({
        oi: 0,
        collab: 0,
        key: 0,
        kpi: 0
    });
    // 담당자(=비관리자) 프로필/사이드바에 표시할 "내 담당 과제" 카운트
    const [assignedTasksCount, setAssignedTasksCount] = useState({
        oi: 0,
        collab: 0,
        key: 0,
        kpi: 0
    });
    const [myTasksCount, setMyTasksCount] = useState(0);
    const [allTasksCount, setAllTasksCount] = useState(0);

    const isAdmin = user?.role === '관리자';

    // 대시보드 탭에 표시되는 “전체 과제 수” 조회
    useEffect(() => {
        if (!user) return;

        const loadTotalTaskCounts = async () => {
            try {
                const oiTasks = await getTasksByType('OI', null);
                const collabTasks = await getTasksByType('협업', null);
                const keyTasks = await getTasksByType('중점추진', null);
                const kpiTasks = await getTasksByType('KPI', null);

                // Dashboard.js와 동일하게 “담당자의 topDeptName”을 역탐색합니다.
                let userTopDeptName = null;
                if (!isAdmin) {
                    const skid = user?.skid || user?.userId;
                    if (skid) {
                        for (const task of [...oiTasks, ...collabTasks, ...keyTasks, ...kpiTasks]) {
                            if (task.managers && task.managers.length > 0) {
                                const userManager = task.managers.find(m =>
                                    (m.userId || m.mbId) === skid
                                );
                                if (userManager && userManager.topDeptName) {
                                    userTopDeptName = userManager.topDeptName;
                                    break;
                                }
                            }
                        }
                    }
                }

                // 관리자/담당자 역할에 따라 프로필에 보여줄 과제 개수 계산
                const allTasks = [...oiTasks, ...collabTasks, ...keyTasks, ...kpiTasks];
                setAllTasksCount(allTasks.length);

                if (isAdmin) {
                    setMyTasksCount(0);
                } else {
                    const currentUserId = user?.userId || user?.skid;
                    if (!currentUserId) {
                        setMyTasksCount(0);
                    } else {
                        const countMyTasks = (tasks) => {
                            return tasks.filter(task =>
                                task.managers && task.managers.some(m => (m.userId || m.mbId) === currentUserId)
                            ).length;
                        };

                        setMyTasksCount(
                            countMyTasks(oiTasks) +
                            countMyTasks(collabTasks) +
                            countMyTasks(keyTasks) +
                            countMyTasks(kpiTasks)
                        );
                    }
                }

                // "내 담당 과제" 카운트(사이드바 배지용)
                const currentUserId = user?.userId || user?.skid;
                const countAssignedTasks = (tasks) => {
                    if (!currentUserId) return 0;
                    return tasks.filter(task =>
                        task.managers && task.managers.some(m => (m.userId || m.mbId) === currentUserId)
                    ).length;
                };

                setAssignedTasksCount({
                    oi: countAssignedTasks(oiTasks),
                    collab: countAssignedTasks(collabTasks),
                    key: countAssignedTasks(keyTasks),
                    kpi: countAssignedTasks(kpiTasks)
                });

                const countVisibleTasks = (tasks) => {
                    // Dashboard.js: userTopDeptName이 없으면(못 찾으면) 전체를 보여줍니다.
                    if (isAdmin || !userTopDeptName) return tasks.length;

                    return tasks.filter(task => {
                        if (task.managers && task.managers.length > 0) {
                            return task.managers.some(manager =>
                                manager.topDeptName === userTopDeptName
                            );
                        }
                        return task.topDeptName === userTopDeptName;
                    }).length;
                }

                setTotalTasksCount({
                    oi: countVisibleTasks(oiTasks),
                    collab: countVisibleTasks(collabTasks),
                    key: countVisibleTasks(keyTasks),
                    kpi: countVisibleTasks(kpiTasks)
                });
            } catch (error) {
                console.error('대시보드 전체 과제 수 조회 실패:', error);
            }
        };

        loadTotalTaskCounts();
        // 5분마다 자동 갱신
        const interval = setInterval(loadTotalTaskCounts, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user, isAdmin]);

    if (!user) {
        navigate('/');
        return null;
    }

    const isAssigneeRole = user?.role === '담당자';
    const sidebarTaskCounts = isAssigneeRole ? assignedTasksCount : totalTasksCount;
    const sidebarBadgeLabel = isAssigneeRole ? '담당과제수' : '전체과제수';

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h1>경영성과관리</h1>
                </div>

                <nav className="sidebar-nav">
                    {/* 통합 대시보드 - 모든 사용자 표시 (관리자는 전체, 구성원은 본인 본부 기준 데이터) */}
                    <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <LayoutDashboard size={20} />
                        <span>통합 대시보드</span>
                    </NavLink>

                    <NavLink to="/oi-tasks" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <Target size={20} />
                        <span>OI 과제</span>
                        {sidebarTaskCounts.oi >= 0 && (
                            <span
                                className="nav-badge"
                                title={sidebarBadgeLabel}
                                data-tooltip={sidebarBadgeLabel}
                            >
                                {sidebarTaskCounts.oi}
                            </span>
                        )}
                    </NavLink>

                    <NavLink to="/collab-tasks" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <Handshake size={20} />
                        <span>협업 과제</span>
                        {sidebarTaskCounts.collab >= 0 && (
                            <span
                                className="nav-badge"
                                title={sidebarBadgeLabel}
                                data-tooltip={sidebarBadgeLabel}
                            >
                                {sidebarTaskCounts.collab}
                            </span>
                        )}
                    </NavLink>

                    <NavLink to="/key-tasks" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <Briefcase size={20} />
                        <span>중점추진과제</span>
                        {sidebarTaskCounts.key >= 0 && (
                            <span
                                className="nav-badge"
                                title={sidebarBadgeLabel}
                                data-tooltip={sidebarBadgeLabel}
                            >
                                {sidebarTaskCounts.key}
                            </span>
                        )}
                    </NavLink>

                    <NavLink to="/kpi-tasks" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <TrendingUp size={20} />
                        <span>KPI 과제</span>
                        {sidebarTaskCounts.kpi >= 0 && (
                            <span
                                className="nav-badge"
                                title={sidebarBadgeLabel}
                                data-tooltip={sidebarBadgeLabel}
                            >
                                {sidebarTaskCounts.kpi}
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

                {/* AI 보고서 생성 배너 */}
                <div className="ai-report-banner">
                    <NavLink to="/ai-report" className={({ isActive }) => `ai-report-banner-link ${isActive ? 'active' : ''}`}>
                        <div className="ai-report-banner-content">
                            <div className="ai-report-banner-icon">
                                <Lottie
                                    animationData={aiLottieData}
                                    loop={true}
                                    style={{ width: 56, height: 56 }}
                                />
                            </div>
                            <div className="ai-report-banner-text">
                                <div className="ai-report-banner-title">AI 보고서 생성</div>
                                <div className="ai-report-banner-subtitle">자동으로 보고서를 생성해보세요</div>
                            </div>
                        </div>
                    </NavLink>
                </div>

                <div className="sidebar-footer">
                    <div className="user-info-section sidebar-user-info">
                        <div className="user-details">
                            <div className="user-name">{user.userName}</div>
                            <div className="user-meta-row">
                                <div className="user-role">
                                    {user.deptName}
                                </div>
                                <div
                                    className={`user-task-count ${isAdmin ? 'admin' : 'my'}`}
                                    aria-live="polite"
                                >
                                    {isAdmin ? `현재 모든 과제: ${allTasksCount}건` : `현재 담당 과제: ${myTasksCount}건`}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    );
}

export default Layout;
