import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Briefcase, AlertCircle, CheckCircle, Clock, XCircle, Filter, ArrowUpDown, X } from 'lucide-react';
import useUserStore from '../store/userStore';
import TaskInputModal from '../components/TaskInputModal';
import { getTasksByType } from '../api/taskApi';
import { formatDate } from '../utils/dateUtils';
import { TableSkeleton, StatBoxSkeleton } from '../components/Skeleton';
import './Dashboard.css';

function Dashboard() {
    const navigate = useNavigate();
    const { user } = useUserStore();
    const isAdmin = user?.role === '관리자';

    // 관리자만 접근 가능 (담당자 차단)
    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        if (!isAdmin) {
            alert('대시보드는 관리자만 접근할 수 있습니다.');
            navigate('/key-tasks');
        }
    }, [user, isAdmin, navigate]);

    const [activeTab, setActiveTab] = useState('oi'); // 'oi' or 'key'
    const [oiTasks, setOiTasks] = useState([]);
    const [keyTasks, setKeyTasks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [inputTask, setInputTask] = useState(null);
    const [isInputModalOpen, setIsInputModalOpen] = useState(false);

    // 테이블 헤더 필터 상태
    const [headerFilters, setHeaderFilters] = useState({
        status: [],
        evaluation: [],
        dept: []
    });
    const [activeFilterDropdown, setActiveFilterDropdown] = useState(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const filterDropdownRef = useRef(null);
    const filterButtonRefs = useRef({});

    // 정렬 상태
    const [sortConfig, setSortConfig] = useState({
        column: null,
        direction: null // 'asc' or 'desc'
    });

    // 과제 목록 조회
    const loadTasks = async () => {
        try {
            setLoading(true);
            const [oiData, keyData] = await Promise.all([
                getTasksByType('OI'),
                getTasksByType('중점추진')
            ]);

            // 최소 딜레이 보장 (스켈레톤 UI가 보이도록)
            await new Promise(resolve => setTimeout(resolve, 300));

            // 과제 변환
            const formatTask = (task) => ({
                id: task.taskId,
                name: task.taskName,
                category1: task.category1 || '-',
                category2: task.category2 || '-',
                status: task.status || 'inProgress',
                manager: task.managers && task.managers.length > 0 ? task.managers[0].mbName : '-',
                managers: task.managers || [], // 전체 담당자 배열
                deptName: task.deptName || '-',
                topDeptName: task.topDeptName || '-',
                achievement: task.achievement || 0,
                description: task.description || '',
                startDate: task.startDate,
                endDate: task.endDate,
                metric: task.metric || 'percent', // 건수(count), 금액(amount), %(percent)
                evaluationType: task.evaluationType || 'quantitative', // 정량(quantitative), 정성(qualitative)
                targetValue: task.targetValue || 0,
                actualValue: task.actualValue || 0,
                performanceType: task.performanceType || 'nonFinancial' // 재무(financial), 비재무(nonFinancial)
            });

            const formattedOiTasks = oiData.map(formatTask);
            const formattedKeyTasks = keyData.map(formatTask);

            setOiTasks(formattedOiTasks);
            setKeyTasks(formattedKeyTasks);
        } catch (error) {
            console.error('과제 목록 조회 실패:', error);
            alert('과제 목록을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) {
            loadTasks();
        }
    }, [isAdmin]);

    // 필터 드롭다운 외부 클릭 감지
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
                // 필터 아이콘 버튼 클릭은 제외
                if (!event.target.closest('.filter-icon-btn')) {
                    setActiveFilterDropdown(null);
                }
            }
        };

        if (activeFilterDropdown) {
            // 약간의 지연을 두어 현재 클릭 이벤트가 먼저 처리되도록
            const timeoutId = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 0);

            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [activeFilterDropdown]);

    if (!isAdmin) {
        return null;
    }

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
        return statusMap[status] || 'inProgress';
    };

    const getStatusInfo = (status) => {
        const statusConfig = {
            inProgress: { text: '진행중', className: 'status-badge in-progress', icon: Clock, color: '#3b82f6' },
            completed: { text: '완료', className: 'status-badge completed', icon: CheckCircle, color: '#10b981' },
            delayed: { text: '지연', className: 'status-badge delayed', icon: AlertCircle, color: '#ef4444' },
            stopped: { text: '중단', className: 'status-badge stopped', icon: XCircle, color: '#6b7280' },
        };
        return statusConfig[normalizeStatus(status)] || statusConfig.inProgress;
    };

    const currentTasks = activeTab === 'oi' ? oiTasks : keyTasks;
    const taskType = activeTab === 'oi' ? 'OI' : '중점추진';

    // 헤더 필터 토글
    const toggleFilterDropdown = (column, event) => {
        // 이벤트 전파 중지
        if (event) {
            event.stopPropagation();
        }
        // 같은 필터를 다시 클릭하면 닫기
        if (activeFilterDropdown === column) {
            setActiveFilterDropdown(null);
        } else {
            // 버튼 위치 계산
            const buttonRef = filterButtonRefs.current[column];
            if (buttonRef) {
                const rect = buttonRef.getBoundingClientRect();
                setDropdownPosition({
                    top: rect.bottom + 8,
                    left: rect.left + (rect.width / 2)
                });
            }
            setActiveFilterDropdown(column);
        }
    };

    // 필터 옵션 토글
    const toggleFilterOption = (filterType, value) => {
        setHeaderFilters(prev => {
            const currentValues = prev[filterType] || [];
            const newValues = currentValues.includes(value)
                ? currentValues.filter(v => v !== value)
                : [...currentValues, value];
            return { ...prev, [filterType]: newValues };
        });
    };

    // 필터 초기화
    const clearFilter = (filterType) => {
        setHeaderFilters(prev => ({ ...prev, [filterType]: [] }));
    };

    // 모든 필터 초기화
    const clearAllFilters = () => {
        setHeaderFilters({ status: [], evaluation: [], dept: [] });
    };

    // 필터 적용 여부 확인
    const hasActiveFilters = () => {
        return headerFilters.status.length > 0 ||
            headerFilters.evaluation.length > 0 ||
            headerFilters.dept.length > 0;
    };

    // 모든 담당 본부 목록 추출
    const getAllDepts = () => {
        const deptSet = new Set();
        currentTasks.forEach(task => {
            if (task.managers && task.managers.length > 0) {
                task.managers.forEach(manager => {
                    if (manager.topDeptName) {
                        deptSet.add(manager.topDeptName);
                    }
                });
            }
            // 담당자가 없거나 본부 정보가 없으면 과제의 본부 사용
            if (deptSet.size === 0 && task.topDeptName) {
                deptSet.add(task.topDeptName);
            }
        });
        return Array.from(deptSet).sort();
    };

    // 헤더 클릭 정렬 핸들러
    const handleSort = (column) => {
        setSortConfig(prevConfig => {
            if (prevConfig.column === column) {
                // 같은 컬럼 클릭 시: asc -> desc -> null (정렬 해제)
                if (prevConfig.direction === 'asc') {
                    return { column, direction: 'desc' };
                } else if (prevConfig.direction === 'desc') {
                    return { column: null, direction: null };
                }
            }
            // 새로운 컬럼 클릭 시: asc로 시작
            return { column, direction: 'asc' };
        });
    };

    // 필터링된 과제 목록
    const filteredTasks = currentTasks.filter(task => {
        // 헤더 필터: 상태
        if (headerFilters.status.length > 0) {
            const normalizedTaskStatus = normalizeStatus(task.status);
            if (!headerFilters.status.includes(normalizedTaskStatus)) return false;
        }

        // 헤더 필터: 평가기준
        if (headerFilters.evaluation.length > 0) {
            const evaluationType = task.evaluationType || 'quantitative';
            const evaluationValue = evaluationType === 'qualitative' || evaluationType === '정성' ? '정성' : '정량';
            if (!headerFilters.evaluation.includes(evaluationValue)) return false;
        }

        // 헤더 필터: 담당 본부
        if (headerFilters.dept.length > 0) {
            const taskDepts = new Set();
            if (task.managers && task.managers.length > 0) {
                task.managers.forEach(manager => {
                    if (manager.topDeptName) {
                        taskDepts.add(manager.topDeptName);
                    }
                });
            }
            // 담당자가 없거나 본부 정보가 없으면 과제의 본부 사용
            if (taskDepts.size === 0 && task.topDeptName) {
                taskDepts.add(task.topDeptName);
            }
            const hasMatchingDept = Array.from(taskDepts).some(dept => headerFilters.dept.includes(dept));
            if (!hasMatchingDept) return false;
        }

        return true;
    });

    // 정렬 함수
    const getSortValue = (task, column) => {
        switch (column) {
            case 'status':
                const statusOrder = {
                    'inProgress': 1,
                    'completed': 2,
                    'delayed': 3,
                    'stopped': 4
                };
                return statusOrder[normalizeStatus(task.status)] || 99;
            case 'name':
                return task.name || '';
            case 'evaluation':
                const evaluationType = task.evaluationType || 'quantitative';
                return evaluationType === 'qualitative' || evaluationType === '정성' ? '정성' : '정량';
            case 'target':
                return task.targetValue || 0;
            case 'actual':
                return task.actualValue || 0;
            case 'achievement':
                return task.achievement || 0;
            case 'dept':
                const topDeptSet = new Set();
                if (task.managers && task.managers.length > 0) {
                    task.managers.forEach(manager => {
                        if (manager.topDeptName) {
                            topDeptSet.add(manager.topDeptName);
                        }
                    });
                }
                // 담당자가 없거나 본부 정보가 없으면 과제의 본부 사용
                if (topDeptSet.size === 0 && task.topDeptName) {
                    topDeptSet.add(task.topDeptName);
                }
                return Array.from(topDeptSet).sort().join(',');
            default:
                return '';
        }
    };

    // 상태별 정렬 (진행/완료/지연/중단 순) - 정렬이 없을 때 기본 정렬
    const statusOrder = {
        'inProgress': 1,
        'completed': 2,
        'delayed': 3,
        'stopped': 4
    };

    const sortedTasks = [...filteredTasks].sort((a, b) => {
        // 정렬 설정이 있으면 해당 정렬 적용
        if (sortConfig.column && sortConfig.direction) {
            const aValue = getSortValue(a, sortConfig.column);
            const bValue = getSortValue(b, sortConfig.column);

            let comparison = 0;
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue, 'ko');
            } else {
                comparison = aValue - bValue;
            }

            return sortConfig.direction === 'asc' ? comparison : -comparison;
        }

        // 정렬이 없으면 기본 상태별 정렬
        const statusA = normalizeStatus(a.status);
        const statusB = normalizeStatus(b.status);
        const orderA = statusOrder[statusA] || 99;
        const orderB = statusOrder[statusB] || 99;
        return orderA - orderB;
    });

    // 활동내역 입력 모달 열기 (관리자용)
    const handleInputTask = (task) => {
        setInputTask(task);
        setIsInputModalOpen(true);
    };

    // 활동내역 입력 완료 후 목록 새로고침
    const handleInputModalClose = () => {
        setIsInputModalOpen(false);
        setInputTask(null);
        loadTasks(); // 목록 새로고침
    };

    // 테이블 row 클릭 핸들러
    const handleRowClick = (task) => {
        handleInputTask(task);
    };

    // 상태별 통계 계산
    const statusCounts = {
        inProgress: 0,
        completed: 0,
        delayed: 0,
        stopped: 0
    };

    sortedTasks.forEach(task => {
        const normalizedStatus = normalizeStatus(task.status);
        if (statusCounts[normalizedStatus] !== undefined) {
            statusCounts[normalizedStatus]++;
        }
    });

    // 정량 평가 기준 전체 평균 달성률 계산
    const quantitativeTasks = sortedTasks.filter(task => {
        const evaluationType = task.evaluationType || 'quantitative';
        return evaluationType === 'quantitative' || evaluationType === '정량';
    });

    let averageAchievement = 0;
    if (quantitativeTasks.length > 0) {
        const totalAchievement = quantitativeTasks.reduce((sum, task) => {
            return sum + (task.achievement || 0);
        }, 0);
        averageAchievement = Math.round(totalAchievement / quantitativeTasks.length);
    }

    // 최상위 본부별 통계 계산
    const deptStats = {};

    sortedTasks.forEach(task => {
        // 담당자들의 최상위 본부 수집
        const topDepts = new Set();

        if (task.managers && task.managers.length > 0) {
            task.managers.forEach(manager => {
                if (manager.topDeptName) {
                    topDepts.add(manager.topDeptName);
                }
            });
        }

        // 담당자가 없거나 본부 정보가 없으면 과제의 본부 사용
        if (topDepts.size === 0 && task.topDeptName) {
            topDepts.add(task.topDeptName);
        }

        // 본부가 없으면 미지정
        if (topDepts.size === 0) {
            topDepts.add('미지정');
        }

        // 각 본부에 과제 통계 추가
        topDepts.forEach(dept => {
            if (!deptStats[dept]) {
                deptStats[dept] = {
                    total: 0,
                    inProgress: 0,
                    completed: 0,
                    delayed: 0,
                    stopped: 0
                };
            }

            const normalizedStatus = normalizeStatus(task.status);
            deptStats[dept].total++;

            if (normalizedStatus === 'inProgress') {
                deptStats[dept].inProgress++;
            } else if (normalizedStatus === 'completed') {
                deptStats[dept].completed++;
            } else if (normalizedStatus === 'delayed') {
                deptStats[dept].delayed++;
            } else if (normalizedStatus === 'stopped') {
                deptStats[dept].stopped++;
            }
        });
    });

    // 본부명으로 정렬
    const sortedDeptStats = Object.entries(deptStats)
        .map(([deptName, stats]) => ({ deptName, ...stats }))
        .sort((a, b) => {
            if (a.deptName === '미지정') return 1;
            if (b.deptName === '미지정') return -1;
            return a.deptName.localeCompare(b.deptName);
        });

    return (
        <div className="dashboard">
            {/* 탭 네비게이션 - 브라우저 스타일 */}
            <div className="tab-navigation">
                <button
                    className={`tab-btn ${activeTab === 'oi' ? 'active' : ''}`}
                    onClick={() => setActiveTab('oi')}
                >
                    <Target size={16} />
                    <span>OI 과제</span>
                    <span className="tab-count">{oiTasks.length}</span>
                </button>
                <button
                    className={`tab-btn ${activeTab === 'key' ? 'active' : ''}`}
                    onClick={() => setActiveTab('key')}
                >
                    <Briefcase size={16} />
                    <span>중점추진과제</span>
                    <span className="tab-count">{keyTasks.length}</span>
                </button>
                <div className="tab-spacer"></div>
            </div>

            {/* 탭 컨텐츠 영역 */}
            <div className="tab-content">
                {/* 전체 평균 달성률 및 본부별 현황 */}
                {!loading && (
                    <div className="dashboard-stats-row">
                        {/* 전체 평균 달성률 카드 */}
                        {quantitativeTasks.length > 0 && (
                            <div className="dashboard-average-achievement">
                                <div className="average-achievement-card">
                                    <div className="average-achievement-content">
                                        <div className="average-achievement-label">전체 평균 달성률</div>
                                        <div className="average-achievement-value">{averageAchievement}%</div>
                                        <div className="average-achievement-subtext">정량 평가 기준</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 본부별 현황표 */}
                        {sortedDeptStats.length > 0 && (
                            <div className="dashboard-dept-stats">
                                <div className="dept-stats-table-wrapper">
                                    <table className="dept-stats-table">
                                        <thead>
                                            <tr>
                                                <th>본부</th>
                                                <th>전체</th>
                                                <th>진행</th>
                                                <th>완료</th>
                                                <th>지연</th>
                                                <th>중단</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedDeptStats.map((dept) => (
                                                <tr key={dept.deptName}>
                                                    <td className="dept-name-cell">{dept.deptName}</td>
                                                    <td className="dept-stat-cell total">{dept.total}</td>
                                                    <td className="dept-stat-cell in-progress">{dept.inProgress}</td>
                                                    <td className="dept-stat-cell completed">{dept.completed}</td>
                                                    <td className="dept-stat-cell delayed">{dept.delayed}</td>
                                                    <td className="dept-stat-cell stopped">{dept.stopped}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 상태별 통계 박스 */}
                {loading ? (
                    <div className="dashboard-status-stats">
                        <StatBoxSkeleton count={4} />
                    </div>
                ) : (
                    <div className="dashboard-status-stats">
                        <div className="status-stat-box in-progress">
                            <div className="status-stat-icon">
                                <Clock size={24} />
                            </div>
                            <div className="status-stat-content">
                                <div className="status-stat-label">진행중</div>
                                <div className="status-stat-value">{statusCounts.inProgress}</div>
                            </div>
                        </div>
                        <div className="status-stat-box completed">
                            <div className="status-stat-icon">
                                <CheckCircle size={24} />
                            </div>
                            <div className="status-stat-content">
                                <div className="status-stat-label">완료</div>
                                <div className="status-stat-value">{statusCounts.completed}</div>
                            </div>
                        </div>
                        <div className="status-stat-box delayed">
                            <div className="status-stat-icon">
                                <AlertCircle size={24} />
                            </div>
                            <div className="status-stat-content">
                                <div className="status-stat-label">지연</div>
                                <div className="status-stat-value">{statusCounts.delayed}</div>
                            </div>
                        </div>
                        <div className="status-stat-box stopped">
                            <div className="status-stat-icon">
                                <XCircle size={24} />
                            </div>
                            <div className="status-stat-content">
                                <div className="status-stat-label">중단</div>
                                <div className="status-stat-value">{statusCounts.stopped}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 컴팩트 카드 그리드 */}
                <div className="tasks-section-in-tab">
                    {loading ? (
                        <TableSkeleton rows={8} columns={7} />
                    ) : sortedTasks.length === 0 ? (
                        <div className="dashboard-empty-state">
                            <div className="dashboard-empty-icon">📭</div>
                            <p>{taskType} 과제가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="dashboard-table-container">
                            <table className="dashboard-table">
                                <thead>
                                    <tr>
                                        <th>
                                            <div className="table-header-filter">
                                                <span
                                                    className="sortable-header"
                                                    onClick={() => handleSort('status')}
                                                >
                                                    상태
                                                </span>
                                                <button
                                                    ref={el => filterButtonRefs.current['status'] = el}
                                                    className={`filter-icon-btn ${headerFilters.status.length > 0 ? 'active' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFilterDropdown('status', e);
                                                    }}
                                                >
                                                    <Filter size={14} />
                                                    {headerFilters.status.length > 0 && (
                                                        <span className="filter-count">{headerFilters.status.length}</span>
                                                    )}
                                                </button>
                                                {activeFilterDropdown === 'status' && (
                                                    <div
                                                        className="filter-dropdown"
                                                        ref={filterDropdownRef}
                                                        style={{
                                                            top: `${dropdownPosition.top}px`,
                                                            left: `${dropdownPosition.left}px`,
                                                            transform: 'translateX(-50%)'
                                                        }}
                                                    >
                                                        <div className="filter-dropdown-header">
                                                            <span>상태 필터</span>
                                                            {headerFilters.status.length > 0 && (
                                                                <button
                                                                    className="filter-clear-btn"
                                                                    onClick={() => clearFilter('status')}
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="filter-options">
                                                            {['inProgress', 'completed', 'delayed', 'stopped'].map(status => {
                                                                const statusMap = {
                                                                    inProgress: '진행중',
                                                                    completed: '완료',
                                                                    delayed: '지연',
                                                                    stopped: '중단'
                                                                };
                                                                return (
                                                                    <label key={status} className="filter-option">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={headerFilters.status.includes(status)}
                                                                            onChange={() => toggleFilterOption('status', status)}
                                                                        />
                                                                        <span>{statusMap[status]}</span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </th>
                                        <th>
                                            <span
                                                className="sortable-header"
                                                onClick={() => handleSort('name')}
                                            >
                                                과제명
                                            </span>
                                        </th>
                                        <th>
                                            <div className="table-header-filter">
                                                <span
                                                    className="sortable-header"
                                                    onClick={() => handleSort('evaluation')}
                                                >
                                                    평가기준
                                                </span>
                                                <button
                                                    ref={el => filterButtonRefs.current['evaluation'] = el}
                                                    className={`filter-icon-btn ${headerFilters.evaluation.length > 0 ? 'active' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFilterDropdown('evaluation', e);
                                                    }}
                                                >
                                                    <Filter size={14} />
                                                    {headerFilters.evaluation.length > 0 && (
                                                        <span className="filter-count">{headerFilters.evaluation.length}</span>
                                                    )}
                                                </button>
                                                {activeFilterDropdown === 'evaluation' && (
                                                    <div
                                                        className="filter-dropdown"
                                                        ref={filterDropdownRef}
                                                        style={{
                                                            top: `${dropdownPosition.top}px`,
                                                            left: `${dropdownPosition.left}px`,
                                                            transform: 'translateX(-50%)'
                                                        }}
                                                    >
                                                        <div className="filter-dropdown-header">
                                                            <span>평가기준 필터</span>
                                                            {headerFilters.evaluation.length > 0 && (
                                                                <button
                                                                    className="filter-clear-btn"
                                                                    onClick={() => clearFilter('evaluation')}
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="filter-options">
                                                            {['정량', '정성'].map(evalType => (
                                                                <label key={evalType} className="filter-option">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={headerFilters.evaluation.includes(evalType)}
                                                                        onChange={() => toggleFilterOption('evaluation', evalType)}
                                                                    />
                                                                    <span>{evalType}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </th>
                                        <th>
                                            <span
                                                className="sortable-header"
                                                onClick={() => handleSort('target')}
                                            >
                                                목표
                                            </span>
                                        </th>
                                        <th>
                                            <span
                                                className="sortable-header"
                                                onClick={() => handleSort('actual')}
                                            >
                                                실적
                                            </span>
                                        </th>
                                        <th>
                                            <span
                                                className="sortable-header"
                                                onClick={() => handleSort('achievement')}
                                            >
                                                달성률
                                            </span>
                                        </th>
                                        <th>
                                            <div className="table-header-filter">
                                                <span
                                                    className="sortable-header"
                                                    onClick={() => handleSort('dept')}
                                                >
                                                    담당 본부
                                                </span>
                                                <button
                                                    ref={el => filterButtonRefs.current['dept'] = el}
                                                    className={`filter-icon-btn ${headerFilters.dept.length > 0 ? 'active' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFilterDropdown('dept', e);
                                                    }}
                                                >
                                                    <Filter size={14} />
                                                    {headerFilters.dept.length > 0 && (
                                                        <span className="filter-count">{headerFilters.dept.length}</span>
                                                    )}
                                                </button>
                                                {activeFilterDropdown === 'dept' && (
                                                    <div
                                                        className="filter-dropdown filter-dropdown-wide"
                                                        ref={filterDropdownRef}
                                                        style={{
                                                            top: `${dropdownPosition.top}px`,
                                                            left: `${dropdownPosition.left}px`,
                                                            transform: 'translateX(-50%)'
                                                        }}
                                                    >
                                                        <div className="filter-dropdown-header">
                                                            <span>담당 본부 필터</span>
                                                            {headerFilters.dept.length > 0 && (
                                                                <button
                                                                    className="filter-clear-btn"
                                                                    onClick={() => clearFilter('dept')}
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="filter-options">
                                                            {getAllDepts().map(dept => (
                                                                <label key={dept} className="filter-option">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={headerFilters.dept.includes(dept)}
                                                                        onChange={() => toggleFilterOption('dept', dept)}
                                                                    />
                                                                    <span>{dept}</span>
                                                                </label>
                                                            ))}
                                                            {getAllDepts().length === 0 && (
                                                                <div className="filter-empty">본부 정보가 없습니다</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedTasks.map(task => {
                                        const statusInfo = getStatusInfo(task.status);
                                        const StatusIcon = statusInfo.icon;
                                        const isQualitative = task.evaluationType === 'qualitative';

                                        // 평가기준 표시
                                        const evaluationText = isQualitative ? '정성' : '정량';

                                        // 목표/실적 포맷팅 (정량일 때만)
                                        const formatValue = (value, metric) => {
                                            if (value === null || value === undefined || value === 0) return '0';
                                            const numValue = typeof value === 'number' ? value : parseFloat(value);
                                            if (metric === 'amount') {
                                                return numValue.toLocaleString('ko-KR') + '원';
                                            } else if (metric === 'count') {
                                                return numValue.toLocaleString('ko-KR') + '건';
                                            } else if (metric === 'percent') {
                                                return numValue.toLocaleString('ko-KR') + '%';
                                            } else {
                                                return numValue.toLocaleString('ko-KR');
                                            }
                                        };

                                        // metric 한글 변환
                                        const metricText = task.metric === 'count' ? '건수' :
                                            task.metric === 'amount' ? '금액' :
                                                task.metric === 'percent' ? '%' : task.metric || '-';

                                        // 날짜를 mm.dd 형식으로 변환
                                        const formatCompactDate = (dateString) => {
                                            if (!dateString) return '';
                                            try {
                                                const date = new Date(dateString);
                                                if (isNaN(date.getTime())) return '';
                                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                                const day = String(date.getDate()).padStart(2, '0');
                                                return `${month}.${day}`;
                                            } catch (error) {
                                                return '';
                                            }
                                        };

                                        return (
                                            <tr
                                                key={task.id}
                                                className="dashboard-table-row"
                                                onClick={() => handleRowClick(task)}
                                            >
                                                <td className="dashboard-table-status">
                                                    <span className={`dashboard-table-status-badge ${normalizeStatus(task.status)}`}>
                                                        <StatusIcon size={14} />
                                                        {statusInfo.text}
                                                    </span>
                                                </td>
                                                <td className="dashboard-table-task-name">
                                                    <div className="task-name-wrapper">
                                                        <div className="task-category-path">
                                                            {task.category1 && task.category1 !== '-' ? (
                                                                <>
                                                                    <span className="category-text">{task.category1}</span>
                                                                    {task.category2 && task.category2 !== '-' && (
                                                                        <>
                                                                            <span className="category-separator"> &gt; </span>
                                                                            <span className="category-text">{task.category2}</span>
                                                                        </>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span className="category-text">-</span>
                                                            )}
                                                        </div>
                                                        <div className="task-name">{task.name}</div>
                                                    </div>
                                                </td>
                                                <td className="dashboard-table-evaluation">
                                                    <span className="dashboard-badge dashboard-badge-evaluation">
                                                        {evaluationText}
                                                    </span>
                                                </td>
                                                <td className="dashboard-table-target">
                                                    {isQualitative ? (
                                                        <span className="dashboard-badge dashboard-badge-default">-</span>
                                                    ) : (
                                                        <span className="dashboard-badge dashboard-badge-target">
                                                            {formatValue(task.targetValue, task.metric)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="dashboard-table-actual">
                                                    {isQualitative ? (
                                                        <span className="dashboard-badge dashboard-badge-default">-</span>
                                                    ) : (
                                                        <span className="dashboard-badge dashboard-badge-actual">
                                                            {formatValue(task.actualValue, task.metric)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="dashboard-table-achievement">
                                                    {isQualitative ? (
                                                        <span className="dashboard-badge dashboard-badge-default">-</span>
                                                    ) : (
                                                        <span className="dashboard-badge dashboard-badge-achievement">
                                                            {task.achievement || 0}%
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="dashboard-table-dept">
                                                    {(() => {
                                                        // 본부명 중복 제거
                                                        const topDeptSet = new Set();
                                                        if (task.managers && task.managers.length > 0) {
                                                            task.managers.forEach(manager => {
                                                                if (manager.topDeptName) {
                                                                    topDeptSet.add(manager.topDeptName);
                                                                }
                                                            });
                                                        }
                                                        // 담당자가 없거나 본부 정보가 없으면 과제의 본부 사용
                                                        if (topDeptSet.size === 0 && task.topDeptName) {
                                                            topDeptSet.add(task.topDeptName);
                                                        }
                                                        const topDeptNames = Array.from(topDeptSet);
                                                        if (topDeptNames.length === 0) {
                                                            return <span className="dashboard-badge dashboard-badge-default">-</span>;
                                                        }
                                                        return (
                                                            <div className="dashboard-badges-wrapper">
                                                                {topDeptNames.map((topDeptName, idx) => {
                                                                    // 해당 본부의 팀들 필터링
                                                                    const topDeptManagers = task.managers ? task.managers.filter(manager =>
                                                                        manager.topDeptName === topDeptName
                                                                    ) : [];
                                                                    // 팀명(deptName) 중복 제거
                                                                    const teamNames = Array.from(new Set(
                                                                        topDeptManagers
                                                                            .map(manager => manager.deptName)
                                                                            .filter(name => name && name !== '-')
                                                                    ));

                                                                    let tooltipText = '';
                                                                    if (teamNames.length === 0) {
                                                                        tooltipText = '';
                                                                    } else if (teamNames.length === 1) {
                                                                        tooltipText = teamNames[0];
                                                                    } else {
                                                                        tooltipText = `${teamNames[0]}외 ${teamNames.length - 1}개 팀`;
                                                                    }

                                                                    return (
                                                                        <div key={idx} className="dashboard-dept-badge-wrapper">
                                                                            <span className="dashboard-badge dashboard-badge-dept">
                                                                                {topDeptName}
                                                                            </span>
                                                                            {tooltipText && (
                                                                                <span className="dashboard-dept-tooltip">
                                                                                    {tooltipText}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* 활동내역 입력 모달 - 통합 대시보드에서는 읽기 전용 */}
            <TaskInputModal
                isOpen={isInputModalOpen}
                onClose={handleInputModalClose}
                task={inputTask}
                forceReadOnly={true}
            />
        </div>
    );
}

export default Dashboard;
