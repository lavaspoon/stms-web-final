import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Briefcase, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import './Dashboard.css';

function Dashboard() {
    const navigate = useNavigate();

    // 임시 데이터 (추후 API 연동)
    const stats = {
        totalTasks: 24,
        notInputted: 8,
        inProgress: 12,
        completed: 4,
        delayed: 6,
        stopped: 2
    };

    const oiTasks = [
        { id: 1, name: '고객 만족도 향상 프로젝트', status: 'notInputted', manager: '김철수', deptName: 'CS팀' },
        { id: 2, name: '신규 서비스 개발', status: 'inProgress', manager: '이영희', deptName: '개발팀' },
        { id: 3, name: '비용 절감 개선', status: 'completed', manager: '박민수', deptName: '재무팀' },
    ];

    const keyTasks = [
        { id: 1, name: 'AI 시스템 구축', status: 'notInputted', manager: '이은호', deptName: 'AITech팀' },
        { id: 2, name: '디지털 전환 프로젝트', status: 'inProgress', manager: '정수진', deptName: 'IT팀' },
        { id: 3, name: '업무 프로세스 개선', status: 'delayed', manager: '최민호', deptName: '경영지원팀' },
    ];

    const getStatusBadge = (status) => {
        const statusConfig = {
            notInputted: { text: '미입력', className: 'status-badge not-inputted', icon: AlertCircle },
            inProgress: { text: '진행중', className: 'status-badge in-progress', icon: Clock },
            completed: { text: '완료', className: 'status-badge completed', icon: CheckCircle },
            delayed: { text: '지연', className: 'status-badge delayed', icon: AlertCircle },
            stopped: { text: '중단', className: 'status-badge stopped', icon: XCircle },
        };

        const config = statusConfig[status];
        const Icon = config.icon;

        return (
            <span className={config.className}>
                <Icon size={14} />
                {config.text}
            </span>
        );
    };

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1>통합 대시보드</h1>
                <p className="dashboard-subtitle">중점추진과제 및 OI 과제 현황을 한눈에 확인하세요</p>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon total">
                        <Briefcase size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-label">전체 과제</div>
                        <div className="stat-value">{stats.totalTasks}</div>
                    </div>
                </div>

                <div className="stat-card highlight">
                    <div className="stat-icon warning">
                        <AlertCircle size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-label">이달 미입력</div>
                        <div className="stat-value alert">{stats.notInputted}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon progress">
                        <Clock size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-label">진행중</div>
                        <div className="stat-value">{stats.inProgress}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon success">
                        <CheckCircle size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-label">완료</div>
                        <div className="stat-value">{stats.completed}</div>
                    </div>
                </div>
            </div>

            <div className="task-sections">
                <div className="task-section">
                    <div className="section-header">
                        <div className="section-title">
                            <Target size={20} />
                            <h2>OI 과제</h2>
                            <span className="task-count">{oiTasks.length}</span>
                        </div>
                        <button className="view-all-btn" onClick={() => navigate('/oi-tasks')}>
                            전체보기 →
                        </button>
                    </div>

                    <div className="task-list">
                        {oiTasks.map(task => (
                            <div key={task.id} className="task-item" onClick={() => navigate('/oi-tasks')}>
                                <div className="task-info">
                                    <div className="task-name">{task.name}</div>
                                    <div className="task-meta">
                                        <span>{task.manager}</span>
                                        <span>·</span>
                                        <span>{task.deptName}</span>
                                    </div>
                                </div>
                                {getStatusBadge(task.status)}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="task-section">
                    <div className="section-header">
                        <div className="section-title">
                            <Briefcase size={20} />
                            <h2>중점추진과제</h2>
                            <span className="task-count">{keyTasks.length}</span>
                        </div>
                        <button className="view-all-btn" onClick={() => navigate('/key-tasks')}>
                            전체보기 →
                        </button>
                    </div>

                    <div className="task-list">
                        {keyTasks.map(task => (
                            <div key={task.id} className="task-item" onClick={() => navigate('/key-tasks')}>
                                <div className="task-info">
                                    <div className="task-name">{task.name}</div>
                                    <div className="task-meta">
                                        <span>{task.manager}</span>
                                        <span>·</span>
                                        <span>{task.deptName}</span>
                                    </div>
                                </div>
                                {getStatusBadge(task.status)}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
