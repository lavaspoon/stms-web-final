import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar, AlertCircle, CheckCircle, Clock, XCircle, Check } from 'lucide-react';
import useUserStore from '../store/userStore';
import TaskRegisterModal from '../components/TaskRegisterModal';
import { getTasksByType } from '../api/taskApi';
import './KeyTasks.css';

function KeyTasks() {
    const { user } = useUserStore();
    const isAdmin = user.role === '관리자' || user.role === '매니저';

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'gantt'
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);

    // 과제 목록 조회
    const loadTasks = async () => {
        try {
            setLoading(true);
            const data = await getTasksByType('중점추진');

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
                achievement: task.achievement || 0,
                months: [] // 간트차트 데이터는 별도 처리 필요
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
            category1: '디지털 혁신',
            category2: 'AI 기술',
            name: 'AI 시스템 구축',
            description: '업무 효율화를 위한 AI 시스템 도입 및 구축',
            status: 'inProgress',
            isInputted: false,
            manager: '이은호',
            deptName: 'AITech팀',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            performance: {
                type: '비재무',
                evaluation: '정량',
                metric: '건수'
            },
            achievement: 40,
            months: [10, 20, 30, 40, 50, 60, 70, 75, 80, 85, 90, 100]
        },
        {
            id: 2,
            category1: '디지털 전환',
            category2: '인프라 구축',
            name: '디지털 전환 프로젝트',
            description: '전사 디지털 전환 및 클라우드 마이그레이션',
            status: 'inProgress',
            isInputted: true,
            manager: '정수진',
            deptName: 'IT팀',
            startDate: '2026-02-01',
            endDate: '2026-11-30',
            performance: {
                type: '재무',
                evaluation: '정량',
                metric: '금액'
            },
            achievement: 55,
            months: [0, 15, 25, 35, 45, 55, 65, 75, 85, 95, 100, 0]
        },
        {
            id: 3,
            category1: '업무 혁신',
            category2: '프로세스 개선',
            name: '업무 프로세스 개선',
            description: '전사 업무 프로세스 표준화 및 자동화',
            status: 'delayed',
            isInputted: false,
            manager: '최민호',
            deptName: '경영지원팀',
            startDate: '2026-01-01',
            endDate: '2026-08-31',
            performance: {
                type: '비재무',
                evaluation: '정성',
                metric: '%'
            },
            achievement: 25,
            months: [10, 15, 20, 25, 30, 25, 25, 25, 0, 0, 0, 0]
        },
        {
            id: 4,
            category1: '조직 문화',
            category2: '협업 강화',
            name: '협업 문화 조성',
            description: '부서 간 협업 강화 및 소통 체계 구축',
            status: 'inProgress',
            isInputted: true,
            manager: '김영희',
            deptName: 'HR팀',
            startDate: '2026-03-01',
            endDate: '2026-12-31',
            performance: {
                type: '비재무',
                evaluation: '정성',
                metric: '%'
            },
            achievement: 60,
            months: [0, 0, 20, 30, 40, 50, 60, 70, 80, 90, 100, 100]
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
            if (!a.isInputted && b.isInputted) return -1;
            if (a.isInputted && !b.isInputted) return 1;
            return 0;
        });

    const notInputtedCount = tasks.filter(t => !t.isInputted).length;
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

    return (
        <div className="key-tasks">
            <div className="page-header">
                <div>
                    <h1>중점추진과제</h1>
                    <p className="page-subtitle">전사 중점추진과제를 관리하고 진행 현황을 확인합니다</p>
                </div>
                <div className="header-actions">
                    {isAdmin && (
                        <>
                            <div className="view-toggle">
                                <button
                                    className={viewMode === 'list' ? 'toggle-btn active' : 'toggle-btn'}
                                    onClick={() => setViewMode('list')}
                                >
                                    목록
                                </button>
                                <button
                                    className={viewMode === 'gantt' ? 'toggle-btn active' : 'toggle-btn'}
                                    onClick={() => setViewMode('gantt')}
                                >
                                    <Calendar size={16} />
                                    간트차트
                                </button>
                            </div>
                            <button className="primary-btn" onClick={() => setIsRegisterModalOpen(true)}>
                                <Plus size={18} />
                                과제 등록
                            </button>
                        </>
                    )}
                </div>
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

            {viewMode === 'list' ? (
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
            ) : (
                <div className="gantt-container">
                    <div className="gantt-header">
                        <div className="gantt-task-column">과제명</div>
                        <div className="gantt-timeline">
                            {months.map((month, idx) => (
                                <div key={idx} className="gantt-month">{month}</div>
                            ))}
                        </div>
                    </div>

                    <div className="gantt-body">
                        {filteredTasks.map(task => (
                            <div key={task.id} className="gantt-row">
                                <div className="gantt-task-info">
                                    <div className="gantt-task-name">{task.name}</div>
                                    <div className="gantt-task-meta">{task.manager} · {task.deptName}</div>
                                    {getStatusBadge(task.status)}
                                </div>
                                <div className="gantt-timeline">
                                    {task.months.map((value, idx) => (
                                        <div key={idx} className="gantt-cell">
                                            {value > 0 && (
                                                <div
                                                    className="gantt-bar"
                                                    style={{
                                                        height: `${value}%`,
                                                        background: task.status === 'delayed'
                                                            ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                                            : task.status === 'completed'
                                                                ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                                                                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                                    }}
                                                >
                                                    <span className="gantt-value">{value}%</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading && (
                <div className="loading-state">
                    <p>데이터를 불러오는 중...</p>
                </div>
            )}

            <TaskRegisterModal
                isOpen={isRegisterModalOpen}
                onClose={handleModalClose}
                taskType="중점추진"
            />
        </div>
    );
}

export default KeyTasks;
