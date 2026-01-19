import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, AlertCircle, CheckCircle, Clock, XCircle, Check } from 'lucide-react';
import useUserStore from '../store/userStore';
import TaskRegisterModal from '../components/TaskRegisterModal';
import TaskInputModal from '../components/TaskInputModal';
import TaskDetailModal from '../components/TaskDetailModal';
import { getTasksByType } from '../api/taskApi';
import { formatDate } from '../utils/dateUtils';
import './OITasks.css';

function OITasks() {
    const { user } = useUserStore();
    const isAdmin = user.role === '관리자' || user.role === '매니저';

    // 담당자 여부 확인 (정밀하게)
    const isTaskManager = (task) => {
        if (!task.managers || task.managers.length === 0) return false;
        if (!user) return false;
        
        // user.userId 또는 user.skid 사용
        const currentUserId = user.userId || user.skid;
        if (!currentUserId) return false;
        
        // userId와 mbId 모두 확인
        const isManager = task.managers.some(manager => {
            const managerUserId = manager.userId || manager.mbId;
            return managerUserId === currentUserId;
        });
        
        console.log('isTaskManager check:', {
            taskId: task.id,
            taskName: task.name,
            currentUserId,
            managers: task.managers.map(m => ({ userId: m.userId, mbId: m.mbId, mbName: m.mbName })),
            isManager
        });
        
        return isManager;
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [inputTask, setInputTask] = useState(null);
    const [isInputModalOpen, setIsInputModalOpen] = useState(false);
    const [detailTaskId, setDetailTaskId] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // 성과지표 영어 -> 한글 변환 함수
    const translatePerformanceType = (type) => {
        const map = {
            'financial': '재무',
            'nonFinancial': '비재무'
        };
        return map[type] || type;
    };

    const translateEvaluationType = (type) => {
        const map = {
            'quantitative': '정량',
            'qualitative': '정성'
        };
        return map[type] || type;
    };

    const translateMetric = (metric) => {
        const map = {
            'count': '건수',
            'amount': '금액',
            'percent': '%'
        };
        return map[metric] || metric;
    };

    // 모든 담당자의 부서를 중복 없이 추출하는 함수
    const getManagerDepts = (managers) => {
        if (!managers || managers.length === 0) return ['-'];
        const depts = managers
            .map(m => m.deptName)
            .filter(dept => dept && dept.trim() !== '');
        if (depts.length === 0) return ['-'];
        // 중복 제거
        const uniqueDepts = [...new Set(depts)];
        return uniqueDepts;
    };

    // 이름의 초성 추출 함수
    const getInitial = (name) => {
        if (!name || name === '-') return '?';
        const firstChar = name.charAt(0);
        // 한글인 경우 초성 추출
        if (firstChar >= '가' && firstChar <= '힣') {
            const code = firstChar.charCodeAt(0) - 0xAC00;
            const initialIndex = Math.floor(code / (21 * 28));
            const initials = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
            return initials[initialIndex] || firstChar;
        }
        // 영문인 경우 대문자로
        return firstChar.toUpperCase();
    };

    // 부서별로 담당자를 그룹화하는 함수
    const getManagersByDept = (managers) => {
        if (!managers || managers.length === 0) return [];
        
        // 부서별로 그룹화
        const deptMap = {};
        managers.forEach(manager => {
            const deptName = manager.deptName || '-';
            
            if (!deptMap[deptName]) {
                deptMap[deptName] = [];
            }
            deptMap[deptName].push(manager); // manager 객체 전체를 저장
        });
        
        // 배열로 변환: [{ deptName: 'IT팀', managers: [manager1, manager2] }, ...]
        return Object.entries(deptMap).map(([deptName, managerList]) => ({
            deptName,
            managers: managerList
        }));
    };

    // 과제 목록 조회
    const loadTasks = async () => {
        try {
            setLoading(true);
            const skid = user?.skid || user?.userId;
            // 담당자인 경우 자신이 담당한 과제만 조회, 관리자는 모든 과제 조회
            const data = await getTasksByType('OI', skid);

            console.log('Loaded tasks:', data.length);
            console.log('Current user:', user);

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
                startDate: task.startDate,
                endDate: task.endDate,
                performance: {
                    type: translatePerformanceType(task.performanceType),
                    evaluation: translateEvaluationType(task.evaluationType),
                    metric: translateMetric(task.metric)
                },
                // 수정 모드에서 사용할 원본 영어 값
                performanceOriginal: {
                    type: task.performanceType,
                    evaluation: task.evaluationType,
                    metric: task.metric
                },
                achievement: task.achievement || 0 // 백엔드에서 계산된 달성률 사용
            }));

            console.log('Loaded tasks:', formattedTasks.length);
            console.log('Tasks with isInputted status:', formattedTasks.map(t => ({
                id: t.id,
                name: t.name,
                status: t.status,
                isInputted: t.isInputted,
                isInputtedRaw: data.find(d => d.taskId === t.id)?.isInputted
            })));

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
        if (user) {
            loadTasks();
        }
    }, [user]);

    // 과제 등록/수정 완료 후 목록 새로고침
    const handleModalClose = () => {
        setIsRegisterModalOpen(false);
        setEditingTask(null);
        loadTasks(); // 목록 새로고침
    };

    // 활동내역 입력 모달 열기 (담당자 및 관리자용)
    const handleInputTask = (task) => {
        // 관리자 또는 담당자만 입력 가능
        if (!isAdmin && !isTaskManager(task)) {
            alert('해당 과제의 담당자만 입력할 수 있습니다.');
            return;
        }
        console.log('handleInputTask - task:', task);
        console.log('handleInputTask - task.performance:', task.performance);
        console.log('handleInputTask - task.performanceOriginal:', task.performanceOriginal);
        setInputTask(task);
        setIsInputModalOpen(true);
    };

    // 과제 상세 보기 (관리자용)
    const handleViewDetail = (task) => {
        setDetailTaskId(task.id);
        setIsDetailModalOpen(true);
    };

    // 테이블 row 클릭 핸들러
    const handleRowClick = (task, e) => {
        // 버튼 클릭 시에는 row 클릭 이벤트 무시
        if (e.target.closest('button') || e.target.closest('.action-buttons')) {
            return;
        }
        // 관리자는 입력 모달 열기, 담당자도 입력 모달 열기
        if (isAdmin || isTaskManager(task)) {
            handleInputTask(task);
        }
    };


    // 활동내역 입력 완료 후 목록 새로고침
    const handleInputModalClose = () => {
        setIsInputModalOpen(false);
        setInputTask(null);
        loadTasks(); // 목록 새로고침
    };

    // 과제 수정 버튼 클릭
    const handleEditTask = (task) => {
        setEditingTask({
            id: task.id,
            category1: task.category1,
            category2: task.category2,
            name: task.name,
            description: task.description,
            startDate: task.startDate,
            endDate: task.endDate,
            managers: task.managers,
            status: task.status,
            // 수정 모드에서는 원본 영어 값 사용
            performance: task.performanceOriginal || task.performance
        });
        setIsRegisterModalOpen(true);
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

    // 한글 status를 영어 키로 변환
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

        const normalized = statusMap[status];

        // 매핑되지 않은 값이 들어오면 기본값 반환
        if (!normalized) {
            console.warn(`Unknown status: "${status}", defaulting to "inProgress"`);
            return 'inProgress';
        }

        return normalized;
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            inProgress: { text: '진행중', className: 'status-badge in-progress', icon: Clock },
            completed: { text: '완료', className: 'status-badge completed', icon: CheckCircle },
            delayed: { text: '지연', className: 'status-badge delayed', icon: AlertCircle },
            stopped: { text: '중단', className: 'status-badge stopped', icon: XCircle },
        };

        const normalizedStatus = normalizeStatus(status);
        const config = statusConfig[normalizedStatus];

        // config가 없으면 기본값 사용
        if (!config) {
            console.warn(`No config found for status: "${normalizedStatus}"`);
            const defaultConfig = statusConfig.inProgress;
            const Icon = defaultConfig.icon;
            return (
                <span className={defaultConfig.className}>
                    <Icon size={12} />
                    {defaultConfig.text}
                </span>
            );
        }

        const Icon = config.icon;

        return (
            <span className={config.className}>
                <Icon size={12} />
                {config.text}
            </span>
        );
    };

    // 필터링된 과제 목록 (정밀하게)
    // API에서 이미 사용자별 과제만 반환하므로, 상태 및 검색어 필터링만 수행
    const filteredTasks = tasks
        .filter(task => {
            // 상태 필터링
            if (filterStatus === 'notInputted') {
                const normalizedTaskStatus = normalizeStatus(task.status);
                // 진행중인 과제 중 미입력인 것만 표시
                if (normalizedTaskStatus !== 'inProgress' || task.isInputted) return false;
            } else if (filterStatus !== 'all') {
                const normalizedTaskStatus = normalizeStatus(task.status);
                if (normalizedTaskStatus !== filterStatus) return false;
            }
            
            // 검색어 필터링
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const matchName = task.name.toLowerCase().includes(searchLower);
                const matchManager = task.manager.toLowerCase().includes(searchLower);
                if (!matchName && !matchManager) return false;
            }
            
            return true;
        })
        .sort((a, b) => {
            const getSortPriority = (task) => {
                const normalizedStatus = normalizeStatus(task.status);
                const isInProgress = normalizedStatus === 'inProgress';
                
                // 진행중(미입력) > 진행중(입력) > 완료 > 지연 > 중단
                if (isInProgress && !task.isInputted) return 1; // 진행중(미입력)
                if (isInProgress && task.isInputted) return 2; // 진행중(입력)
                if (normalizedStatus === 'completed') return 3; // 완료
                if (normalizedStatus === 'delayed') return 4; // 지연
                if (normalizedStatus === 'stopped') return 5; // 중단
                return 6; // 기타
            };
            
            const priorityA = getSortPriority(a);
            const priorityB = getSortPriority(b);
            
            return priorityA - priorityB;
        });

    console.log('Filtered tasks count:', filteredTasks.length);
    console.log('Total tasks count:', tasks.length);
    console.log('Is admin:', isAdmin);

    // 담당자 필터링이 적용된 과제 목록 (카운트 계산용)
    // API에서 이미 사용자별 과제만 반환하므로 tasks를 그대로 사용
    const userTasks = tasks;
    
    // 현재월 기준으로 진행중인 과제 중 활동내역이 입력되지 않은 것만 카운트
    const notInputtedCount = userTasks.filter(t => {
        const normalizedStatus = normalizeStatus(t.status);
        const isInProgress = normalizedStatus === 'inProgress';
        const isNotInputted = !t.isInputted;
        return isInProgress && isNotInputted;
    }).length;

    // 디버깅용 로그
    console.log('Not inputted count calculation:', {
        totalTasks: userTasks.length,
        inProgressTasks: userTasks.filter(t => normalizeStatus(t.status) === 'inProgress').length,
        notInputtedTasks: userTasks.filter(t => !t.isInputted).length,
        inProgressAndNotInputted: userTasks.filter(t => {
            const normalizedStatus = normalizeStatus(t.status);
            return normalizedStatus === 'inProgress' && !t.isInputted;
        }).length,
        notInputtedCount
    });

    // 디버깅용 로그
    console.log('Not inputted count calculation:', {
        totalTasks: userTasks.length,
        inProgressTasks: userTasks.filter(t => normalizeStatus(t.status) === 'inProgress').length,
        notInputtedTasks: userTasks.filter(t => !t.isInputted).length,
        inProgressAndNotInputted: userTasks.filter(t => {
            const normalizedStatus = normalizeStatus(t.status);
            return normalizedStatus === 'inProgress' && !t.isInputted;
        }).length,
        notInputtedCount
    });

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
                        전체 ({userTasks.length})
                    </button>
                    <button
                        className={filterStatus === 'notInputted' ? 'filter-btn active warning' : 'filter-btn warning'}
                        onClick={() => setFilterStatus('notInputted')}
                    >
                        미입력 ({userTasks.filter(t => normalizeStatus(t.status) === 'inProgress' && !t.isInputted).length})
                    </button>
                    <button
                        className={filterStatus === 'inProgress' ? 'filter-btn active' : 'filter-btn'}
                        onClick={() => setFilterStatus('inProgress')}
                    >
                        진행중 ({userTasks.filter(t => normalizeStatus(t.status) === 'inProgress').length})
                    </button>
                    <button
                        className={filterStatus === 'completed' ? 'filter-btn active' : 'filter-btn'}
                        onClick={() => setFilterStatus('completed')}
                    >
                        완료 ({userTasks.filter(t => normalizeStatus(t.status) === 'completed').length})
                    </button>
                    <button
                        className={filterStatus === 'delayed' ? 'filter-btn active' : 'filter-btn'}
                        onClick={() => setFilterStatus('delayed')}
                    >
                        지연 ({userTasks.filter(t => normalizeStatus(t.status) === 'delayed').length})
                    </button>
                    <button
                        className={filterStatus === 'stopped' ? 'filter-btn active' : 'filter-btn'}
                        onClick={() => setFilterStatus('stopped')}
                    >
                        중단 ({userTasks.filter(t => normalizeStatus(t.status) === 'stopped').length})
                    </button>
                </div>
            </div>

            <div className="tasks-table-container">
                <table className="tasks-table">
                    <thead>
                        <tr>
                            <th>상태</th>
                            <th>과제명</th>
                            <th>부서 · 담당자</th>
                            <th>기간</th>
                            <th>달성률</th>
                            <th>액션</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTasks.map(task => {
                            const canView = isAdmin || isTaskManager(task);
                            return (
                                <tr
                                    key={task.id}
                                    className={`${!task.isInputted ? 'not-inputted-row' : ''} ${canView ? 'clickable-row' : ''}`}
                                    onClick={(e) => canView && handleRowClick(task, e)}
                                >
                                    <td>{getStatusBadge(task.status)}</td>
                                    <td className="name-cell">
                                        <div className="task-category-line">
                                            <span className="task-category-main">{task.category1}</span>
                                            <span className="task-category-separator"> &gt; </span>
                                            <span className="task-category-sub">{task.category2}</span>
                                        </div>
                                        <div className="task-name">{task.name}</div>
                                    </td>
                                    <td className="manager-dept-cell">
                                        {task.managers && task.managers.length > 0 ? (
                                            getManagersByDept(task.managers).map((deptGroup, idx) => (
                                                <div key={idx} className="manager-dept-item">
                                                    <span className="dept-name">{deptGroup.deptName}</span>
                                                    <div className="manager-avatars">
                                                        {deptGroup.managers.map((manager, managerIdx) => (
                                                            <div
                                                                key={manager.userId || managerIdx}
                                                                className="manager-avatar"
                                                                style={{ zIndex: deptGroup.managers.length - managerIdx }}
                                                                title={manager.mbName || '-'}
                                                            >
                                                                {/* 사진이 있을 경우 사용 (현재는 주석 처리) */}
                                                                {/* {manager.profileImage ? (
                                                                    <img 
                                                                        src={manager.profileImage} 
                                                                        alt={manager.mbName}
                                                                        className="avatar-image"
                                                                    />
                                                                ) : ( */}
                                                                    <span className="avatar-initial">
                                                                        {getInitial(manager.mbName)}
                                                                    </span>
                                                                {/* )} */}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="manager-dept-item">-</div>
                                        )}
                                    </td>
                                    <td className="date-cell">{formatDate(task.startDate)}<br />~ {formatDate(task.endDate)}</td>
                                    <td className="achievement-cell">{task.achievement}%</td>
                                    <td>
                                        <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
                                            {isAdmin && <button className="btn-edit" onClick={() => handleEditTask(task)}>수정</button>}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
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
                editData={editingTask}
            />

            <TaskInputModal
                isOpen={isInputModalOpen}
                onClose={handleInputModalClose}
                task={inputTask}
            />

            <TaskDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => {
                    setIsDetailModalOpen(false);
                    setDetailTaskId(null);
                }}
                taskId={detailTaskId}
            />
        </div>
    );
}

export default OITasks;
