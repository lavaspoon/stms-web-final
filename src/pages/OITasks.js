import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, AlertCircle, CheckCircle, Clock, XCircle, Check } from 'lucide-react';
import useUserStore from '../store/userStore';
import TaskRegisterModal from '../components/TaskRegisterModal';
import { getTasksByType } from '../api/taskApi';
import './OITasks.css';

function OITasks() {
    const { user } = useUserStore();
    const isAdmin = user.role === '관리자' || user.role === '매니저';

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);

    // 과제 목록 조회
    const loadTasks = async () => {
        try {
            setLoading(true);
            const data = await getTasksByType('OI');

            // 백엔드 데이터를 화면 포맷으로 변환
            const formattedTasks = data.map(task => ({
                id: task.taskId,
                category1: task.category1,
                category2: task.category2,
                name: task.taskName,
                description: task.description,
                status: task.status || 'inProgress',
                isInputted: task.isInputted === 'Y',
                manager: task.managers && task.managers.length > 0 ? task.managers[0].mbName : '-',
                managers: task.managers || [],
                deptName: task.deptName || '-',
                startDate: task.startDate,
                endDate: task.endDate,
                performance: {
                    type: task.performanceType,
                    evaluation: task.evaluationType,
                    metric: task.metric
                },
                achievement: task.achievement || 0
            }));

            setTasks(formattedTasks);
        } catch (error) {
            console.error('과제 목록 조회 실패:', error);
            alert('과제 목록을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 컴포넌트 마운트 시 과제 목록 로드
    useEffect(() => {
        loadTasks();
    }, []);

    // 과제 등록 완료 후 목록 새로고침
    const handleModalClose = () => {
        setIsRegisterModalOpen(false);
        loadTasks(); // 목록 새로고침
    };

    // 임시 데이터 (API 연동 전 백업)
    const sampleTasks = [
        {
            id: 1,
            category1: '고객 만족',
            category2: '서비스 품질',
            name: '고객 만족도 향상 프로젝트',
            description: '고객 서비스 품질 개선을 통한 만족도 향상',
            status: 'inProgress', // 실제 과제 상태
            isInputted: false, // 이달 활동내역 입력 여부
            manager: '김철수',
            deptName: 'CS팀',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            performance: {
                type: '비재무',
                evaluation: '정량',
                metric: '%'
            },
            achievement: 65
        },
        {
            id: 2,
            category1: '디지털 혁신',
            category2: '신기술 도입',
            name: '신규 서비스 개발',
            description: 'AI 기반 신규 서비스 개발 및 출시',
            status: 'inProgress',
            isInputted: true,
            manager: '이영희',
            deptName: '개발팀',
            startDate: '2026-02-01',
            endDate: '2026-10-31',
            performance: {
                type: '재무',
                evaluation: '정량',
                metric: '금액'
            },
            achievement: 45
        },
        {
            id: 3,
            category1: '경영 효율화',
            category2: '비용 관리',
            name: '비용 절감 개선',
            description: '불필요한 비용 절감 및 효율화',
            status: 'completed',
            isInputted: true,
            manager: '박민수',
            deptName: '재무팀',
            startDate: '2026-01-01',
            endDate: '2026-06-30',
            performance: {
                type: '재무',
                evaluation: '정량',
                metric: '금액'
            },
            achievement: 100
        },
        {
            id: 4,
            category1: '인재 육성',
            category2: '교육 프로그램',
            name: '직원 역량 강화 교육',
            description: '핵심 인재 육성 프로그램 운영',
            status: 'delayed',
            isInputted: false,
            manager: '정수진',
            deptName: 'HR팀',
            startDate: '2026-03-01',
            endDate: '2026-12-31',
            performance: {
                type: '비재무',
                evaluation: '정량',
                metric: '건수'
            },
            achievement: 30
        }
    ];

    const getStatusBadge = (status) => {
        const statusConfig = {
            inProgress: { text: '진행중', className: 'status-badge in-progress', icon: Clock },
            completed: { text: '완료', className: 'status-badge completed', icon: CheckCircle },
            delayed: { text: '지연', className: 'status-badge delayed', icon: AlertCircle },
            stopped: { text: '중단', className: 'status-badge stopped', icon: XCircle },
        };

        // status가 없거나 정의되지 않은 경우 기본값 사용
        const config = statusConfig[status] || statusConfig.inProgress;
        const Icon = config.icon;

        return (
            <span className={config.className}>
                <Icon size={14} />
                {config.text}
            </span>
        );
    };

    const getInputBadge = (isInputted) => {
        if (isInputted) {
            return (
                <span className="input-badge inputted">
                    <Check size={14} />
                    입력완료
                </span>
            );
        }
        return (
            <span className="input-badge not-inputted">
                <AlertCircle size={14} />
                미입력
            </span>
        );
    };

    // 필터링된 과제 목록
    const filteredTasks = tasks
        .filter(task => {
            if (filterStatus === 'notInputted') {
                if (task.isInputted) return false;
            } else if (filterStatus !== 'all' && task.status !== filterStatus) {
                return false;
            }
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const matchName = task.name.toLowerCase().includes(searchLower);
                const matchManager = task.manager.toLowerCase().includes(searchLower);
                if (!matchName && !matchManager) return false;
            }
            return true;
        })
        .sort((a, b) => {
            // 미입력 과제 우선 정렬
            if (!a.isInputted && b.isInputted) return -1;
            if (a.isInputted && !b.isInputted) return 1;
            return 0;
        });

    const notInputtedCount = tasks.filter(t => !t.isInputted).length;

    return (
        <div className="oi-tasks">
            <div className="page-header">
                <div>
                    <h1>OI 과제</h1>
                    <p className="page-subtitle">Operational Innovation 과제를 관리합니다</p>
                </div>
                {isAdmin && (
                    <button className="primary-btn" onClick={() => setIsRegisterModalOpen(true)}>
                        <Plus size={18} />
                        과제 등록
                    </button>
                )}
            </div>

            {notInputtedCount > 0 && (
                <div className="alert-banner">
                    <AlertCircle size={20} />
                    <span>이번 달 활동내역이 입력되지 않은 과제가 <strong>{notInputtedCount}개</strong> 있습니다.</span>
                </div>
            )}

            <div className="filter-section">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="과제명 또는 담당자 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="filter-buttons">
                    <button
                        className={filterStatus === 'all' ? 'filter-btn active' : 'filter-btn'}
                        onClick={() => setFilterStatus('all')}
                    >
                        전체 ({tasks.length})
                    </button>
                    <button
                        className={filterStatus === 'notInputted' ? 'filter-btn active warning' : 'filter-btn warning'}
                        onClick={() => setFilterStatus('notInputted')}
                    >
                        미입력 ({tasks.filter(t => !t.isInputted).length})
                    </button>
                    <button
                        className={filterStatus === 'inProgress' ? 'filter-btn active' : 'filter-btn'}
                        onClick={() => setFilterStatus('inProgress')}
                    >
                        진행중 ({tasks.filter(t => t.status === 'inProgress').length})
                    </button>
                    <button
                        className={filterStatus === 'completed' ? 'filter-btn active' : 'filter-btn'}
                        onClick={() => setFilterStatus('completed')}
                    >
                        완료 ({tasks.filter(t => t.status === 'completed').length})
                    </button>
                    <button
                        className={filterStatus === 'delayed' ? 'filter-btn active' : 'filter-btn'}
                        onClick={() => setFilterStatus('delayed')}
                    >
                        지연 ({tasks.filter(t => t.status === 'delayed').length})
                    </button>
                </div>
            </div>

            <div className="tasks-table-container">
                <table className="tasks-table">
                    <thead>
                        <tr>
                            <th>카테고리</th>
                            <th>과제명</th>
                            <th>담당자</th>
                            <th>부서</th>
                            <th>기간</th>
                            <th>성과지표</th>
                            <th>달성률</th>
                            <th>이달입력</th>
                            <th>상태</th>
                            <th>액션</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTasks.map(task => (
                            <tr key={task.id} className={!task.isInputted ? 'not-inputted-row' : ''}>
                                <td className="category-cell">{task.category1} &gt; {task.category2}</td>
                                <td className="name-cell">
                                    <div className="task-name">{task.name}</div>
                                    <div className="task-desc">{task.description}</div>
                                </td>
                                <td>{task.manager}</td>
                                <td>{task.deptName}</td>
                                <td className="date-cell">{task.startDate}<br />~ {task.endDate}</td>
                                <td>{task.performance.type} · {task.performance.metric}</td>
                                <td>
                                    <div className="progress-cell">
                                        <div className="progress-bar-simple">
                                            <div className="progress-fill" style={{ width: `${task.achievement}%` }} />
                                        </div>
                                        <span className="progress-text">{task.achievement}%</span>
                                    </div>
                                </td>
                                <td>{getInputBadge(task.isInputted)}</td>
                                <td>{getStatusBadge(task.status)}</td>
                                <td>
                                    <div className="action-buttons">
                                        {!task.isInputted ? (
                                            <button className="btn-input">입력</button>
                                        ) : (
                                            <button className="btn-view">상세</button>
                                        )}
                                        {isAdmin && <button className="btn-edit">수정</button>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {loading && (
                <div className="loading-state">
                    <p>데이터를 불러오는 중...</p>
                </div>
            )}

            {!loading && filteredTasks.length === 0 && (
                <div className="empty-state">
                    <Filter size={48} />
                    <p>조건에 맞는 과제가 없습니다.</p>
                </div>
            )}

            <TaskRegisterModal
                isOpen={isRegisterModalOpen}
                onClose={handleModalClose}
                taskType="OI"
            />
        </div>
    );
}

export default OITasks;
