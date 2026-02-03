import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Target, Briefcase, LogOut, User, Bell, FileText, TrendingUp } from 'lucide-react';
import Lottie from 'lottie-react';
import aiLottieData from '../assets/lotties/ailottie.json';
import useUserStore from '../store/userStore';
import { getTasksByType } from '../api/taskApi';
import './Layout.css';

function Layout({ children }) {
    const navigate = useNavigate();
    const { user, clearUser } = useUserStore();
    const [notInputtedCount, setNotInputtedCount] = useState({
        oi: 0,
        key: 0,
        kpi: 0
    });

    const isAdmin = user?.role === '관리자';

    // 미입력 과제 수 조회
    useEffect(() => {
        if (!user) return;

        const loadNotInputtedCounts = async () => {
            try {
                // 모든 과제 조회 (관리자는 전체, 담당자는 본부 전체)
                const oiTasks = await getTasksByType('OI', null);
                const keyTasks = await getTasksByType('중점추진', null);
                const kpiTasks = await getTasksByType('KPI', null);

                // 상태 정규화 함수
                const normalizeStatus = (status) => {
                    if (!status) return 'inProgress';
                    const statusMap = {
                        '진행중': 'inProgress',
                        '완료': 'completed',
                        '지연': 'delayed',
                        '중단': 'stopped',
                        'inProgress': 'inProgress',
                        'completed': 'completed',
                        'delayed': 'delayed',
                        'stopped': 'stopped'
                    };
                    return statusMap[status] || 'inProgress';
                };

                let oiNotInputted, keyNotInputted, kpiNotInputted;

                if (isAdmin) {
                    // 관리자: 진행중인 과제 중 미입력
                    oiNotInputted = oiTasks.filter(task => {
                        const normalizedStatus = normalizeStatus(task.status);
                        return normalizedStatus === 'inProgress' && task.isInputted !== 'Y';
                    }).length;
                    keyNotInputted = keyTasks.filter(task => {
                        const normalizedStatus = normalizeStatus(task.status);
                        return normalizedStatus === 'inProgress' && task.isInputted !== 'Y';
                    }).length;
                    kpiNotInputted = kpiTasks.filter(task => {
                        const normalizedStatus = normalizeStatus(task.status);
                        return normalizedStatus === 'inProgress' && task.isInputted !== 'Y';
                    }).length;
                } else {
                    // 담당자: 본부 기준으로 필터링
                    const skid = user?.skid || user?.userId;

                    // 사용자의 본부 정보 찾기
                    let userTopDeptName = null;
                    for (const task of [...oiTasks, ...keyTasks, ...kpiTasks]) {
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

                    if (userTopDeptName) {
                        // 본부 기준으로 필터링
                        const filteredOiTasks = oiTasks.filter(task => {
                            if (task.managers && task.managers.length > 0) {
                                return task.managers.some(manager =>
                                    manager.topDeptName === userTopDeptName
                                );
                            }
                            return task.topDeptName === userTopDeptName;
                        });

                        const filteredKeyTasks = keyTasks.filter(task => {
                            if (task.managers && task.managers.length > 0) {
                                return task.managers.some(manager =>
                                    manager.topDeptName === userTopDeptName
                                );
                            }
                            return task.topDeptName === userTopDeptName;
                        });

                        const filteredKpiTasks = kpiTasks.filter(task => {
                            if (task.managers && task.managers.length > 0) {
                                return task.managers.some(manager =>
                                    manager.topDeptName === userTopDeptName
                                );
                            }
                            return task.topDeptName === userTopDeptName;
                        });

                        oiNotInputted = filteredOiTasks.filter(task => {
                            const normalizedStatus = normalizeStatus(task.status);
                            return normalizedStatus === 'inProgress' && task.isInputted !== 'Y';
                        }).length;
                        keyNotInputted = filteredKeyTasks.filter(task => {
                            const normalizedStatus = normalizeStatus(task.status);
                            return normalizedStatus === 'inProgress' && task.isInputted !== 'Y';
                        }).length;
                        kpiNotInputted = filteredKpiTasks.filter(task => {
                            const normalizedStatus = normalizeStatus(task.status);
                            return normalizedStatus === 'inProgress' && task.isInputted !== 'Y';
                        }).length;
                    } else {
                        oiNotInputted = 0;
                        keyNotInputted = 0;
                        kpiNotInputted = 0;
                    }
                }

                setNotInputtedCount({
                    oi: oiNotInputted,
                    key: keyNotInputted,
                    kpi: kpiNotInputted
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

                    <NavLink to="/kpi-tasks" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                        <TrendingUp size={20} />
                        <span>KPI 과제</span>
                        {notInputtedCount.kpi > 0 && (
                            <span
                                className="nav-badge"
                                title="미입력과제"
                                data-tooltip="미입력과제"
                            >
                                {notInputtedCount.kpi}
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
                    <button onClick={handleLogout} className="user-logout-btn">
                        <div className="user-info-section">
                            <User size={18} />
                            <div className="user-details">
                                <div className="user-name">{user.userName}</div>
                                <div className="user-role">{user.role} · {user.deptName}</div>
                            </div>
                        </div>
                        <LogOut size={18} />
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
