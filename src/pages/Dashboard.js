import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Briefcase, AlertCircle, CheckCircle, Clock, XCircle, Sparkles, TrendingUp, Calendar, Eye, BarChart3, Hash, DollarSign } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import useUserStore from '../store/userStore';
import TaskDetailModal from '../components/TaskDetailModal';
import { getTasksByType, getYearlyGoals } from '../api/taskApi';
import { generateBriefing } from '../api/aiApi';
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
    const [briefing, setBriefing] = useState(null);
    const [loading, setLoading] = useState(false);
    const [briefingLoading, setBriefingLoading] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState(null);
    const [oiChartData, setOiChartData] = useState({
        count: [],
        amount: []
    });
    const [keyChartData, setKeyChartData] = useState({
        count: [],
        amount: []
    });
    const [chartLoading, setChartLoading] = useState(false);
    const [selectedDept, setSelectedDept] = useState(null); // 필터: null = 전체, 본부명 = 해당 본부

    // 과제 목록 조회
    const loadTasks = async () => {
        try {
            setLoading(true);
            const [oiData, keyData] = await Promise.all([
                getTasksByType('OI'),
                getTasksByType('중점추진')
            ]);

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
                metric: task.metric || 'percent' // 건수(count), 금액(amount), %(percent)
            });

            const formattedOiTasks = oiData.map(formatTask);
            const formattedKeyTasks = keyData.map(formatTask);

            setOiTasks(formattedOiTasks);
            setKeyTasks(formattedKeyTasks);

            // 차트 데이터 로드 (각 탭별로 분리)
            loadChartData(oiData, 'oi');
            loadChartData(keyData, 'key');

            // AI 브리핑 자동 생성
            loadBriefing([...formattedOiTasks, ...formattedKeyTasks]);
        } catch (error) {
            console.error('과제 목록 조회 실패:', error);
            alert('과제 목록을 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // 차트 데이터 로드
    const loadChartData = async (tasksData, tabType) => {
        try {
            setChartLoading(true);
            const currentYear = new Date().getFullYear();
            
            // 성과지표별로 과제 분류
            const tasksByMetric = {
                count: tasksData.filter(t => normalizeMetric(t.metric) === 'count'),
                amount: tasksData.filter(t => normalizeMetric(t.metric) === 'amount')
            };

            const chartDataByMetric = {};

            // 각 성과지표별로 데이터 집계 (건수, 금액)
            for (const [metricKey, tasks] of Object.entries(tasksByMetric)) {
                if (tasks.length === 0) {
                    chartDataByMetric[metricKey] = [];
                    continue;
                }

                // 모든 과제의 월별 목표/실적 데이터 가져오기
                const yearlyGoalsPromises = tasks.map(task => 
                    getYearlyGoals(task.taskId, currentYear).catch(() => null)
                );
                const yearlyGoalsResults = await Promise.all(yearlyGoalsPromises);

                // 월별 데이터 집계 (1월~12월)
                const monthlyData = Array.from({ length: 12 }, (_, i) => ({
                    month: `${i + 1}월`,
                    monthNum: i + 1,
                    목표: 0,
                    실적: 0,
                    달성률: 0,
                    taskCount: 0
                }));

                yearlyGoalsResults.forEach((result, taskIndex) => {
                    if (!result || !result.monthlyGoals) return;
                    
                    result.monthlyGoals.forEach(monthGoal => {
                        const monthIndex = monthGoal.month - 1;
                        if (monthIndex >= 0 && monthIndex < 12) {
                            monthlyData[monthIndex].목표 += monthGoal.targetValue || 0;
                            monthlyData[monthIndex].실적 += monthGoal.actualValue || 0;
                            monthlyData[monthIndex].taskCount += 1;
                        }
                    });
                });

                // 평균 달성률 계산
                monthlyData.forEach(data => {
                    if (data.목표 > 0) {
                        data.달성률 = Math.round((data.실적 / data.목표) * 100);
                    }
                });

                chartDataByMetric[metricKey] = monthlyData;
            }


            // 탭별로 차트 데이터 설정
            if (tabType === 'oi') {
                setOiChartData(chartDataByMetric);
            } else {
                setKeyChartData(chartDataByMetric);
            }
        } catch (error) {
            console.error('차트 데이터 로드 실패:', error);
        } finally {
            setChartLoading(false);
        }
    };

    // AI 브리핑 생성
    const loadBriefing = async (tasks) => {
        try {
            setBriefingLoading(true);
            const result = await generateBriefing(tasks);
            setBriefing(result);
        } catch (error) {
            console.error('AI 브리핑 생성 실패:', error);
            // 브리핑 실패해도 과제 목록은 표시
        } finally {
            setBriefingLoading(false);
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
    const currentChartData = activeTab === 'oi' ? oiChartData : keyChartData;
    
    // 모든 과제 (OI + 중점추진)
    const allTasks = [...oiTasks, ...keyTasks];
    
    // 본부별 과제 수 집계 (담당자들의 모든 본부 포함)
    const deptCounts = {};
    currentTasks.forEach(task => {
        // 담당자들의 모든 최상위 본부 수집
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
        // 본부가 없으면 미지정
        if (taskDepts.size === 0) {
            taskDepts.add('미지정');
        }
        
        // 각 본부에 과제 수 추가
        taskDepts.forEach(dept => {
            deptCounts[dept] = (deptCounts[dept] || 0) + 1;
        });
    });
    const totalCount = currentTasks.length;
    
    // 필터링된 과제 목록 (담당자들의 본부 중 하나라도 선택된 본부와 일치하면 포함)
    const filteredTasks = selectedDept 
        ? currentTasks.filter(task => {
            if (task.managers && task.managers.length > 0) {
                return task.managers.some(manager => manager.topDeptName === selectedDept);
            }
            return task.topDeptName === selectedDept;
        })
        : currentTasks;
    
    // 성과지표별 통계 계산
    const normalizeMetric = (metric) => {
        if (!metric) return 'percent';
        const metricMap = {
            '건수': 'count',
            '금액': 'amount',
            '%': 'percent',
            'percent': 'percent',
            'count': 'count',
            'amount': 'amount'
        };
        return metricMap[metric] || 'percent';
    };

    return (
        <div className="dashboard">
            {/* AI 브리핑 섹션 */}
            {briefingLoading ? (
                <div className="briefing-section loading">
                    <div className="briefing-loading">
                        <Sparkles size={28} className="spin-animation" />
                        <h3>AI가 전체 과제를 분석중입니다...</h3>
                        <p>잠시만 기다려주세요</p>
                    </div>
                </div>
            ) : briefing ? (
                <div className="briefing-section">
                    <div className="briefing-header">
                        <div className="briefing-title">
                            <Sparkles size={22} />
                            <h2>AI 브리핑</h2>
                        </div>
                        <span className="ai-badge">AI Generated</span>
                    </div>
                    <div className="briefing-content">
                        {/* 전체 요약 - 큰 카드 */}
                        <div className="briefing-summary">
                            <div className="summary-header">
                                <BarChart3 size={24} />
                                <h3>전체 요약</h3>
                            </div>
                            <p className="summary-text">{briefing.summary}</p>
                        </div>
                        
                        {/* 3개의 인사이트 카드 */}
                        <div className="briefing-insights">
                            <div className="insight-card highlights">
                                <div className="insight-icon">✨</div>
                                <h4>주요 성과</h4>
                                <p>{briefing.highlights}</p>
                            </div>
                            <div className="insight-card concerns">
                                <div className="insight-icon">⚠️</div>
                                <h4>주의사항</h4>
                                <p>{briefing.concerns}</p>
                            </div>
                            <div className="insight-card recommendations">
                                <div className="insight-icon">💡</div>
                                <h4>권장사항</h4>
                                <p>{briefing.recommendations}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

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
                {/* 월별 성과지표 차트 섹션 */}
                {!chartLoading && (currentChartData.count?.length > 0 || currentChartData.amount?.length > 0) && (
                    <div className="charts-section-in-tab">
                        <div className="charts-header">
                            <TrendingUp size={22} />
                            <h2>{taskType} 과제 월별 성과 추이</h2>
                        </div>
                        <div className="charts-grid">
                            {/* 건수 차트 */}
                            {currentChartData.count && currentChartData.count.length > 0 && (() => {
                                const totalTarget = currentChartData.count.reduce((sum, item) => sum + (item.목표 || 0), 0);
                                const totalActual = currentChartData.count.reduce((sum, item) => sum + (item.실적 || 0), 0);
                                const achievementRate = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
                                
                                return (
                                    <div className="chart-card">
                                        <div className="chart-title">
                                            <Hash size={18} className="chart-icon" style={{ color: '#3b82f6' }} />
                                            <h3>건수 목표 대비 월별 달성</h3>
                                        </div>
                                        <ResponsiveContainer width="100%" height={200}>
                                            <LineChart data={currentChartData.count}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                                <XAxis 
                                                    dataKey="month" 
                                                    tick={{ fontSize: 12 }}
                                                    stroke="#6b7280"
                                                />
                                                <YAxis 
                                                    tick={{ fontSize: 12 }}
                                                    stroke="#6b7280"
                                                />
                                                <Tooltip 
                                                    contentStyle={{ 
                                                        backgroundColor: 'white', 
                                                        border: '1px solid #e5e7eb',
                                                        borderRadius: '8px',
                                                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                                    }}
                                                />
                                                <Legend 
                                                    wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }}
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="목표" 
                                                    stroke="#94a3b8" 
                                                    strokeWidth={2}
                                                    strokeDasharray="5 5"
                                                    dot={{ r: 4 }}
                                                    name="목표 건수"
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="실적" 
                                                    stroke="#3b82f6" 
                                                    strokeWidth={3}
                                                    dot={{ r: 5, fill: '#3b82f6' }}
                                                    name="실적 건수"
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                        <div className="chart-stats">
                                            <div className="stat-item">
                                                <span className="stat-label">목표 건수</span>
                                                <span className="stat-value">{totalTarget.toLocaleString()}건</span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-label">실적 건수</span>
                                                <span className="stat-value">{totalActual.toLocaleString()}건</span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-label">달성률</span>
                                                <span className="stat-value achievement">{achievementRate}%</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 금액 차트 */}
                            {currentChartData.amount && currentChartData.amount.length > 0 && (() => {
                                const totalTarget = currentChartData.amount.reduce((sum, item) => sum + (item.목표 || 0), 0);
                                const totalActual = currentChartData.amount.reduce((sum, item) => sum + (item.실적 || 0), 0);
                                const achievementRate = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
                                
                                return (
                                    <div className="chart-card">
                                        <div className="chart-title">
                                            <DollarSign size={18} className="chart-icon" style={{ color: '#10b981' }} />
                                            <h3>금액 목표 대비 월별 달성</h3>
                                        </div>
                                        <ResponsiveContainer width="100%" height={200}>
                                            <LineChart data={currentChartData.amount}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                                <XAxis 
                                                    dataKey="month" 
                                                    tick={{ fontSize: 12 }}
                                                    stroke="#6b7280"
                                                />
                                                <YAxis 
                                                    tick={{ fontSize: 12 }}
                                                    stroke="#6b7280"
                                                />
                                                <Tooltip 
                                                    contentStyle={{ 
                                                        backgroundColor: 'white', 
                                                        border: '1px solid #e5e7eb',
                                                        borderRadius: '8px',
                                                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                                                    }}
                                                />
                                                <Legend 
                                                    wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }}
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="목표" 
                                                    stroke="#94a3b8" 
                                                    strokeWidth={2}
                                                    strokeDasharray="5 5"
                                                    dot={{ r: 4 }}
                                                    name="목표 금액"
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="실적" 
                                                    stroke="#10b981" 
                                                    strokeWidth={3}
                                                    dot={{ r: 5, fill: '#10b981' }}
                                                    name="실적 금액"
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                        <div className="chart-stats">
                                            <div className="stat-item">
                                                <span className="stat-label">목표 금액</span>
                                                <span className="stat-value">{totalTarget.toLocaleString()}원</span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-label">실적 금액</span>
                                                <span className="stat-value">{totalActual.toLocaleString()}원</span>
                                            </div>
                                            <div className="stat-item">
                                                <span className="stat-label">달성률</span>
                                                <span className="stat-value achievement">{achievementRate}%</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                        </div>
                    </div>
                )}

                {/* 필터 버튼 */}
                {!loading && currentTasks.length > 0 && (
                    <div className="task-filters">
                        <button
                            className={`filter-btn ${selectedDept === null ? 'active' : ''}`}
                            onClick={() => setSelectedDept(null)}
                        >
                            전체
                            <span className="filter-count">({totalCount})</span>
                        </button>
                        {Object.keys(deptCounts).sort().map(dept => (
                            <button
                                key={dept}
                                className={`filter-btn ${selectedDept === dept ? 'active' : ''}`}
                                onClick={() => setSelectedDept(dept)}
                            >
                                {dept}
                                <span className="filter-count">({deptCounts[dept]})</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* 컴팩트 카드 그리드 */}
                <div className="tasks-section-in-tab">
                    {loading ? (
                        <div className="loading-state">
                            <div className="loading-spinner"></div>
                            <p>데이터를 불러오는 중...</p>
                        </div>
                    ) : filteredTasks.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📭</div>
                            <p>{selectedDept ? `${selectedDept} 소속 ${taskType} 과제가 없습니다.` : `${taskType} 과제가 없습니다.`}</p>
                        </div>
                    ) : (
                        <div className="tasks-grid">
                            {filteredTasks.map(task => {
                                const statusInfo = getStatusInfo(task.status);
                                const StatusIcon = statusInfo.icon;
                                
                                return (
                                    <div 
                                        key={task.id} 
                                        className="task-card"
                                        onClick={() => setSelectedTaskId(task.id)}
                                    >
                                        {/* 카드 헤더 */}
                                        <div className="task-card-header">
                                            <span className="task-dept">{task.category1 || '-'}</span>
                                            <span className={`status-badge ${normalizeStatus(task.status)}`}>
                                                <StatusIcon size={11} />
                                                {statusInfo.text}
                                            </span>
                                        </div>
                                        
                                        {/* 카드 바디 */}
                                        <div className="task-card-body">
                                            <div className="task-category">
                                                {task.category2 || '-'}
                                            </div>
                                            <h3 className="task-name">{task.name}</h3>
                                            {/* 담당 팀 리스트 */}
                                            {task.managers && task.managers.length > 0 && (() => {
                                                // 팀별로 그룹화하여 중복 제거
                                                const teamSet = new Set();
                                                task.managers.forEach(manager => {
                                                    const teamName = manager.deptName || '미지정';
                                                    teamSet.add(teamName);
                                                });
                                                const teams = Array.from(teamSet);
                                                
                                                return (
                                                    <div className="task-teams">
                                                        {teams.map((teamName, index) => (
                                                            <span key={teamName}>
                                                                <span className="team-badge">{teamName}</span>
                                                                {index < teams.length - 1 && <span className="team-separator">·</span>}
                                                            </span>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </div>

                                        {/* 카드 푸터 */}
                                        <div className="task-card-footer">
                                            {/* 담당자 아바타 - 모든 담당자 겹쳐서 표시 */}
                                            {task.managers && task.managers.length > 0 && (
                                                <div className="task-managers">
                                                    {task.managers.slice(0, 5).map((manager, index) => (
                                                        <div 
                                                            key={manager.userId || index} 
                                                            className="manager-avatar"
                                                            style={{ zIndex: task.managers.length - index }}
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
                                                    {task.managers.length > 5 && (
                                                        <div 
                                                            className="manager-avatar avatar-more"
                                                            title={`외 ${task.managers.length - 5}명`}
                                                        >
                                                            <span className="avatar-initial">+{task.managers.length - 5}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            <div className="achievement-percent">
                                                <strong>{task.achievement}%</strong>
                                            </div>
                                        </div>

                                        {/* 호버 오버레이 */}
                                        <div className="task-card-overlay">
                                            <div className="overlay-content">
                                                <p className="overlay-description">
                                                    {task.description || '프로젝트 설명이 없습니다.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* 과제 상세 모달 */}
            {selectedTaskId && (
                <TaskDetailModal
                    isOpen={!!selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                    taskId={selectedTaskId}
                />
            )}
        </div>
    );
}

export default Dashboard;
