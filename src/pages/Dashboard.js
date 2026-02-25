import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Target, Briefcase, BarChart3, AlertCircle, CheckCircle, Clock, XCircle, Filter, ArrowUpDown, X, Table2, GanttChart, ImageIcon, ChevronDown, ChevronUp } from 'lucide-react';
import useUserStore from '../store/userStore';
import TaskInputModal from '../components/TaskInputModal';
import { getTasksByType } from '../api/taskApi';
import { getLatestKpiImage, getKpiImageUrl } from '../api/kpiImageApi';
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

    const [activeTab, setActiveTab] = useState('oi'); // 'oi', 'key', or 'kpi'
    const [viewMode, setViewMode] = useState('table'); // 'table' or 'milestone'
    const [kpiLatestImage, setKpiLatestImage] = useState(null);
    const [kpiImageError, setKpiImageError] = useState(false);
    const [kpiTaskSectionOpen, setKpiTaskSectionOpen] = useState(false); // 기본 접힌 상태
    const [kpiImageFullscreen, setKpiImageFullscreen] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const lightboxImageRef = useRef(null);
    const [oiTasks, setOiTasks] = useState([]);
    const [keyTasks, setKeyTasks] = useState([]);
    const [kpiTasks, setKpiTasks] = useState([]);
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

    // 전체화면 ESC 닫기
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && kpiImageFullscreen) {
                closeLightbox();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [kpiImageFullscreen]);

    // 라이트박스 닫기 (줌 초기화 포함)
    const closeLightbox = () => {
        setKpiImageFullscreen(false);
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
    };

    // 줌 레벨 변경
    const handleZoomIn = (e) => {
        e && e.stopPropagation();
        setZoomLevel(prev => Math.min(prev + 0.25, 5));
    };
    const handleZoomOut = (e) => {
        e && e.stopPropagation();
        setZoomLevel(prev => {
            const next = Math.max(prev - 0.25, 0.5);
            if (next <= 1) setPanOffset({ x: 0, y: 0 });
            return next;
        });
    };
    const handleZoomReset = (e) => {
        e && e.stopPropagation();
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
    };

    // 마우스 휠 줌
    const handleLightboxWheel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        setZoomLevel(prev => {
            const next = Math.min(Math.max(prev + delta, 0.5), 5);
            if (next <= 1) setPanOffset({ x: 0, y: 0 });
            return next;
        });
    };

    // 드래그 패닝
    const handleLightboxMouseDown = (e) => {
        if (zoomLevel <= 1) return;
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    };
    const handleLightboxMouseMove = (e) => {
        if (!isDragging) return;
        setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    };
    const handleLightboxMouseUp = () => {
        setIsDragging(false);
    };

    // 과제 목록 조회
    const loadTasks = async () => {
        try {
            setLoading(true);
            const [oiData, keyData, kpiData] = await Promise.all([
                getTasksByType('OI'),
                getTasksByType('중점추진'),
                getTasksByType('KPI')
            ]);

            // 최소 딜레이 보장 (스켈레톤 UI가 보이도록)
            await new Promise(resolve => setTimeout(resolve, 300));

            // 과제 변환
            const formatTask = (task) => ({
                id: task.taskId,
                name: task.taskName,
                category1: task.category1 || '-',
                category2: task.category2 || '-',
                category3: task.category3 || '-',
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
                targetDescription: task.targetDescription || '',
                performanceType: task.performanceType || 'nonFinancial' // 재무(financial), 비재무(nonFinancial)
            });

            const formattedOiTasks = oiData.map(formatTask);
            const formattedKeyTasks = keyData.map(formatTask);
            const formattedKpiTasks = kpiData.map(formatTask);

            setOiTasks(formattedOiTasks);
            setKeyTasks(formattedKeyTasks);
            setKpiTasks(formattedKpiTasks);
        } catch (error) {
            console.error('과제 목록 조회 실패:', error);
            alert('과제 목록을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // KPI 최신 이미지 로드
    const loadKpiLatestImage = async () => {
        try {
            const image = await getLatestKpiImage();
            setKpiLatestImage(image || null);
            setKpiImageError(false);
        } catch (error) {
            // 이미지가 없는 경우(204) 또는 오류
            setKpiLatestImage(null);
        }
    };

    useEffect(() => {
        if (isAdmin) {
            loadTasks();
            loadKpiLatestImage();
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

    const currentTasks = activeTab === 'oi' ? oiTasks : activeTab === 'key' ? keyTasks : kpiTasks;
    const taskType = activeTab === 'oi' ? 'OI' : activeTab === 'key' ? '중점추진' : 'KPI';

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
            case 'category1':
                return task.category1 || '-';
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

        // 정렬이 없으면 기본 정렬: 미입력 > 상태 > 평가기준 > 담당본부
        // 1. 미입력 과제가 최상단
        if (a.isInputted !== b.isInputted) {
            return a.isInputted ? 1 : -1; // 미입력(false)이 먼저
        }

        // 2. 상태별 정렬
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
                <button
                    className={`tab-btn ${activeTab === 'kpi' ? 'active' : ''}`}
                    onClick={() => setActiveTab('kpi')}
                >
                    <BarChart3 size={16} />
                    <span>KPI 과제</span>
                    <span className="tab-count">{kpiTasks.length}</span>
                </button>
                <div className="tab-spacer"></div>
            </div>

            {/* 탭 컨텐츠 영역 */}
            <div className="tab-content">
                {/* KPI 탭: 성과지표 이미지 뷰어 / 나머지 탭: 통계 정보 */}
                {activeTab === 'kpi' ? (
                    /* KPI 성과지표 이미지 뷰어 */
                    <>
                        <div className="kpi-dashboard-image-viewer">
                            <div className="kpi-viewer-header">
                                <div className="kpi-viewer-title">
                                    <ImageIcon size={16} />
                                    <span>KPI 성과지표</span>
                                </div>
                            </div>
                            <div className="kpi-viewer-body">
                                {loading ? (
                                    <div className="kpi-viewer-placeholder">
                                        <div className="kpi-viewer-loading-spinner" />
                                        <p>로딩 중...</p>
                                    </div>
                                ) : kpiLatestImage && !kpiImageError ? (
                                    <div className="kpi-viewer-image-wrap" onClick={() => setKpiImageFullscreen(true)}>
                                        <img
                                            src={getKpiImageUrl(kpiLatestImage.imageId)}
                                            alt="KPI 성과지표"
                                            className="kpi-viewer-image"
                                            onError={() => setKpiImageError(true)}
                                        />
                                        <div className="kpi-viewer-zoom-hint">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                                            <span>클릭하여 크게 보기</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="kpi-viewer-placeholder">
                                        <ImageIcon size={48} />
                                        <p>등록된 KPI 성과지표 이미지가 없습니다.</p>
                                        <p className="kpi-viewer-placeholder-sub">KPI 과제 페이지에서 이미지를 업로드해주세요.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 전체화면 라이트박스 - Portal로 body에 직접 렌더링 (stacking context 우회) */}
                        {kpiImageFullscreen && kpiLatestImage && createPortal(
                            <div
                                className="kpi-lightbox-overlay"
                                onClick={closeLightbox}
                                onWheel={handleLightboxWheel}
                                onMouseMove={handleLightboxMouseMove}
                                onMouseUp={handleLightboxMouseUp}
                                onMouseLeave={handleLightboxMouseUp}
                            >
                                {/* 닫기 버튼 */}
                                <button
                                    className="kpi-lightbox-close"
                                    onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
                                    aria-label="닫기"
                                >
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                </button>

                                {/* 줌 컨트롤 */}
                                <div className="kpi-lightbox-zoom-controls" onClick={(e) => e.stopPropagation()}>
                                    <button className="kpi-zoom-btn" onClick={handleZoomOut} aria-label="축소" disabled={zoomLevel <= 0.5}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                                    </button>
                                    <button className="kpi-zoom-level" onClick={handleZoomReset} title="클릭하여 원래 크기로">
                                        {Math.round(zoomLevel * 100)}%
                                    </button>
                                    <button className="kpi-zoom-btn" onClick={handleZoomIn} aria-label="확대" disabled={zoomLevel >= 5}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                                    </button>
                                </div>

                                {/* 이미지 영역 */}
                                <div
                                    className="kpi-lightbox-content"
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={handleLightboxMouseDown}
                                    style={{ cursor: isDragging ? 'grabbing' : zoomLevel > 1 ? 'grab' : 'default' }}
                                >
                                    <img
                                        ref={lightboxImageRef}
                                        src={getKpiImageUrl(kpiLatestImage.imageId)}
                                        alt="KPI 성과지표"
                                        className="kpi-lightbox-image"
                                        style={{
                                            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
                                            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                            userSelect: 'none',
                                        }}
                                        draggable={false}
                                    />
                                </div>
                                <p className="kpi-lightbox-hint">
                                    {zoomLevel > 1 ? '드래그하여 이동 · 휠로 줌 · ESC로 닫기' : '휠 또는 + 버튼으로 확대 · ESC로 닫기'}
                                </p>
                            </div>,
                            document.body
                        )}
                    </>
                ) : (
                    <>
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
                    </>
                )}

                {/* KPI 탭: 과제 목록 섹션 접기/펼치기 토글 */}
                {activeTab === 'kpi' && !loading && (
                    <div
                        className="kpi-task-section-toggle"
                        onClick={() => setKpiTaskSectionOpen(prev => !prev)}
                    >
                        <div className="kpi-task-section-toggle-left">
                            <span className="kpi-task-section-toggle-label">KPI 과제 목록</span>
                            {sortedTasks.length > 0 && (
                                <span className="kpi-task-section-toggle-count">{sortedTasks.length}건</span>
                            )}
                        </div>
                        <span className="kpi-task-section-toggle-icon">
                            {kpiTaskSectionOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </span>
                    </div>
                )}

                {/* 뷰 선택 버튼 - KPI 탭이면 접기 상태 적용 */}
                {(!loading && sortedTasks.length > 0) && (activeTab !== 'kpi' || kpiTaskSectionOpen) && (
                    <div className="dashboard-view-selector">
                        <button
                            className={`view-selector-btn ${viewMode === 'table' ? 'active' : ''}`}
                            onClick={() => setViewMode('table')}
                        >
                            <Table2 size={16} />
                            <span>테이블</span>
                        </button>
                        <button
                            className={`view-selector-btn ${viewMode === 'milestone' ? 'active' : ''}`}
                            onClick={() => setViewMode('milestone')}
                        >
                            <GanttChart size={16} />
                            <span>마일스톤</span>
                        </button>
                        {viewMode === 'milestone' && (
                            <div className="milestone-legend">
                                <div className="legend-item">
                                    <div className="legend-color inProgress"></div>
                                    <span>진행중</span>
                                </div>
                                <div className="legend-item">
                                    <div className="legend-color completed"></div>
                                    <span>완료</span>
                                </div>
                                <div className="legend-item">
                                    <div className="legend-color delayed"></div>
                                    <span>지연</span>
                                </div>
                                <div className="legend-item">
                                    <div className="legend-color stopped"></div>
                                    <span>중단</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 컴팩트 카드 그리드 - KPI 탭이면 접기 상태 적용 */}
                <div className={`tasks-section-in-tab${activeTab === 'kpi' && !kpiTaskSectionOpen ? ' kpi-tasks-hidden' : ''}`}>
                    {loading ? (
                        <TableSkeleton rows={8} columns={7} />
                    ) : sortedTasks.length === 0 ? (
                        <div className="dashboard-empty-state">
                            <div className="dashboard-empty-icon">📭</div>
                            <p>{taskType} 과제가 없습니다.</p>
                        </div>
                    ) : viewMode === 'table' ? (
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
                                            className={`dashboard-table-row row-status-${normalizeStatus(task.status)}`}
                                            onClick={() => handleRowClick(task)}
                                        >
                                            <td className="dashboard-table-status">
                                                    <span className={`dashboard-table-status-badge ${normalizeStatus(task.status)}`}>
                                                        <StatusIcon size={13} />
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
                                                                        {task.category3 && task.category3 !== '-' && (
                                                                            <>
                                                                                <span className="category-separator"> &gt; </span>
                                                                                <span className="category-text">{task.category3}</span>
                                                                            </>
                                                                        )}
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
                                                {!isQualitative && (
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
                    ) : (
                        <div className="dashboard-milestone-view">
                            <div className="milestone-header">
                                <div className="milestone-status-header">
                                    <div className="table-header-filter">
                                        <span
                                            className="sortable-header"
                                            onClick={() => handleSort('status')}
                                        >
                                            상태
                                        </span>
                                        <button
                                            ref={el => filterButtonRefs.current['status-milestone'] = el}
                                            className={`filter-icon-btn ${headerFilters.status.length > 0 ? 'active' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFilterDropdown('status-milestone', e);
                                            }}
                                        >
                                            <Filter size={14} />
                                            {headerFilters.status.length > 0 && (
                                                <span className="filter-count">{headerFilters.status.length}</span>
                                            )}
                                        </button>
                                        {activeFilterDropdown === 'status-milestone' && (
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
                                </div>
                                <div
                                    className="milestone-task-header sortable-header"
                                    onClick={() => handleSort('category1')}
                                    style={{ cursor: 'pointer' }}
                                >
                                    과제명
                                    {sortConfig.column === 'category1' && sortConfig.direction && (
                                        <span className="sort-indicator">
                                            {sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}
                                        </span>
                                    )}
                                </div>
                                <div className="milestone-timeline-header">
                                    <div className="milestone-months">
                                        {Array.from({ length: 12 }, (_, i) => {
                                            const currentMonth = new Date().getMonth() + 1;
                                            const isCurrentMonth = (i + 1) === currentMonth;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`milestone-month-label ${isCurrentMonth ? 'current-month' : ''}`}
                                                >
                                                    {i + 1}월
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="milestone-tasks">
                                {sortedTasks.map(task => {
                                    const normalizedStatus = normalizeStatus(task.status);
                                    const startDate = task.startDate ? new Date(task.startDate) : null;
                                    const endDate = task.endDate ? new Date(task.endDate) : null;
                                    const currentYear = new Date().getFullYear();

                                    // 과제 기간 계산 (현재 년도 기준)
                                    let startMonth = null;
                                    let endMonth = null;

                                    if (startDate && endDate) {
                                        const startYear = startDate.getFullYear();
                                        const endYear = endDate.getFullYear();

                                        // 현재 년도와 겹치는 기간만 표시
                                        if (endYear >= currentYear && startYear <= currentYear) {
                                            if (startYear === currentYear) {
                                                startMonth = startDate.getMonth() + 1;
                                            } else if (startYear < currentYear) {
                                                startMonth = 1; // 년도가 이전이면 1월부터
                                            }

                                            if (endYear === currentYear) {
                                                endMonth = endDate.getMonth() + 1;
                                            } else if (endYear > currentYear) {
                                                endMonth = 12; // 년도가 이후면 12월까지
                                            }
                                        }
                                    }

                                    // 본부 정보 추출
                                    const topDeptSet = new Set();
                                    if (task.managers && task.managers.length > 0) {
                                        task.managers.forEach(manager => {
                                            if (manager.topDeptName) {
                                                topDeptSet.add(manager.topDeptName);
                                            }
                                        });
                                    }
                                    if (topDeptSet.size === 0 && task.topDeptName) {
                                        topDeptSet.add(task.topDeptName);
                                    }
                                    const topDeptNames = Array.from(topDeptSet);

                                    // 목표/실적/달성률 포맷팅
                                    const isQualitative = task.evaluationType === 'qualitative';
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

                                    // 정성 평가의 경우 현재 월까지 진행률 계산
                                    let progressPercentage = task.achievement || 0;
                                    if (isQualitative && startMonth !== null && endMonth !== null) {
                                        const now = new Date();
                                        const currentMonth = now.getMonth() + 1;
                                        const totalMonths = endMonth - startMonth + 1;
                                        const elapsedMonths = Math.min(Math.max(currentMonth - startMonth + 1, 0), totalMonths);
                                        progressPercentage = Math.round((elapsedMonths / totalMonths) * 100);
                                    }

                                    const statusInfo = getStatusInfo(task.status);
                                    const StatusIcon = statusInfo.icon;

                                    return (
                                        <div key={task.id} className="milestone-row" onClick={() => handleRowClick(task)}>
                                            <div className="milestone-status-cell">
                                                <span className={`dashboard-table-status-badge ${normalizeStatus(task.status)}`}>
                                                    <StatusIcon size={14} />
                                                    {statusInfo.text}
                                                </span>
                                            </div>
                                            <div className="milestone-task-info">
                                                <div className="milestone-task-name">
                                                    <div className="milestone-category-path">
                                                        {task.category1 && task.category1 !== '-' ? (
                                                            <>
                                                                <span className="category-text">{task.category1}</span>
                                                                {task.category2 && task.category2 !== '-' && (
                                                                    <>
                                                                        <span className="category-separator"> &gt; </span>
                                                                        <span className="category-text">{task.category2}</span>
                                                                        {task.category3 && task.category3 !== '-' && (
                                                                            <>
                                                                                <span className="category-separator"> &gt; </span>
                                                                                <span className="category-text">{task.category3}</span>
                                                                            </>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="category-text">-</span>
                                                        )}
                                                    </div>
                                                    <div className="milestone-task-name-text">{task.name}</div>
                                                </div>
                                            </div>
                                            <div className="milestone-timeline">
                                                <div className="milestone-progress-container">
                                                    {Array.from({ length: 12 }, (_, i) => (
                                                        <div key={i + 1} className="milestone-month-cell"></div>
                                                    ))}
                                                    {startMonth !== null && endMonth !== null && (
                                                        <div
                                                            className={`milestone-progress-bar-wrapper ${normalizedStatus}`}
                                                            style={{
                                                                gridColumn: `${startMonth} / ${endMonth + 1}`,
                                                                ['--achievement']: `${Math.min(progressPercentage, 100)}%`
                                                            }}
                                                        >
                                                            <div className={`milestone-progress-bar ${normalizedStatus}`}>
                                                                <div className="milestone-progress-fill"></div>
                                                            </div>
                                                            {!isQualitative && (
                                                                <span className="milestone-achievement-label">
                                                                    {task.achievement || 0}%
                                                                </span>
                                                            )}
                                                            {!isQualitative ? (
                                                                <div className="milestone-progress-tooltip">
                                                                    {task.targetDescription && task.targetDescription.trim() && (
                                                                        <div className="tooltip-row tooltip-row-description">
                                                                            <span className="tooltip-description">{task.targetDescription}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="tooltip-row">
                                                                        <span className="tooltip-label">목표</span>
                                                                        <span className="tooltip-value">{formatValue(task.targetValue, task.metric)}</span>
                                                                    </div>
                                                                    <div className="tooltip-row">
                                                                        <span className="tooltip-label">실적</span>
                                                                        <span className="tooltip-value">{formatValue(task.actualValue, task.metric)}</span>
                                                                    </div>
                                                                    <div className="tooltip-row achievement">
                                                                        <span className="tooltip-label">달성률</span>
                                                                        <span className="tooltip-value">{task.achievement || 0}%</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="milestone-progress-tooltip">
                                                                    {task.targetDescription && task.targetDescription.trim() && (
                                                                        <div className="tooltip-row tooltip-row-description">
                                                                            <span className="tooltip-description">{task.targetDescription}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="tooltip-row">
                                                                        <span className="tooltip-value">정성 평가 입니다.</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
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
