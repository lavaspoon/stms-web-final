import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Briefcase, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
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

    // 상태별 정렬 (진행/완료/지연/중단 순)
    const statusOrder = {
        'inProgress': 1,
        'completed': 2,
        'delayed': 3,
        'stopped': 4
    };

    const sortedTasks = [...currentTasks].sort((a, b) => {
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
                                        <th>상태</th>
                                        <th>과제명</th>
                                        <th>평가기준</th>
                                        <th>목표</th>
                                        <th>실적</th>
                                        <th>달성률</th>
                                        <th>담당 부서</th>
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
                                                        if (!task.managers || task.managers.length === 0) {
                                                            return <span className="dashboard-badge dashboard-badge-default">-</span>;
                                                        }
                                                        // 부서명 중복 제거
                                                        const deptSet = new Set();
                                                        task.managers.forEach(manager => {
                                                            if (manager.deptName) {
                                                                deptSet.add(manager.deptName);
                                                            }
                                                        });
                                                        const deptNames = Array.from(deptSet);
                                                        if (deptNames.length === 0) {
                                                            return <span className="dashboard-badge dashboard-badge-default">-</span>;
                                                        }
                                                        return (
                                                            <div className="dashboard-badges-wrapper">
                                                                {deptNames.map((deptName, idx) => {
                                                                    // 해당 부서의 담당자들 필터링
                                                                    const deptManagers = task.managers.filter(manager =>
                                                                        manager.deptName === deptName
                                                                    );
                                                                    const validManagers = deptManagers
                                                                        .map(manager => manager.mbName)
                                                                        .filter(name => name && name !== '-');

                                                                    let tooltipText = '';
                                                                    if (validManagers.length === 0) {
                                                                        tooltipText = '';
                                                                    } else if (validManagers.length === 1) {
                                                                        tooltipText = validManagers[0];
                                                                    } else {
                                                                        tooltipText = `${validManagers[0]}외 ${validManagers.length - 1}명`;
                                                                    }

                                                                    return (
                                                                        <div key={idx} className="dashboard-dept-badge-wrapper">
                                                                            <span className="dashboard-badge dashboard-badge-dept">
                                                                                {deptName}
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

            {/* 활동내역 입력 모달 */}
            <TaskInputModal
                isOpen={isInputModalOpen}
                onClose={handleInputModalClose}
                task={inputTask}
            />
        </div>
    );
}

export default Dashboard;
