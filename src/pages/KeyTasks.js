import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, AlertCircle, CheckCircle, Clock, XCircle, Filter, ChevronDown, X, ArrowUpDown } from 'lucide-react';
import useUserStore from '../store/userStore';
import TaskRegisterModal from '../components/TaskRegisterModal';
import TaskInputModal from '../components/TaskInputModal';
import TaskDetailModal from '../components/TaskDetailModal';
import { getTasksByType } from '../api/taskApi';
import { TableSkeleton } from '../components/Skeleton';
import './KeyTasks.css';
import './Dashboard.css';

function KeyTasks() {
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
            // 관리자는 모든 과제 조회, 담당자는 본부 전체 과제 조회
            const [data] = await Promise.all([
                getTasksByType('중점추진', null), // 모든 과제 조회
                new Promise(resolve => setTimeout(resolve, 300)) // 최소 300ms 딜레이
            ]);

            console.log('Loaded tasks:', data.length);
            console.log('Current user:', user);

            // 사용자의 본부 정보 찾기 (담당자인 경우)
            let userTopDeptName = null;
            if (!isAdmin && user) {
                const skid = user?.skid || user?.userId;
                // 사용자가 담당자인 과제에서 본부 정보 찾기
                for (const task of data) {
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

            // 백엔드 데이터를 화면 포맷으로 변환
            let formattedTasks = data.map(task => ({
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
                topDeptName: task.topDeptName || '-', // 담당 본부
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
                achievement: task.achievement || 0, // 백엔드에서 계산된 달성률 사용
                targetValue: task.targetValue || 0, // 목표값
                actualValue: task.actualValue || 0, // 실적값
                evaluationType: task.evaluationType, // 평가 유형 (정량/정성)
                metric: task.metric, // 지표 (건수/금액/%)
                visibleYn: task.visibleYn || 'Y' // 공개여부
            }));

            // 공개여부 필터링: 공개여부가 N인 경우 관리자와 담당자만 볼 수 있음
            formattedTasks = formattedTasks.filter(task => {
                // 공개여부가 Y이면 모든 사용자에게 표시
                if (task.visibleYn === 'Y') {
                    return true;
                }
                // 공개여부가 N이면 관리자 또는 담당자만 볼 수 있음
                if (isAdmin) {
                    return true; // 관리자는 모든 과제 조회 가능
                }
                // 담당자인지 확인
                return isTaskManager(task);
            });

            // 담당자인 경우 본부 기준으로 필터링
            if (!isAdmin && userTopDeptName) {
                formattedTasks = formattedTasks.filter(task => {
                    // 과제의 담당자 중 사용자의 본부와 일치하는 본부가 있는지 확인
                    if (task.managers && task.managers.length > 0) {
                        return task.managers.some(manager =>
                            manager.topDeptName === userTopDeptName
                        );
                    }
                    // 담당자가 없으면 과제의 본부 확인
                    return task.topDeptName === userTopDeptName;
                });
            }

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
                const evaluationType = task.evaluationType || task.performance?.evaluation || task.performanceOriginal?.evaluation || '';
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

    // 과제 등록/수정 완료 후 목록 새로고침
    const handleModalClose = () => {
        setIsRegisterModalOpen(false);
        setEditingTask(null);
        loadTasks(); // 목록 새로고침
    };

    // 활동내역 입력 모달 열기 (모든 과제 열람 가능, 담당자가 아닌 경우 읽기 전용)
    const handleInputTask = (task) => {
        // 모든 과제를 열람 가능 (TaskInputModal에서 담당자 여부에 따라 읽기 전용 모드 적용)
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
        // 모든 과제를 열람 가능 (담당자가 아닌 경우 읽기 전용 모드로 열림)
        handleInputTask(task);
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
            targetValue: task.targetValue, // 목표값 추가
            visibleYn: task.visibleYn || 'Y', // 공개여부
            // 수정 모드에서는 원본 영어 값 사용
            performance: task.performanceOriginal || task.performance
        });
        setIsRegisterModalOpen(true);
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

    const getStatusInfo = (status) => {
        const statusConfig = {
            inProgress: { text: '진행중', className: 'status-badge in-progress', icon: Clock, color: '#3b82f6' },
            completed: { text: '완료', className: 'status-badge completed', icon: CheckCircle, color: '#10b981' },
            delayed: { text: '지연', className: 'status-badge delayed', icon: AlertCircle, color: '#ef4444' },
            stopped: { text: '중단', className: 'status-badge stopped', icon: XCircle, color: '#6b7280' },
        };
        return statusConfig[normalizeStatus(status)] || statusConfig.inProgress;
    };


    // 모든 담당 본부 목록 추출
    const getAllDepts = () => {
        const deptSet = new Set();
        tasks.forEach(task => {
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

    // API에서 이미 사용자별 과제만 반환하므로, 상태 및 검색어 필터링만 수행
    const filteredTasks = tasks
        .filter(task => {
            // 헤더 필터: 상태
            if (headerFilters.status.length > 0) {
                const normalizedTaskStatus = normalizeStatus(task.status);
                if (!headerFilters.status.includes(normalizedTaskStatus)) return false;
            }

            // 헤더 필터: 평가기준
            if (headerFilters.evaluation.length > 0) {
                const evaluationType = task.evaluationType || task.performance?.evaluation || task.performanceOriginal?.evaluation || '';
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

            // 상태 필터링 (기존 필터 버튼)
            if (filterStatus === 'notInputted') {
                const normalizedTaskStatus = normalizeStatus(task.status);
                // 진행중인 과제 중 미입력인 것만 표시
                if (normalizedTaskStatus !== 'inProgress' || task.isInputted) return false;
            } else if (filterStatus === 'myTeam') {
                // 내팀 필터: 사용자의 팀과 같은 팀에 속한 담당자가 있는 과제만 표시
                const userDeptName = user?.deptName;
                if (!userDeptName) return false;
                if (!task.managers || task.managers.length === 0) return false;
                const hasMyTeamManager = task.managers.some(manager =>
                    manager.deptName === userDeptName
                );
                if (!hasMyTeamManager) return false;
            } else if (filterStatus !== 'all') {
                const normalizedTaskStatus = normalizeStatus(task.status);
                if (normalizedTaskStatus !== filterStatus) return false;
            }

            // 검색어 필터링
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const matchName = task.name.toLowerCase().includes(searchLower);
                // 모든 담당자 이름 검색
                const matchManager = task.managers && task.managers.length > 0
                    ? task.managers.some(manager => {
                        const managerName = manager.mbName || '';
                        return managerName.toLowerCase().includes(searchLower);
                    })
                    : false;
                if (!matchName && !matchManager) return false;
            }

            return true;
        })
        .sort((a, b) => {
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

            // 정렬이 없으면 기본 정렬: 미입력 > 상태 > 평가기준 > 담당본부
            // 1. 미입력 과제가 최상단
            if (a.isInputted !== b.isInputted) {
                return a.isInputted ? 1 : -1; // 미입력(false)이 먼저
            }

            // 2. 상태별 정렬
            const statusOrder = {
                'inProgress': 1,
                'completed': 2,
                'delayed': 3,
                'stopped': 4
            };
            const statusA = normalizeStatus(a.status);
            const statusB = normalizeStatus(b.status);
            const orderA = statusOrder[statusA] || 99;
            const orderB = statusOrder[statusB] || 99;
            if (orderA !== orderB) {
                return orderA - orderB;
            }

            // 3. 평가기준 정렬 (정성 < 정량)
            const evalA = getSortValue(a, 'evaluation');
            const evalB = getSortValue(b, 'evaluation');
            const evalComparison = evalA.localeCompare(evalB, 'ko');
            if (evalComparison !== 0) {
                return evalComparison;
            }

            // 4. 담당본부 정렬
            const deptA = getSortValue(a, 'dept');
            const deptB = getSortValue(b, 'dept');
            return deptA.localeCompare(deptB, 'ko');
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
        return normalizedStatus === 'inProgress' && !t.isInputted;
    }).length;

    return (
        <div className="key-tasks">
            <div className="key-page-header">
                <div>
                    <h1>중점추진과제</h1>
                    <p className="key-page-subtitle">전사 중점추진과제를 관리하고 진행 현황을 확인합니다</p>
                </div>
                <div className="header-actions">
                    {isAdmin && (
                        <button className="key-primary-btn" onClick={() => setIsRegisterModalOpen(true)}>
                            <Plus size={18} />
                            과제 등록
                        </button>
                    )}
                </div>
            </div>

            {notInputtedCount > 0 && (
                <div className="key-alert-banner">
                    <AlertCircle size={20} />
                    <span>이번 달 활동내역이 입력되지 않은 과제가 <strong>{notInputtedCount}개</strong> 있습니다.</span>
                </div>
            )}

            <div className="key-filter-section">
                <div className="key-search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="과제명 또는 담당자 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {hasActiveFilters() && (
                        <button
                            className="clear-all-filters-btn"
                            onClick={clearAllFilters}
                            title="모든 필터 초기화"
                        >
                            <X size={16} />
                            필터 초기화
                        </button>
                    )}
                </div>

                <div className="key-filter-buttons">
                    <button
                        className={filterStatus === 'all' ? 'key-filter-btn active' : 'key-filter-btn'}
                        onClick={() => setFilterStatus('all')}
                    >
                        전체 ({userTasks.length})
                    </button>
                    {user?.deptName && (
                        <button
                            className={filterStatus === 'myTeam' ? 'key-filter-btn active my-team' : 'key-filter-btn my-team'}
                            onClick={() => setFilterStatus('myTeam')}
                        >
                            {user.deptName} ({userTasks.filter(t => {
                                if (!t.managers || t.managers.length === 0) return false;
                                return t.managers.some(manager => manager.deptName === user.deptName);
                            }).length})
                        </button>
                    )}
                    <button
                        className={filterStatus === 'notInputted' ? 'key-filter-btn active warning' : 'key-filter-btn warning'}
                        onClick={() => setFilterStatus('notInputted')}
                    >
                        미입력 ({userTasks.filter(t => normalizeStatus(t.status) === 'inProgress' && !t.isInputted).length})
                    </button>
                    <button
                        className={filterStatus === 'inProgress' ? 'key-filter-btn active' : 'key-filter-btn'}
                        onClick={() => setFilterStatus('inProgress')}
                    >
                        진행중 ({userTasks.filter(t => normalizeStatus(t.status) === 'inProgress').length})
                    </button>
                    <button
                        className={filterStatus === 'completed' ? 'key-filter-btn active' : 'key-filter-btn'}
                        onClick={() => setFilterStatus('completed')}
                    >
                        완료 ({userTasks.filter(t => normalizeStatus(t.status) === 'completed').length})
                    </button>
                    <button
                        className={filterStatus === 'delayed' ? 'key-filter-btn active' : 'key-filter-btn'}
                        onClick={() => setFilterStatus('delayed')}
                    >
                        지연 ({userTasks.filter(t => normalizeStatus(t.status) === 'delayed').length})
                    </button>
                    <button
                        className={filterStatus === 'stopped' ? 'key-filter-btn active' : 'key-filter-btn'}
                        onClick={() => setFilterStatus('stopped')}
                    >
                        중단 ({userTasks.filter(t => normalizeStatus(t.status) === 'stopped').length})
                    </button>
                </div>
            </div>

            <div className="key-tasks-table-container">
                {loading ? (
                    <TableSkeleton rows={8} columns={isAdmin ? 8 : 7} />
                ) : (
                    <table className="key-tasks-table dashboard-table">
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
                                {isAdmin && <th>액션</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTasks.length === 0 ? (
                                <tr>
                                    <td colSpan={isAdmin ? 8 : 7} className="empty-table-message">
                                        <div className="empty-table-content">
                                            <Filter size={32} />
                                            <p>조건에 맞는 과제가 없습니다.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredTasks.map(task => {
                                    // 모든 과제를 열람 가능
                                    const canView = true;
                                    const statusInfo = getStatusInfo(task.status);
                                    const StatusIcon = statusInfo.icon;
                                    const evaluationType = task.evaluationType || task.performance?.evaluation || task.performanceOriginal?.evaluation || '';
                                    const isQualitative = evaluationType === 'qualitative' || evaluationType === '정성';
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
                                            className={`dashboard-table-row ${!task.isInputted ? 'key-not-inputted-row' : ''} ${canView ? 'key-clickable-row' : ''}`}
                                            onClick={(e) => canView && handleRowClick(task, e)}
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
                                                        {task.visibleYn === 'N' && (
                                                            <span className="private-badge" title="비공개 과제">Private</span>
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
                                                        {formatValue(task.targetValue, task.metric || task.performanceOriginal?.metric)}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="dashboard-table-actual">
                                                {isQualitative ? (
                                                    <span className="dashboard-badge dashboard-badge-default">-</span>
                                                ) : (
                                                    <span className="dashboard-badge dashboard-badge-actual">
                                                        {formatValue(task.actualValue, task.metric || task.performanceOriginal?.metric)}
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
                                            {isAdmin && (
                                                <td>
                                                    <div className="key-action-buttons" onClick={(e) => e.stopPropagation()}>
                                                        <button className="key-btn-edit" onClick={() => handleEditTask(task)}>수정</button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            <TaskRegisterModal
                isOpen={isRegisterModalOpen}
                onClose={handleModalClose}
                taskType="중점추진"
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

export default KeyTasks;
