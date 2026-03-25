import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, TrendingUp, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Sparkles, CheckCircle, Wand2, Clock, AlertCircle, XCircle, Upload, Download, Trash2, Paperclip } from 'lucide-react';
import { getTask, getTaskActivity, getAllPreviousActivities, uploadActivityFile, getActivityFiles, downloadActivityFile, deleteActivityFile, getMonthlyActualValues } from '../api/taskApi';
import { checkSpelling, improveContext, generateCustomReport } from '../api/aiApi';
import { formatDate } from '../utils/dateUtils';
import { calcAchievementRate } from '../utils/achievementRate';
import { formatKoreanUnit, formatTableValue } from '../utils/formatValue';
import useUserStore from '../store/userStore';
import './TaskInputModal.css';
import axios from "axios";

// 날짜와 시간을 포맷팅하는 함수
const formatDateTime = (dateString) => {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return '';
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (error) {
        return '';
    }
};

function TaskInputModal({ isOpen, onClose, task, forceReadOnly = false }) {
    const { user } = useUserStore();
    const isAdmin = user?.role === '관리자' || user?.role === '매니저';

    // 저장 후 바로 반영용 (task는 prop이라 부모가 갱신 전까지 오래된 값일 수 있음)
    const [taskData, setTaskData] = useState(null);
    useEffect(() => {
        setTaskData(task || null);
    }, [task]);

    useEffect(() => {
        // 과제/모달이 바뀌면 펼친 툴팁을 접어두기
        setIsDescriptionTooltipOpen(false);
    }, [isOpen, task?.id]);

    // 담당자 여부 확인
    const isTaskManager = () => {
        if (!task?.managers || task.managers.length === 0) return false;
        if (!user) return false;

        const currentUserId = user.userId || user.skid;
        if (!currentUserId) return false;

        return task.managers.some(manager => {
            const managerUserId = manager.userId || manager.mbId;
            return managerUserId === currentUserId;
        });
    };

    // 읽기 전용 모드:
    // - forceReadOnly가 true인 경우 (부모에서 강제)
    // - 관리자/매니저가 아니면서, 해당 과제의 담당자가 아닌 경우
    const isReadOnly = forceReadOnly || (!isAdmin && !isTaskManager());

    const [formData, setFormData] = useState({
        activityContent: '',
        status: 'inProgress',
        actualValue: '' // 정량일 때 실적값
    });
    const [previousActivities, setPreviousActivities] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showAllActivities, setShowAllActivities] = useState(false);
    const [aiProcessing, setAiProcessing] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState(null);
    const [aiSuggestionType, setAiSuggestionType] = useState(null);
    const [customPrompt, setCustomPrompt] = useState('');
    const [showCustomPrompt, setShowCustomPrompt] = useState(false);
    const [isDescriptionTooltipOpen, setIsDescriptionTooltipOpen] = useState(false);
    const [originalText, setOriginalText] = useState(''); // diff 비교를 위한 원본 텍스트
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // 과제 기간 (startDate ~ endDate). 없으면 올해만 사용
    const taskStart = task?.startDate ? new Date(task.startDate) : null;
    const taskEnd = task?.endDate ? new Date(task.endDate) : null;
    const taskStartYear = taskStart ? taskStart.getFullYear() : currentYear;
    const taskStartMonth = taskStart ? taskStart.getMonth() + 1 : 1;
    const taskEndYear = taskEnd ? taskEnd.getFullYear() : currentYear;
    const taskEndMonth = taskEnd ? taskEnd.getMonth() + 1 : 12;

    // 뷰어 모드용 현재 보고 있는 연·월 상태
    const [viewingYear, setViewingYear] = useState(currentYear);
    const [viewingMonth, setViewingMonth] = useState(currentMonth);

    // 입력 모드용 선택한 연·월 상태 (담당자가 입력할 월)
    const [inputYear, setInputYear] = useState(currentYear);
    const [inputMonth, setInputMonth] = useState(currentMonth);

    // 활동내역 입력 시간 상태
    const [activityUpdatedAt, setActivityUpdatedAt] = useState(null);

    // 파일 관련 상태
    const [files, setFiles] = useState([]);
    const [uploadingFiles, setUploadingFiles] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]); // 선택된 파일 목록
    const [currentActivityId, setCurrentActivityId] = useState(null);
    const fileInputRef = useRef(null);

    // 최신 formData와 currentActivityId를 추적하기 위한 ref
    const formDataRef = useRef(formData);
    const currentActivityIdRef = useRef(null);

    // 월별 실적값 그래프용 상태
    const [monthlyActualValues, setMonthlyActualValues] = useState([]);
    const [hoveredPoint, setHoveredPoint] = useState(null); // 마우스 오버된 점 정보

    // 첨부파일 섹션 접기/펼치기 (기본 펼침)
    const [fileSectionOpen, setFileSectionOpen] = useState(true);

    // 월별 실적값 로드 함수 (지정 연도 또는 과제 전체 기간)
    const loadMonthlyActualValues = async (year) => {
        if (!task?.id) return;
        const targetYear = year != null ? year : (isReadOnly ? viewingYear : inputYear);
        try {
            const data = await getMonthlyActualValues(task.id, targetYear);
            setMonthlyActualValues(data || []);
        } catch (error) {
            console.error('월별 실적값 조회 실패:', error);
            setMonthlyActualValues([]);
        }
    };

    // 과제 전체 기간 월별 실적값 로드 (차트 범례에 모든 달 표시용)
    const loadAllPeriodMonthlyActualValues = async () => {
        if (!task?.id || !task?.startDate || !task?.endDate) return;
        const startY = new Date(task.startDate).getFullYear();
        const endY = new Date(task.endDate).getFullYear();
        try {
            const years = Array.from({ length: endY - startY + 1 }, (_, i) => startY + i);
            const results = await Promise.all(years.map(yr => getMonthlyActualValues(task.id, yr)));
            const merged = [];
            (results || []).forEach((arr, i) => {
                const year = years[i];
                (Array.isArray(arr) ? arr : [])?.forEach(item =>
                    merged.push({ ...item, year: item.year != null ? item.year : year })
                );
            });
            setMonthlyActualValues(merged);
        } catch (error) {
            console.error('월별 실적값 전체 조회 실패:', error);
            setMonthlyActualValues([]);
        }
    };

    // 기존 데이터 로드
    useEffect(() => {
        if (isOpen && task) {
            const startY = task?.startDate ? new Date(task.startDate).getFullYear() : currentYear;
            const startM = task?.startDate ? new Date(task.startDate).getMonth() + 1 : 1;
            const endY = task?.endDate ? new Date(task.endDate).getFullYear() : currentYear;
            const endM = task?.endDate ? new Date(task.endDate).getMonth() + 1 : 12;
            // 과제 기간 내로 초기 연·월 (오늘 기준, 기간 밖이면 시작/종료로)
            let initialYear = Math.min(Math.max(currentYear, startY), endY);
            let initialMonth = initialYear === startY && initialYear === endY
                ? Math.min(Math.max(currentMonth, startM), endM)
                : initialYear === startY
                    ? Math.max(currentMonth, startM)
                    : initialYear === endY
                        ? Math.min(currentMonth, endM)
                        : currentMonth;
            initialMonth = Math.min(Math.max(initialMonth, 1), 12);
            // 입력 모드: 미래 달은 선택 불가이므로 오늘 이하로
            if (!isReadOnly && (initialYear > currentYear || (initialYear === currentYear && initialMonth > currentMonth))) {
                initialYear = currentYear;
                initialMonth = currentMonth;
            }
            if (isReadOnly) {
                setViewingYear(initialYear);
                setViewingMonth(initialMonth);
            } else {
                setInputYear(initialYear);
                setInputMonth(initialMonth);
            }
            loadExistingData(initialYear, initialMonth);
            loadPreviousActivities();
            // 정량 평가일 때 과제 전체 기간 월별 실적값 로드 (차트 범례에 모든 달 표시)
            const evaluationType = task?.performance?.evaluation || task?.performanceOriginal?.evaluation || task?.evaluationType || '';
            if (evaluationType === 'quantitative' || evaluationType === '정량') {
                if (task?.startDate && task?.endDate) {
                    loadAllPeriodMonthlyActualValues();
                } else {
                    loadMonthlyActualValues(initialYear);
                }
            }
        } else {
            // 모달 닫을 때 초기화
            setFormData({
                activityContent: '',
                status: task?.status || 'inProgress',
                actualValue: ''
            });
            setPreviousActivities([]);
            setViewingYear(currentYear);
            setViewingMonth(currentMonth);
            setInputYear(currentYear);
            setInputMonth(currentMonth);
            setMonthlyActualValues([]);
            setActivityUpdatedAt(null);
            setFileSectionOpen(true); // 첨부파일 섹션 기본 펼침
            setSelectedFiles([]); // 선택된 파일 목록 초기화
            setUploadingFiles([]); // 업로드 중인 파일 목록 초기화
            setShowCustomPrompt(false); // 프롬프트 입력창 닫기
            setAiSuggestion(null); // AI 제안 초기화
            setAiSuggestionType(null);
            setOriginalText(''); // 원본 텍스트 초기화
            setCustomPrompt(''); // 프롬프트 초기화
        }
    }, [isOpen, task]);

    const loadExistingData = async (overrideYear, overrideMonth) => {
        try {
            setLoading(true);
            const year = overrideYear != null ? overrideYear : (isReadOnly ? viewingYear : inputYear);
            const month = overrideMonth != null ? overrideMonth : (isReadOnly ? viewingMonth : inputMonth);
            let data;
            // 뷰어/입력 모드: 선택한 연·월의 활동 내역 로드
            data = await getTaskActivity(task.id, year, month);

            if (data) {
                // 월별 실적값 사용 (백엔드에서 월별로 저장된 값 반환)
                // 소수점 유지를 위해 숫자 값을 그대로 문자열로 변환
                let actualValueStr = '';
                if (data.actualValue != null) {
                    if (typeof data.actualValue === 'number') {
                        // 숫자인 경우 소수점 유지
                        actualValueStr = data.actualValue.toString();
                    } else {
                        // 문자열인 경우 그대로 사용
                        actualValueStr = String(data.actualValue);
                    }
                }
                const newFormData = {
                    activityContent: data.activityContent || '',
                    status: task.status || 'inProgress',
                    actualValue: actualValueStr
                };
                setFormData(newFormData);
                formDataRef.current = newFormData; // ref 업데이트
                setCurrentActivityId(data.activityId);
                currentActivityIdRef.current = data.activityId; // ref 업데이트
                // 활동내역 입력 시간 저장 (updatedAt 우선, 없으면 createdAt)
                setActivityUpdatedAt(data.updatedAt || data.createdAt || null);
                // 파일 목록 로드
                if (data.activityId) {
                    loadFiles(data.activityId);
                } else {
                    setFiles([]);
                }
            } else {
                // 데이터 없음 - % 기준인 경우 이전 달 실적을 기본값으로 설정
                let defaultActualValue = '';
                if (taskMetric === 'percent') {
                    // 이전 달 실적 조회
                    const targetMonth = month;
                    const targetYear = year;
                    const prevMonth = targetMonth === 1 ? 12 : targetMonth - 1;
                    const prevYear = targetMonth === 1 ? targetYear - 1 : targetYear;
                    try {
                        const prevData = await getTaskActivity(task.id, prevYear, prevMonth);
                        if (prevData && prevData.actualValue != null) {
                            defaultActualValue = typeof prevData.actualValue === 'number'
                                ? prevData.actualValue.toString()
                                : String(prevData.actualValue);
                        }
                    } catch (error) {
                        console.error('이전 달 실적 조회 실패:', error);
                    }
                } else {
                    // 건수, 금액 기준은 0으로 기본값 설정
                    defaultActualValue = '0';
                }

                const emptyFormData = {
                    activityContent: '',
                    status: task.status || 'inProgress',
                    actualValue: defaultActualValue
                };
                setFormData(emptyFormData);
                formDataRef.current = emptyFormData; // ref 업데이트
                setCurrentActivityId(null);
                currentActivityIdRef.current = null; // ref 업데이트
                setActivityUpdatedAt(null);
                setFiles([]);
            }
        } catch (error) {
            console.error('활동내역 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadFiles = async (activityId) => {
        try {
            const fileList = await getActivityFiles(activityId);
            setFiles(fileList || []);
        } catch (error) {
            console.error('파일 목록 조회 실패:', error);
            setFiles([]);
        }
    };

    const loadPreviousActivities = async () => {
        try {
            const data = await getAllPreviousActivities(task.id, 12);
            setPreviousActivities(data);
        } catch (error) {
            console.error('이전 활동내역 조회 실패:', error);
        }
    };

    // 뷰어 모드에서 연·월이 변경될 때 해당 월의 활동내역 로드
    useEffect(() => {
        if (isReadOnly && isOpen && task) {
            const loadViewingMonthData = async () => {
                try {
                    setLoading(true);
                    const data = await getTaskActivity(task.id, viewingYear, viewingMonth);
                    if (data) {
                        // 월별 실적값 사용 (백엔드에서 월별로 저장된 값 반환)
                        // 소수점 유지를 위해 숫자 값을 그대로 문자열로 변환
                        let actualValueStr = '';
                        if (data.actualValue != null) {
                            if (typeof data.actualValue === 'number') {
                                // 숫자인 경우 소수점 유지
                                actualValueStr = data.actualValue.toString();
                            } else {
                                // 문자열인 경우 그대로 사용
                                actualValueStr = String(data.actualValue);
                            }
                        }
                        const newFormData = {
                            activityContent: data.activityContent || '',
                            status: task.status || 'inProgress',
                            actualValue: actualValueStr
                        };
                        setFormData(newFormData);
                        formDataRef.current = newFormData; // ref 업데이트
                        setCurrentActivityId(data.activityId);
                        currentActivityIdRef.current = data.activityId; // ref 업데이트
                        // 활동내역 입력 시간 저장 (updatedAt 우선, 없으면 createdAt)
                        setActivityUpdatedAt(data.updatedAt || data.createdAt || null);
                        // 파일 목록 로드
                        if (data.activityId) {
                            await loadFiles(data.activityId);
                        } else {
                            setFiles([]);
                        }
                    } else {
                        const defaultVal = (taskMetric === 'count' || taskMetric === 'amount' || taskMetric === 'monthly_avg_count'
                            || taskMetric === 'monthly_avg_head' || taskMetric === 'monthly_avg_minutes' || taskMetric === 'monthly_avg_amount'
                            || taskMetric === 'headcount' || taskMetric === 'minutes') ? '0' : '';
                        const emptyFormData = {
                            activityContent: '',
                            status: task.status || 'inProgress',
                            actualValue: defaultVal
                        };
                        setFormData(emptyFormData);
                        formDataRef.current = emptyFormData; // ref 업데이트
                        setCurrentActivityId(null);
                        currentActivityIdRef.current = null; // ref 업데이트
                        setActivityUpdatedAt(null);
                        setFiles([]);
                    }
                } catch (error) {
                    console.error('활동내역 조회 실패:', error);
                    const defaultVal = (taskMetric === 'count' || taskMetric === 'amount' || taskMetric === 'monthly_avg_count'
                        || taskMetric === 'monthly_avg_head' || taskMetric === 'monthly_avg_minutes' || taskMetric === 'monthly_avg_amount'
                        || taskMetric === 'headcount' || taskMetric === 'minutes') ? '0' : '';
                    const emptyFormData = {
                        activityContent: '',
                        status: task.status || 'inProgress',
                        actualValue: defaultVal
                    };
                    setFormData(emptyFormData);
                    formDataRef.current = emptyFormData; // ref 업데이트
                    setCurrentActivityId(null);
                    currentActivityIdRef.current = null; // ref 업데이트
                    setActivityUpdatedAt(null);
                    setFiles([]);
                } finally {
                    setLoading(false);
                }
            };
            loadViewingMonthData();
        }
    }, [viewingMonth, viewingYear, isReadOnly, isOpen, task]);

    // formData와 currentActivityId 변경 시 ref 동기화
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

    useEffect(() => {
        currentActivityIdRef.current = currentActivityId;
    }, [currentActivityId]);

    // 입력 모드에서 연·월이 변경될 때 해당 월의 활동내역 로드
    useEffect(() => {
        if (!isReadOnly && isOpen && task) {
            const loadInputMonthData = async () => {
                try {
                    setLoading(true);

                    const data = await getTaskActivity(task.id, inputYear, inputMonth);

                    if (data) {
                        // 서버 데이터 사용
                        // 월별 실적값 사용 (백엔드에서 월별로 저장된 값 반환)
                        // 소수점 유지를 위해 숫자 값을 그대로 문자열로 변환
                        let actualValueStr = '';
                        if (data.actualValue != null) {
                            if (typeof data.actualValue === 'number') {
                                // 숫자인 경우 소수점 유지
                                actualValueStr = data.actualValue.toString();
                            } else {
                                // 문자열인 경우 그대로 사용
                                actualValueStr = String(data.actualValue);
                            }
                        }
                        const newFormData = {
                            activityContent: data.activityContent || '',
                            status: task.status || 'inProgress',
                            actualValue: actualValueStr
                        };
                        setFormData(newFormData);
                        formDataRef.current = newFormData; // ref 업데이트
                        setCurrentActivityId(data.activityId);
                        currentActivityIdRef.current = data.activityId; // ref 업데이트
                        // 활동내역 입력 시간 저장 (updatedAt 우선, 없으면 createdAt)
                        setActivityUpdatedAt(data.updatedAt || data.createdAt || null);
                        // 파일 목록 로드
                        if (data.activityId) {
                            await loadFiles(data.activityId);
                        } else {
                            setFiles([]);
                        }
                    } else {
                        // 데이터 없음 - % 기준인 경우 이전 달 실적을 기본값으로 설정
                        let defaultActualValue = '';
                        if (taskMetric === 'percent') {
                            // 이전 달 실적 조회
                            const prevMonth = inputMonth === 1 ? 12 : inputMonth - 1;
                            const prevYear = inputMonth === 1 ? inputYear - 1 : inputYear;
                            try {
                                const prevData = await getTaskActivity(task.id, prevYear, prevMonth);
                                if (prevData && prevData.actualValue != null) {
                                    defaultActualValue = typeof prevData.actualValue === 'number'
                                        ? prevData.actualValue.toString()
                                        : String(prevData.actualValue);
                                }
                            } catch (error) {
                                console.error('이전 달 실적 조회 실패:', error);
                            }
                        } else {
                            // 건수, 금액 기준은 0으로 기본값 설정
                            defaultActualValue = '0';
                        }

                        const emptyFormData = {
                            activityContent: '',
                            status: task.status || 'inProgress',
                            actualValue: defaultActualValue
                        };
                        setFormData(emptyFormData);
                        formDataRef.current = emptyFormData; // ref 업데이트
                        setCurrentActivityId(null);
                        currentActivityIdRef.current = null; // ref 업데이트
                        setActivityUpdatedAt(null);
                        setFiles([]);
                    }
                } catch (error) {
                    console.error('활동내역 조회 실패:', error);
                    const defaultVal = (taskMetric === 'count' || taskMetric === 'amount' || taskMetric === 'monthly_avg_count'
                        || taskMetric === 'monthly_avg_head' || taskMetric === 'monthly_avg_minutes' || taskMetric === 'monthly_avg_amount'
                        || taskMetric === 'headcount' || taskMetric === 'minutes') ? '0' : '';
                    const emptyFormData = {
                        activityContent: '',
                        status: task.status || 'inProgress',
                        actualValue: defaultVal
                    };
                    setFormData(emptyFormData);
                    formDataRef.current = emptyFormData; // ref 업데이트
                    setCurrentActivityId(null);
                    currentActivityIdRef.current = null; // ref 업데이트
                    setActivityUpdatedAt(null);
                    setFiles([]);
                } finally {
                    setLoading(false);
                }
            };
            loadInputMonthData();
        }
    }, [inputMonth, inputYear, isReadOnly, isOpen, task]);

    // (y1,m1)이 (y2,m2) 이전 또는 같은지
    const isBeforeOrEqual = (y1, m1, y2, m2) => y1 < y2 || (y1 === y2 && m1 <= m2);
    // (y1,m1)이 (y2,m2) 이후 또는 같은지
    const isAfterOrEqual = (y1, m1, y2, m2) => y1 > y2 || (y1 === y2 && m1 >= m2);

    // 뷰어 모드에서 연·월 이동 (과제 기간 내에서만)
    const handleViewingMonthChange = (direction) => {
        if (direction === 'prev') {
            const prevMonth = viewingMonth === 1 ? 12 : viewingMonth - 1;
            const prevYear = viewingMonth === 1 ? viewingYear - 1 : viewingYear;
            if (!isAfterOrEqual(prevYear, prevMonth, taskStartYear, taskStartMonth)) return;
            setViewingYear(prevYear);
            setViewingMonth(prevMonth);
        } else {
            const nextMonth = viewingMonth === 12 ? 1 : viewingMonth + 1;
            const nextYear = viewingMonth === 12 ? viewingYear + 1 : viewingYear;
            if (!isBeforeOrEqual(nextYear, nextMonth, taskEndYear, taskEndMonth)) return;
            setViewingYear(nextYear);
            setViewingMonth(nextMonth);
        }
    };

    // 입력 모드에서 연·월 이동 (과제 기간 내 + 미래 달 불가)
    const handleInputMonthChange = (direction) => {
        if (direction === 'prev') {
            const prevMonth = inputMonth === 1 ? 12 : inputMonth - 1;
            const prevYear = inputMonth === 1 ? inputYear - 1 : inputYear;
            if (!isAfterOrEqual(prevYear, prevMonth, taskStartYear, taskStartMonth)) return;
            setInputYear(prevYear);
            setInputMonth(prevMonth);
        } else {
            const nextMonth = inputMonth === 12 ? 1 : inputMonth + 1;
            const nextYear = inputMonth === 12 ? inputYear + 1 : inputYear;
            const isFuture = nextYear > currentYear || (nextYear === currentYear && nextMonth > currentMonth);
            const afterTaskEnd = !isBeforeOrEqual(nextYear, nextMonth, taskEndYear, taskEndMonth);
            if (isFuture || afterTaskEnd) return;
            setInputYear(nextYear);
            setInputMonth(nextMonth);
        }
    };

    // 다음 달로 이동 가능한지 (과제 종료·오늘 이하)
    const canMoveToNextMonth = () => {
        const nextMonth = inputMonth === 12 ? 1 : inputMonth + 1;
        const nextYear = inputMonth === 12 ? inputYear + 1 : inputYear;
        const isFuture = nextYear > currentYear || (nextYear === currentYear && nextMonth > currentMonth);
        const afterTaskEnd = !isBeforeOrEqual(nextYear, nextMonth, taskEndYear, taskEndMonth);
        return !isFuture && !afterTaskEnd;
    };

    // 이전 달로 이동 가능한지 (과제 시작 이상)
    const canMoveToPrevViewingMonth = () => {
        const prevMonth = viewingMonth === 1 ? 12 : viewingMonth - 1;
        const prevYear = viewingMonth === 1 ? viewingYear - 1 : viewingYear;
        return isAfterOrEqual(prevYear, prevMonth, taskStartYear, taskStartMonth);
    };
    const canMoveToNextViewingMonth = () => {
        const nextMonth = viewingMonth === 12 ? 1 : viewingMonth + 1;
        const nextYear = viewingMonth === 12 ? viewingYear + 1 : viewingYear;
        return isBeforeOrEqual(nextYear, nextMonth, taskEndYear, taskEndMonth);
    };
    const canMoveToPrevInputMonth = () => {
        const prevMonth = inputMonth === 1 ? 12 : inputMonth - 1;
        const prevYear = inputMonth === 1 ? inputYear - 1 : inputYear;
        return isAfterOrEqual(prevYear, prevMonth, taskStartYear, taskStartMonth);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newData = {
                ...prev,
                [name]: value
            };
            formDataRef.current = newData; // ref 업데이트
            return newData;
        });
    };



    const handleStatusChange = (status) => {
        // 읽기 전용 모드에서는 변경 불가
        if (isReadOnly) return;

        setFormData(prev => ({ ...prev, status }));
    };


    // 단어 단위 diff 비교 함수
    const getWordLevelDiff = (original, modified) => {
        if (!original && !modified) return [];
        if (!original) return [{ type: 'added', parts: [{ type: 'added', text: modified }] }];
        if (!modified) return [{ type: 'removed', parts: [{ type: 'removed', text: original }] }];
        if (original === modified) {
            return [{ type: 'unchanged', parts: [{ type: 'unchanged', text: original }] }];
        }

        // 텍스트를 단어와 공백으로 분리 (공백도 보존)
        const tokenize = (text) => {
            const tokens = [];
            const regex = /(\S+|\s+)/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
                tokens.push(match[0]);
            }
            return tokens;
        };

        const origTokens = tokenize(original);
        const modTokens = tokenize(modified);

        // 간단한 LCS 기반 diff 알고리즘
        const diff = [];
        let origIdx = 0;
        let modIdx = 0;

        while (origIdx < origTokens.length || modIdx < modTokens.length) {
            const origToken = origTokens[origIdx];
            const modToken = modTokens[modIdx];

            if (origIdx >= origTokens.length) {
                // 원본이 끝났으면 나머지는 모두 추가
                diff.push({ type: 'added', text: modToken });
                modIdx++;
            } else if (modIdx >= modTokens.length) {
                // 수정본이 끝났으면 나머지는 모두 삭제
                diff.push({ type: 'removed', text: origToken });
                origIdx++;
            } else if (origToken === modToken) {
                // 동일한 토큰은 변경 없음
                diff.push({ type: 'unchanged', text: origToken });
                origIdx++;
                modIdx++;
            } else {
                // 다른 경우: 다음 일치하는 토큰을 찾기
                let foundInOrig = false;
                let foundInMod = false;
                let origSearchIdx = origIdx + 1;
                let modSearchIdx = modIdx + 1;

                // 수정본에서 현재 원본 토큰을 찾기
                while (modSearchIdx < modTokens.length && !foundInOrig) {
                    if (modTokens[modSearchIdx] === origToken) {
                        foundInOrig = true;
                        break;
                    }
                    modSearchIdx++;
                }

                // 원본에서 현재 수정본 토큰을 찾기
                while (origSearchIdx < origTokens.length && !foundInMod) {
                    if (origTokens[origSearchIdx] === modToken) {
                        foundInMod = true;
                        break;
                    }
                    origSearchIdx++;
                }

                // 더 가까운 일치를 선택
                if (foundInOrig && (!foundInMod || (modSearchIdx - modIdx) <= (origSearchIdx - origIdx))) {
                    // 원본 토큰이 나중에 나타남 - 현재 위치의 수정본 토큰은 추가
                    diff.push({ type: 'added', text: modToken });
                    modIdx++;
                } else if (foundInMod) {
                    // 수정본 토큰이 나중에 나타남 - 현재 위치의 원본 토큰은 삭제
                    diff.push({ type: 'removed', text: origToken });
                    origIdx++;
                } else {
                    // 둘 다 일치하지 않으면 둘 다 변경으로 처리
                    diff.push({ type: 'removed', text: origToken });
                    diff.push({ type: 'added', text: modToken });
                    origIdx++;
                    modIdx++;
                }
            }
        }

        return diff;
    };

    // AI 기능 핸들러
    const handleSpellingCheck = async () => {
        if (!formData.activityContent.trim()) {
            alert('활동내역을 먼저 입력해주세요.');
            return;
        }

        try {
            setAiProcessing(true);
            setAiSuggestion(null);
            setOriginalText(formData.activityContent); // 원본 저장
            const correctedText = await checkSpelling(formData.activityContent);
            setAiSuggestion(correctedText);
            setAiSuggestionType('spelling');
        } catch (error) {
            console.error('맞춤법 검사 실패:', error);
            alert('맞춤법 검사 중 오류가 발생했습니다.');
        } finally {
            setAiProcessing(false);
        }
    };

    const handleCustomPrompt = async () => {
        if (!customPrompt.trim()) {
            alert('프롬프트를 입력해주세요.');
            return;
        }

        if (!formData.activityContent.trim()) {
            alert('활동내역을 먼저 입력해주세요.');
            return;
        }

        try {
            setAiProcessing(true);
            setAiSuggestion(null);
            setOriginalText(formData.activityContent); // 원본 저장
            // 사용자 프롬프트와 현재 활동내역을 결합하여 AI에 전달
            const promptWithContent = `${customPrompt}\n\n현재 활동내역:\n${formData.activityContent}`;
            const result = await generateCustomReport(null, null, promptWithContent);
            setAiSuggestion(result);
            setAiSuggestionType('custom');
        } catch (error) {
            console.error('커스텀 프롬프트 처리 실패:', error);
            alert('프롬프트 처리 중 오류가 발생했습니다.');
        } finally {
            setAiProcessing(false);
        }
    };

    const handleImproveContext = async () => {
        if (!formData.activityContent.trim()) {
            alert('활동내역을 먼저 입력해주세요.');
            return;
        }

        try {
            setAiProcessing(true);
            setAiSuggestion(null);
            setOriginalText(formData.activityContent); // 원본 저장
            const improvedText = await improveContext(formData.activityContent);
            setAiSuggestion(improvedText);
            setAiSuggestionType('improve');
        } catch (error) {
            console.error('문맥 교정 실패:', error);
            alert('문맥 교정 중 오류가 발생했습니다.');
        } finally {
            setAiProcessing(false);
        }
    };

    // AI 제안 수락
    const handleAcceptSuggestion = () => {
        if (aiSuggestion) {
            setFormData(prev => ({ ...prev, activityContent: aiSuggestion }));
            setAiSuggestion(null);
            setAiSuggestionType(null);
            setOriginalText('');
        }
    };

    // AI 제안 거부
    const handleRejectSuggestion = () => {
        setAiSuggestion(null);
        setAiSuggestionType(null);
        setOriginalText('');
    };

    // AI 재생성
    const handleRegenerateSuggestion = () => {
        if (aiSuggestionType === 'spelling') {
            handleSpellingCheck();
        } else if (aiSuggestionType === 'custom') {
            handleCustomPrompt();
        } else if (aiSuggestionType === 'improve') {
            handleImproveContext();
        }
    };

    // 파일 선택 핸들러
    const handleFileSelect = (e) => {
        const newFiles = Array.from(e.target.files);
        if (newFiles.length === 0) return;

        // 선택된 파일 목록에 추가
        setSelectedFiles(prev => [...prev, ...newFiles]);
        setUploadingFiles(prev => [...prev, ...newFiles.map(f => f.name)]);
        e.target.value = ''; // 파일 선택 초기화
    };

    // 파일 다운로드 핸들러
    const handleFileDownload = async (file) => {
        try {
            const blob = await downloadActivityFile(file.fileId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.originalFileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('파일 다운로드 실패:', error);
            alert('파일 다운로드 중 오류가 발생했습니다.');
        }
    };

    // 파일 삭제 핸들러
    const handleFileDelete = async (fileId) => {
        if (!window.confirm('파일을 삭제하시겠습니까?')) {
            return;
        }

        try {
            await deleteActivityFile(fileId);
            await loadFiles(currentActivityId);
        } catch (error) {
            console.error('파일 삭제 실패:', error);
            alert('파일 삭제 중 오류가 발생했습니다.');
        }
    };

    // 파일 크기 포맷팅
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 읽기 전용 모드에서는 저장 불가
        if (isReadOnly) {
            alert('담당자만 활동내역을 입력할 수 있습니다.');
            return;
        }

        // 저장하려는 달의 이전 달 데이터 존재 여부 확인 (과제 첫달은 예외)
        const taskStart = task?.startDate ? new Date(task.startDate) : null;
        const taskFirstYear = taskStart ? taskStart.getFullYear() : null;
        const taskFirstMonth = taskStart ? taskStart.getMonth() + 1 : null;
        const isTaskFirstMonth = taskFirstYear != null && taskFirstMonth != null &&
            inputYear === taskFirstYear && inputMonth === taskFirstMonth;

        if (!isTaskFirstMonth) {
            const prevMonth = inputMonth === 1 ? 12 : inputMonth - 1;
            const prevYear = inputMonth === 1 ? inputYear - 1 : inputYear;
            try {
                const prevData = await getTaskActivity(task.id, prevYear, prevMonth);
                if (!prevData || !prevData.activityId) {
                    alert(`${prevYear}년 ${prevMonth}월 활동내역을 먼저 입력해 주세요.`);
                    return;
                }
            } catch (err) {
                console.error('이전 달 활동내역 조회 실패:', err);
                alert('이전 달 데이터 확인 중 오류가 발생했습니다.');
                return;
            }
        }

        // 평가기준 확인
        const evaluationType = task?.performance?.evaluation || task?.performanceOriginal?.evaluation || task?.evaluationType || '';
        const isQuantitative = evaluationType === 'quantitative' || evaluationType === '정량';

        try {
            setSubmitting(true);

            // FormData 생성 (파일 포함)
            const formDataToSend = new FormData();
            formDataToSend.append('activityContent', formData.activityContent);
            if (isQuantitative) {
                const val = (taskMetric === 'count' || taskMetric === 'amount' || taskMetric === 'monthly_avg_count'
                    || taskMetric === 'monthly_avg_head' || taskMetric === 'monthly_avg_minutes' || taskMetric === 'monthly_avg_amount'
                    || taskMetric === 'headcount' || taskMetric === 'minutes')
                    ? (formData.actualValue !== '' && formData.actualValue != null ? formData.actualValue : '0')
                    : formData.actualValue;
                if (val !== '' && val != null) formDataToSend.append('actualValue', val);
            }
            if (formData.status) {
                formDataToSend.append('status', formData.status);
            }
            formDataToSend.append('year', inputYear.toString());
            formDataToSend.append('month', inputMonth.toString());

            // 선택된 파일 추가
            selectedFiles.forEach((file) => {
                formDataToSend.append('files', file);
            });

            // 활동내역 저장 (파일 포함)
            const response = await axios.post(
                `http://localhost:8080/api/tasks/${task.id}/activity?userId=${user.skid}`,
                formDataToSend,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            // 저장 후 activityId가 있으면 파일 목록 다시 로드
            if (response.data && response.data.activityId) {
                setCurrentActivityId(response.data.activityId);
                currentActivityIdRef.current = response.data.activityId; // ref 업데이트
                // 저장 후 시간 정보 업데이트 (updatedAt 우선, 없으면 createdAt)
                setActivityUpdatedAt(response.data.updatedAt || response.data.createdAt || new Date().toISOString());
                await loadFiles(response.data.activityId);
            }

            // 저장 직후 반영: 과제 최신 정보 + 월별 실적 (누적/달성률 표시 갱신)
            if (evaluationType === 'quantitative' || evaluationType === '정량') {
                await loadAllPeriodMonthlyActualValues();
            }
            try {
                const updatedTask = await getTask(task.id);
                setTaskData(updatedTask);
            } catch (err) {
                console.error('저장 후 과제 정보 갱신 실패:', err);
            }

            // 선택된 파일 목록 초기화
            setSelectedFiles([]);
            setUploadingFiles([]);

            alert('활동내역이 성공적으로 저장되었습니다.');
        } catch (error) {
            console.error('저장 실패:', error);
            const errorMessage = error.response?.data?.message || error.message || '저장 중 오류가 발생했습니다.';
            alert(`저장 실패: ${errorMessage}`);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !task) return null;

    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

    // 영어 metric 값으로 변환 (한글이든 영어든 영어로 정규화)
    const normalizeMetric = (metric) => {
        const metricMap = {
            '건수': 'count',
            '명(인원)': 'headcount',
            '분(시간)': 'minutes',
            '분(min)': 'minutes',
            '금액': 'amount',
            '%': 'percent',
            'count': 'count',
            'headcount': 'headcount',
            'minutes': 'minutes',
            'amount': 'amount',
            'percent': 'percent',
            'monthly_avg_count': 'monthly_avg_count',
            '월 평균 건수': 'monthly_avg_count',
            '월 평균 명(인원)': 'monthly_avg_head',
            '월 평균 분(시간)': 'monthly_avg_minutes',
            '월 평균 분(min)': 'monthly_avg_minutes',
            'monthly_avg_head': 'monthly_avg_head',
            'monthly_avg_minutes': 'monthly_avg_minutes',
            'monthly_avg_amount': 'monthly_avg_amount',
            '월 평균 금액': 'monthly_avg_amount'
        };
        return metricMap[metric] || 'percent';
    };

    // 성과지표에 따른 단위 설정 (정규화된 영어 값 받음)
    const getMetricUnit = (normalizedMetric) => {
        const unitMap = {
            'count': '건',
            'headcount': '명',
            'minutes': '분',
            'amount': '원',
            'percent': '%',
            'monthly_avg_count': '건',
            'monthly_avg_head': '명',
            'monthly_avg_minutes': '분',
            'monthly_avg_amount': '원'
        };
        return unitMap[normalizedMetric] || '%';
    };

    const getMetricLabel = (normalizedMetric) => {
        const labelMap = {
            'count': '건수',
            'headcount': '명(인원)',
            'minutes': '분(min)',
            'amount': '금액',
            'percent': '%',
            'monthly_avg_count': '월 평균 건수',
            'monthly_avg_head': '월 평균 명(인원)',
            'monthly_avg_minutes': '월 평균 분(min)',
            'monthly_avg_amount': '월 평균 금액'
        };
        return labelMap[normalizedMetric] || '%';
    };

    // task의 metric 확인 (performanceOriginal > performance > 최상위 metric 순, Dashboard는 최상위 metric만 전달)
    const rawMetric = task.performanceOriginal?.metric || task.performance?.metric || task.metric || 'percent';
    const taskMetric = normalizeMetric(rawMetric);
    const metricUnit = getMetricUnit(taskMetric);
    const metricLabel = getMetricLabel(taskMetric);

    // 디버깅 로그
    console.log('TaskInputModal - task:', task);
    console.log('TaskInputModal - task.targetValue:', task?.targetValue);
    console.log('TaskInputModal - task.actualValue:', task?.actualValue);
    console.log('TaskInputModal - rawMetric:', rawMetric);
    console.log('TaskInputModal - taskMetric (normalized):', taskMetric);
    console.log('TaskInputModal - metricUnit:', metricUnit);
    console.log('TaskInputModal - metricLabel:', metricLabel);

    // 저장 직후 반영용 (taskData가 있으면 우선 사용)
    const effectiveTask = taskData ?? task;
    // 목표값과 실적값 (백엔드 기준 집계값)
    const targetValue = effectiveTask?.targetValue != null && effectiveTask.targetValue !== 0 ? parseFloat(effectiveTask.targetValue) : 0;
    const aggregatedTaskActualValue = effectiveTask?.actualValue != null ? Number(effectiveTask.actualValue) : 0; // 건수/금액: 누적 합계, %: 평균 실적(%)
    const currentMonthActualValue = formData.actualValue ? parseFloat(formData.actualValue) : 0;

    // 평가 기준에 따라 실적값과 달성률 계산 (실시간 반영)
    let actualValue = 0;
    let calculatedAchievement = 0;
    const isReverse = task?.reverseYn === 'Y';

    if (taskMetric === 'percent') {
        actualValue = currentMonthActualValue || 0;
        calculatedAchievement = calcAchievementRate(targetValue, actualValue, isReverse, false);
    } else if (taskMetric === 'monthly_avg_amount') {
        // 평균 목표(금액): 월별 달성률의 평균(역계산 가능)
        const currentInputYear = isReadOnly ? viewingYear : inputYear;
        const currentInputMonth = isReadOnly ? viewingMonth : inputMonth;
        const baseVals = monthlyActualValues.map(m => ({
            year: m.year != null ? m.year : currentInputYear,
            month: m.month,
            val: Number(m.actualValue || 0)
        }));
        const currIdx = baseVals.findIndex(b => b.year === currentInputYear && b.month === currentInputMonth);
        if (currIdx >= 0) {
            baseVals[currIdx].val = currentMonthActualValue;
        } else {
            baseVals.push({ year: currentInputYear, month: currentInputMonth, val: currentMonthActualValue });
        }
        const allVals = baseVals.map(b => b.val);
        actualValue = allVals.length ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 0;

        calculatedAchievement = allVals.length && targetValue
            ? allVals.map(v => calcAchievementRate(targetValue, v, isReverse, false))
                .reduce((a, b) => a + b, 0) / allVals.length
            : 0;
    } else if (taskMetric === 'monthly_avg_count'
        || taskMetric === 'monthly_avg_head'
        || taskMetric === 'monthly_avg_minutes') {
        // 평균 목표: 월별 달성률 = 실적/월목표*100, 과제 달성률 = 각 월 달성률의 합/월 수
        const currentInputYear = isReadOnly ? viewingYear : inputYear;
        const currentInputMonth = isReadOnly ? viewingMonth : inputMonth;
        const baseVals = monthlyActualValues.map(m => ({
            year: m.year != null ? m.year : currentInputYear,
            month: m.month,
            val: Number(m.actualValue || 0)
        }));
        const currIdx = baseVals.findIndex(b => b.year === currentInputYear && b.month === currentInputMonth);
        if (currIdx >= 0) {
            baseVals[currIdx].val = currentMonthActualValue;
        } else {
            baseVals.push({ year: currentInputYear, month: currentInputMonth, val: currentMonthActualValue });
        }
        const allVals = baseVals.map(b => b.val);
        actualValue = allVals.length ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 0;
        const monthlyTarget = targetValue || 1;
        calculatedAchievement = allVals.length
            ? allVals.map(v => (v / monthlyTarget) * 100).reduce((a, b) => a + b, 0) / allVals.length
            : 0;
    } else {
        const currentInputYear = isReadOnly ? viewingYear : inputYear;
        const currentInputMonth = isReadOnly ? viewingMonth : inputMonth;
        const otherMonthsSum = monthlyActualValues
            .filter(item => (item.year != null ? item.year : currentInputYear) !== currentInputYear || item.month !== currentInputMonth)
            .reduce((sum, item) => sum + (item.actualValue || 0), 0);
        actualValue = currentMonthActualValue + otherMonthsSum;
        calculatedAchievement = calcAchievementRate(targetValue, actualValue, isReverse, false);
    }

    const achievement = effectiveTask?.achievement != null ? parseFloat(effectiveTask.achievement) : 0;

    // 달성률에 따라 색상 계산 (0-100%에 따라 파란색에서 초록색으로 점진적 변화)
    const getProgressColor = (achievement) => {
        const percentage = Math.min(Math.max(achievement, 0), 100);

        // 0-70%: 파란색 계열
        // 70-90%: 노란색 계열
        // 90-100%: 초록색 계열
        if (percentage < 70) {
            // 파란색에서 노란색으로 (0-70%)
            const ratio = percentage / 70;
            const r = Math.round(0 + (255 - 0) * ratio); // 0 -> 255
            const g = Math.round(122 + (193 - 122) * ratio); // 122 -> 193
            const b = Math.round(255 + (7 - 255) * ratio); // 255 -> 7
            return `rgb(${r}, ${g}, ${b})`;
        } else if (percentage < 90) {
            // 노란색에서 주황색으로 (70-90%)
            const ratio = (percentage - 70) / 20;
            const r = Math.round(255 + (255 - 255) * ratio); // 255 유지
            const g = Math.round(193 + (140 - 193) * ratio); // 193 -> 140
            const b = Math.round(7 + (0 - 7) * ratio); // 7 -> 0
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // 주황색에서 초록색으로 (90-100%)
            const ratio = (percentage - 90) / 10;
            const r = Math.round(255 + (34 - 255) * ratio); // 255 -> 34
            const g = Math.round(140 + (197 - 140) * ratio); // 140 -> 197
            const b = Math.round(0 + (94 - 0) * ratio); // 0 -> 94
            return `rgb(${r}, ${g}, ${b})`;
        }
    };

    const progressColor = getProgressColor(calculatedAchievement);

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
            deptMap[deptName].push(manager);
        });

        // 배열로 변환: [{ deptName: 'IT팀', managers: [manager1, manager2] }, ...]
        return Object.entries(deptMap).map(([deptName, managerList]) => ({
            deptName,
            managers: managerList
        }));
    };

    // 담당자 정보를 텍스트 형식으로 변환
    const formatManagers = (managers) => {
        if (!managers || managers.length === 0) return '-';

        const deptGroups = getManagersByDept(managers);
        return deptGroups.map(deptGroup => {
            const managerNames = deptGroup.managers.map(m => m.mbName || '-').join(', ');
            return `${deptGroup.deptName} - ${managerNames}`;
        }).join('\n');
    };

    const getTaskTypeBadges = (taskTypeValue) => {
        if (!taskTypeValue) return [];
        return String(taskTypeValue)
            .split(',')
            .map(v => v.trim())
            .filter(v => v !== '');
    };

    const getTaskTypeBadgeClass = (type) => {
        if (type === 'OI') return 'oi';
        if (type === 'KPI') return 'kpi';
        if (type === '협업') return 'collab';
        return 'key';
    };

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

    // 상태 뱃지 생성
    const getStatusBadge = (status) => {
        const statusConfig = {
            inProgress: { text: '진행중', className: 'task-input-status-badge in-progress', icon: Clock },
            completed: { text: '완료', className: 'task-input-status-badge completed', icon: CheckCircle },
            delayed: { text: '지연', className: 'task-input-status-badge delayed', icon: AlertCircle },
            stopped: { text: '중단', className: 'task-input-status-badge stopped', icon: XCircle },
        };

        const normalizedStatus = normalizeStatus(status);
        const config = statusConfig[normalizedStatus] || statusConfig.inProgress;
        const Icon = config.icon;

        return (
            <span className={config.className}>
                <Icon size={14} />
                {config.text}
            </span>
        );
    };

    // 연.월 레이블 (예: 26.01)
    const formatYearMonthLabel = (year, month) =>
        `${String(year).slice(-2)}.${String(month).padStart(2, '0')}`;

    // 월별 실적 그래프 - 설정된 전체 기간 표시, 레이블은 26.01 형식
    const chartYear = isReadOnly ? viewingYear : inputYear;
    const MonthlyLineChart = ({ data, color, targetValue: chartTargetValue, metricUnit: chartMetricUnit, isPercent, currentInputMonth, currentInputValue, year: chartYearProp }) => {
        const dataWithCurrent = [...(data || [])];
        if (currentInputValue != null && currentInputValue !== '' && !isReadOnly) {
            const currentValue = parseFloat(currentInputValue) || 0;
            const y = chartYearProp != null ? chartYearProp : chartYear;
            const existingIndex = dataWithCurrent.findIndex(d => d.month === currentInputMonth && d.year === y);
            if (existingIndex >= 0) {
                dataWithCurrent[existingIndex] = { ...dataWithCurrent[existingIndex], actualValue: currentValue };
            } else if (currentValue > 0) {
                dataWithCurrent.push({ month: currentInputMonth, year: y, actualValue: currentValue });
            }
        }

        // 과제 시작 월로부터 12개 고정
        const periodMonths = [];
        let y = taskStartYear;
        let m = taskStartMonth;
        for (let i = 0; i < 12; i++) {
            periodMonths.push({ year: y, month: m });
            m++;
            if (m > 12) {
                m = 1;
                y++;
            }
        }

        const processedData = periodMonths.map(({ year: yr, month: mo }) => {
            const monthData = dataWithCurrent.find(d => d.month === mo && d.year === yr);
            const hasSavedData = !!(data || []).find(d => d.month === mo && d.year === yr);
            if (monthData && monthData.actualValue != null) {
                return { ...monthData, actualValue: monthData.actualValue, hasSavedData };
            }
            return { month: mo, year: yr, actualValue: 0, hasSavedData: false };
        });

        return renderChart(processedData, color, chartTargetValue, chartMetricUnit, isPercent, currentInputMonth, currentInputValue, chartYearProp ?? chartYear, formatYearMonthLabel);
    };

    // 차트 렌더링 함수 (과제 시작월부터 12개 고정, 가로 스크롤 없음)
    const renderChart = (processedData, color, chartTargetValue, chartMetricUnit, isPercent, currentInputMonth, currentInputValue, chartYearForRender, formatLabel) => {
        const displayYear = chartYearForRender != null ? chartYearForRender : chartYear;
        const labelFn = formatLabel || ((yr, mo) => `${mo}월`);
        const width = 520; // viewBox 기준 너비 (CSS에서 반응형으로 스케일)
        const height = 90; // 날짜 레이블 하단 여유 확보
        const padding = { top: 18, right: 18, bottom: 22, left: 18 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // 목표값과 실적값 중 최대값으로 정규화
        const maxActualValue = Math.max(...processedData.map(d => d.actualValue || 0), 0);
        const maxValue = Math.max(maxActualValue, 1);

        const normalizedData = processedData.map(d => ({
            ...d,
            normalized: (d.actualValue || 0) / maxValue
        }));

        // 점 좌표 계산 (모든 달 표시)
        const points = normalizedData.map((d, index) => {
            const x = padding.left + (index / (normalizedData.length - 1 || 1)) * chartWidth;
            const y = padding.top + chartHeight - (d.normalized * chartHeight);
            const year = d.year || displayYear;
            const isFuture = year > currentYear || (year === currentYear && d.month > currentMonth);
            const hasSavedData = d.hasSavedData !== false;
            return { x, y, value: d.actualValue, month: d.month, year: d.year || displayYear, isFuture, hasSavedData, index };
        });

        // 경로 생성 - 저장된 월만 선 연결 (저장되지 않은 월은 선 끊김)
        const pathParts = [];
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const prevPoint = i > 0 ? points[i - 1] : null;
            if (!point.hasSavedData) continue;
            const canConnect = prevPoint?.hasSavedData && !prevPoint.isFuture && !point.isFuture;
            pathParts.push(canConnect ? `L ${point.x} ${point.y}` : `M ${point.x} ${point.y}`);
        }
        const pathData = pathParts.join(' ');

        return (
            <div className="monthly-chart-wrapper">
                <div className="monthly-chart-label">월별 실적 그래프</div>
                <div
                    className="monthly-chart-svg-container"
                    onMouseLeave={() => setHoveredPoint(null)}
                >
                    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
                        preserveAspectRatio="xMinYMid meet">
                        <defs>
                            <linearGradient id={`lineGradient-${task?.id || 'default'}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                                <stop offset="100%" stopColor={color} stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        {/* 영역 채우기 - 저장된 월만, 현재 달까지만 */}
                        {(() => {
                            const savedPoints = points.filter(p => p.hasSavedData && !p.isFuture);
                            if (savedPoints.length === 0) return null;
                            const segments = [];
                            let seg = [];
                            for (const p of savedPoints) {
                                const prev = seg[seg.length - 1];
                                const prevIdx = prev ? points.findIndex(x => x === prev) : -1;
                                const currIdx = points.indexOf(p);
                                if (seg.length === 0 || currIdx === prevIdx + 1) {
                                    seg.push(p);
                                } else {
                                    if (seg.length > 0) segments.push(seg);
                                    seg = [p];
                                }
                            }
                            if (seg.length > 0) segments.push(seg);
                            return segments.map((pts, si) => {
                                const first = pts[0], last = pts[pts.length - 1];
                                const segPath = pts.map((pt, i) => (i === 0 ? 'M' : 'L') + ` ${pt.x} ${pt.y}`).join(' ');
                                return (
                                    <path
                                        key={si}
                                        d={`${segPath} L ${last.x} ${height - padding.bottom} L ${first.x} ${height - padding.bottom} Z`}
                                        fill={`url(#lineGradient-${task?.id || 'default'})`}
                                    />
                                );
                            });
                        })()}

                        {/* 꺾은선 */}
                        <path
                            d={pathData}
                            fill="none"
                            stroke={color}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* 과제 기간 월 범례 + 점/호버 (저장된 월만) */}
                        {points.map((point, idx) => {
                            const index = point.index;
                            const monthName = labelFn(point.year, point.month);
                            const isHovered = hoveredPoint?.index === index;

                            return (
                                <g key={index}>
                                    {/* 호버 영역·점 - 저장된 월만 */}
                                    {point.hasSavedData && (
                                        <>
                                            <circle
                                                cx={point.x}
                                                cy={point.y}
                                                r="8"
                                                fill="transparent"
                                                onMouseEnter={() => setHoveredPoint({ index, ...point, monthName })}
                                                style={{ cursor: 'pointer' }}
                                            />
                                            <circle
                                                cx={point.x}
                                                cy={point.y}
                                                r={isHovered ? "4" : "3"}
                                                fill={color}
                                                stroke="white"
                                                strokeWidth={isHovered ? "2" : "1"}
                                                style={{ transition: 'r 0.2s ease' }}
                                            />
                                        </>
                                    )}

                                    {/* 월 레이블 - 26.01 형식 (bottom 가깝게, 폰트 키움) */}
                                    <text
                                        x={point.x}
                                        y={height - 4}
                                        fontSize="11"
                                        fill="#6b7280"
                                        textAnchor="middle"
                                        fontWeight="600"
                                    >
                                        {labelFn(point.year, point.month)}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>

                    {/* 툴팁 - 금액은 한글 단위, 그 외 toLocaleString (z-index로 위쪽 잘림 방지) */}
                    {hoveredPoint && (
                        <div
                            className="monthly-chart-tooltip monthly-chart-tooltip-value-only"
                            style={{
                                left: hoveredPoint.x,
                                top: hoveredPoint.y - 6,
                                transform: 'translate(-50%, -100%)',
                                zIndex: 10001
                            }}
                        >
                            {chartMetricUnit === '원' ? formatKoreanUnit(hoveredPoint.value) : hoveredPoint.value.toLocaleString() + chartMetricUnit}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // 평가기준 확인
    const evaluationType = task?.performance?.evaluation || task?.performanceOriginal?.evaluation || task?.evaluationType || '';
    const isQuantitative = evaluationType === 'quantitative' || evaluationType === '정량';
    const taskTypeBadges = getTaskTypeBadges(task?.taskType);
    const categoryPathParts = [task?.category1, task?.category2, task?.category3]
        .filter(v => v && String(v).trim() && String(v).trim() !== '-')
        .map(v => String(v).trim());
    const taskTitle = task.name || task.taskName || '-';

    return (
        <div className="task-input-modal-overlay">
            <div className="task-input-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    {/* 닫기 버튼 */}
                    <button className="close-btn" onClick={onClose} aria-label="닫기">
                        <X size={18} />
                    </button>

                    {/* 1행: 과제 구분 뱃지 + 과제명 */}
                    <div className="modal-header-title-row">
                        {taskTypeBadges.length > 0 && (
                            <div className="task-type-badges">
                                {taskTypeBadges.map((type) => (
                                    <span key={type} className={`task-type-badge ${getTaskTypeBadgeClass(type)}`}>
                                        {type}
                                    </span>
                                ))}
                            </div>
                        )}
                        <h2 className="task-name-header">
                            <span className="task-title-path">
                                {categoryPathParts.map((part, idx) => (
                                    <React.Fragment key={`${part}-${idx}`}>
                                        <span className="task-title-part">{part}</span>
                                        <span className="task-title-sep">&gt;</span>
                                    </React.Fragment>
                                ))}
                                <strong className="task-title-main">{taskTitle}</strong>
                            </span>
                        </h2>
                    </div>

                    {/* 2행: 기간 + 부서/담당자 */}
                    <div className="modal-header-meta-row">
                        <div className="task-meta-left">
                            {task.description && task.description.trim() && (
                                <div className="task-description-tooltip-wrap">
                                    <button
                                        type="button"
                                        className="task-description-tooltip-btn"
                                        aria-label="과제 개요 토글"
                                        aria-expanded={isDescriptionTooltipOpen}
                                        aria-controls="task-description-tooltip"
                                        title={task.description}
                                        onClick={() => setIsDescriptionTooltipOpen(prev => !prev)}
                                    >
                                        {isDescriptionTooltipOpen ? '과제 개요 접기' : '과제 개요 보기'}
                                        {isDescriptionTooltipOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>

                                    {isDescriptionTooltipOpen && (
                                        <div
                                            id="task-description-tooltip"
                                            className="task-description-tooltip"
                                            role="tooltip"
                                        >
                                            <div className="task-description-tooltip-header">
                                                <span className="task-description-tooltip-header-title">과제 개요</span>
                                                <button
                                                    type="button"
                                                    className="task-description-tooltip-close-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsDescriptionTooltipOpen(false);
                                                    }}
                                                >
                                                    접기
                                                </button>
                                            </div>
                                            <div className="task-description-tooltip-content">
                                                {task.description}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {task.startDate && task.endDate && (
                                <div className="task-period-info">
                                    <Calendar size={13} />
                                    <span className="task-period-text">
                                        {formatDate(task.startDate)} ~ {formatDate(task.endDate)}
                                    </span>
                                </div>
                            )}
                        </div>

                        {task.managers && task.managers.length > 0 && (
                            <>
                                <span className="meta-divider" />
                                <div className="task-dept-manager-list">
                                    {getManagersByDept(task.managers).map((deptGroup, idx) => (
                                        <div key={idx} className="dept-manager-card">
                                            <span className="dept-manager-dept-label">{deptGroup.deptName}</span>
                                            <div className="dept-manager-chips">
                                                {deptGroup.managers.map((m, mIdx) => (
                                                    <span key={m.userId || mIdx} className="manager-chip">
                                                        {m.mbName || '-'}
                                                        {mIdx < deptGroup.managers.length - 1 && <span className="manager-chip-sep">·</span>}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="input-form">
                    {/* 이달 활동내역 입력 */}
                    <section className="form-section activity-main-section">
                        <div className="activity-main-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FileText size={18} />
                                {isReadOnly ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <h3>활동내역 (읽기 전용)</h3>
                                        <div className="month-navigation-inline">
                                            <button
                                                type="button"
                                                className="month-nav-btn-inline"
                                                onClick={() => handleViewingMonthChange('prev')}
                                                disabled={!canMoveToPrevViewingMonth()}
                                                title={canMoveToPrevViewingMonth() ? '이전 월' : '과제 시작일 이전입니다'}
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                            <span className="month-display-inline">
                                                {viewingYear}년 {viewingMonth}월
                                            </span>
                                            <button
                                                type="button"
                                                className="month-nav-btn-inline"
                                                onClick={() => handleViewingMonthChange('next')}
                                                disabled={!canMoveToNextViewingMonth()}
                                                title={canMoveToNextViewingMonth() ? '다음 월' : '과제 종료일 이후입니다'}
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                        <span className="read-only-badge">읽기 전용</span>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <h3>활동내역 입력</h3>
                                        <div className="month-navigation-inline">
                                            <button
                                                type="button"
                                                className="month-nav-btn-inline"
                                                onClick={() => handleInputMonthChange('prev')}
                                                disabled={!canMoveToPrevInputMonth()}
                                                title={canMoveToPrevInputMonth() ? '이전 월' : '과제 시작일 이전입니다'}
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                            <span className="month-display-inline">
                                                {inputYear}년 {inputMonth}월
                                            </span>
                                            <button
                                                type="button"
                                                className="month-nav-btn-inline"
                                                onClick={() => handleInputMonthChange('next')}
                                                disabled={!canMoveToNextMonth()}
                                                title={canMoveToNextMonth() ? "다음 월" : "미래 달은 입력할 수 없습니다"}
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {/* 활동내역 입력 시간 표시 */}
                            {activityUpdatedAt && (
                                <div style={{
                                    fontSize: '12px',
                                    color: '#6b7280',
                                    marginTop: '4px',
                                    marginLeft: '26px'
                                }}>
                                    입력 시간: {formatDateTime(activityUpdatedAt)}
                                </div>
                            )}
                        </div>
                        <div className="activity-main-container">
                            <div className="form-group activity-main-group">
                                <textarea
                                    name="activityContent"
                                    value={formData.activityContent}
                                    onChange={handleChange}
                                    placeholder={isReadOnly ? "활동내역이 없습니다" : `${inputMonth}월 진행한 활동내역을 입력하세요`}
                                    rows="10"
                                    disabled={isReadOnly}
                                    readOnly={isReadOnly}
                                    className="activity-main-textarea"
                                />
                            </div>

                            {/* AI 기능 버튼 - 읽기 전용일 때 숨김 */}
                            {!isReadOnly && (
                                <div className="ai-actions">
                                    <div className="ai-quick-actions">
                                        <button
                                            type="button"
                                            className="ai-btn"
                                            onClick={handleSpellingCheck}
                                            disabled={aiProcessing || !formData.activityContent.trim()}
                                        >
                                            <CheckCircle size={16} />
                                            <span>AI 맞춤법·띄어쓰기 교정</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="ai-btn"
                                            onClick={handleImproveContext}
                                            disabled={aiProcessing || !formData.activityContent.trim()}
                                        >
                                            <Wand2 size={16} />
                                            <span>AI 문맥·표현 개선</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="ai-btn ai-custom-toggle-btn"
                                            onClick={() => setShowCustomPrompt(!showCustomPrompt)}
                                            disabled={aiProcessing}
                                        >
                                            <Sparkles size={16} />
                                            <span>프롬프트 직접 입력</span>
                                            {showCustomPrompt ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                    </div>
                                    {showCustomPrompt && (
                                        <div className="ai-custom-prompt-section">
                                            <input
                                                type="text"
                                                className="ai-custom-prompt-input"
                                                placeholder="프롬프트를 입력하세요 (예: 더 간결하게 작성해줘, 전문적인 표현으로 바꿔줘)"
                                                value={customPrompt}
                                                onChange={(e) => setCustomPrompt(e.target.value)}
                                                disabled={aiProcessing}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleCustomPrompt();
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="ai-btn ai-custom-btn"
                                                onClick={handleCustomPrompt}
                                                disabled={aiProcessing || !customPrompt.trim() || !formData.activityContent.trim()}
                                            >
                                                <Sparkles size={16} />
                                                <span>AI 실행</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {aiProcessing && (
                                <div className="ai-processing">
                                    <Sparkles size={16} className="ai-icon-spin" />
                                    <span>AI가 처리 중입니다...</span>
                                </div>
                            )}

                            {/* AI 제안 표시 */}
                            {aiSuggestion && !aiProcessing && (
                                <div className="ai-suggestion-panel">
                                    <div className="ai-suggestion-header">
                                        <Sparkles size={16} />
                                        <span>
                                            {aiSuggestionType === 'spelling' && 'AI 맞춤법 검사 결과'}
                                            {aiSuggestionType === 'custom' && 'AI 커스텀 결과'}
                                            {aiSuggestionType === 'improve' && 'AI 문맥 교정 결과'}
                                        </span>
                                    </div>
                                    <div className="ai-suggestion-content">
                                        {/* Diff 표시 - 맞춤법/문맥 교정일 때만 */}
                                        {(aiSuggestionType === 'spelling' || aiSuggestionType === 'improve') && originalText ? (
                                            <div className="ai-diff-container">
                                                <div className="ai-diff-original">
                                                    <div className="ai-diff-label">원본</div>
                                                    <div className="ai-diff-text removed">
                                                        {(() => {
                                                            const diff = getWordLevelDiff(originalText, aiSuggestion);
                                                            return diff.map((item, idx) => {
                                                                if (item.type === 'removed') {
                                                                    return (
                                                                        <span key={idx} className="diff-word removed">
                                                                            {item.text}
                                                                        </span>
                                                                    );
                                                                } else if (item.type === 'unchanged') {
                                                                    return (
                                                                        <span key={idx} className="diff-word unchanged">
                                                                            {item.text}
                                                                        </span>
                                                                    );
                                                                } else if (item.type === 'added') {
                                                                    // 원본에서는 추가된 단어는 표시하지 않음
                                                                    return null;
                                                                }
                                                                return null;
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                                <div className="ai-diff-modified">
                                                    <div className="ai-diff-label">수정본</div>
                                                    <div className="ai-diff-text added">
                                                        {(() => {
                                                            const diff = getWordLevelDiff(originalText, aiSuggestion);
                                                            return diff.map((item, idx) => {
                                                                if (item.type === 'added') {
                                                                    return (
                                                                        <span key={idx} className="diff-word added">
                                                                            {item.text}
                                                                        </span>
                                                                    );
                                                                } else if (item.type === 'unchanged') {
                                                                    return (
                                                                        <span key={idx} className="diff-word unchanged">
                                                                            {item.text}
                                                                        </span>
                                                                    );
                                                                } else if (item.type === 'removed') {
                                                                    // 수정본에서는 삭제된 단어는 표시하지 않음
                                                                    return null;
                                                                }
                                                                return null;
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="suggestion-text suggested">
                                                {aiSuggestion}
                                            </div>
                                        )}
                                    </div>
                                    <div className="ai-suggestion-actions">
                                        <button
                                            type="button"
                                            className="suggestion-btn accept"
                                            onClick={handleAcceptSuggestion}
                                        >
                                            <CheckCircle size={16} />
                                            <span>수락</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="suggestion-btn regenerate"
                                            onClick={handleRegenerateSuggestion}
                                        >
                                            <Sparkles size={16} />
                                            <span>재생성</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="suggestion-btn reject"
                                            onClick={handleRejectSuggestion}
                                        >
                                            <X size={16} />
                                            <span>거부</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 첨부파일 섹션 (접기/펼치기) */}
                    <section className="form-section file-section">
                        <button
                            type="button"
                            className="file-section-header file-section-header-toggle"
                            onClick={() => setFileSectionOpen(prev => !prev)}
                            aria-expanded={fileSectionOpen}
                        >
                            <Paperclip size={14} />
                            <h3>첨부파일</h3>
                            {fileSectionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {fileSectionOpen && (
                            <div className="file-section-content">
                                {!isReadOnly && (
                                    <div className="file-upload-area">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileSelect}
                                            multiple
                                            style={{ display: 'none' }}
                                            disabled={submitting}
                                        />
                                        <button
                                            type="button"
                                            className="file-upload-btn"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={submitting}
                                        >
                                            <Upload size={14} />
                                            <span>파일 선택</span>
                                        </button>
                                        {selectedFiles.length > 0 && (
                                            <span className="file-upload-hint">
                                                {selectedFiles.length}개 파일이 선택되었습니다. 저장 시 함께 업로드됩니다.
                                            </span>
                                        )}
                                    </div>
                                )}

                                {selectedFiles.length > 0 && (
                                    <div className="file-selected-list">
                                        {selectedFiles.map((file, idx) => (
                                            <div key={idx} className="file-item selected">
                                                <Paperclip size={14} />
                                                <span>{file.name}</span>
                                                <span className="file-size">{formatFileSize(file.size)}</span>
                                                <button
                                                    type="button"
                                                    className="file-action-btn delete"
                                                    onClick={() => {
                                                        setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
                                                        setUploadingFiles(prev => prev.filter((name) => name !== file.name));
                                                    }}
                                                    title="제거"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {files.length > 0 && (
                                    <div className="file-list">
                                        {files.map((file) => (
                                            <div key={file.fileId} className="file-item">
                                                <Paperclip size={14} />
                                                <span className="file-name" title={file.originalFileName}>
                                                    {file.originalFileName}
                                                </span>
                                                <span className="file-size">{formatFileSize(file.fileSize)}</span>
                                                {!isReadOnly && (
                                                    <div className="file-actions">
                                                        <button
                                                            type="button"
                                                            className="file-action-btn download"
                                                            onClick={() => handleFileDownload(file)}
                                                            title="다운로드"
                                                        >
                                                            <Download size={14} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="file-action-btn delete"
                                                            onClick={() => handleFileDelete(file.fileId)}
                                                            title="삭제"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                                {isReadOnly && (
                                                    <button
                                                        type="button"
                                                        className="file-action-btn download"
                                                        onClick={() => handleFileDownload(file)}
                                                        title="다운로드"
                                                    >
                                                        <Download size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 첨부파일이 전혀 없을 때는 아무 표시도 하지 않아 공간을 아낀다 */}
                            </div>
                        )}
                    </section>

                    {/* 목표 대비 실적 - 정량 평가일 때만 표시 */}
                    {isQuantitative && (
                        <section className="performance-section-compact">
                            <div className="performance-compact-header">
                                <TrendingUp size={14} />
                                <h3>목표 대비 실적</h3>
                            </div>

                            <div className="performance-compact-row">
                                {/* 실적값 입력 - 평가 기준에 따라 다르게 표시 */}
                                {taskMetric === 'percent' ? (
                                    // % 기준: 해당 월 실적 입력창
                                    <div className="performance-row-box performance-actual-compact">
                                        <span className="performance-actual-label-compact">{isReadOnly ? viewingMonth : inputMonth}월 실적</span>
                                        {isReadOnly ? (
                                            <span className="performance-actual-value-compact">{formatTableValue(actualValue, taskMetric)}</span>
                                        ) : (
                                            <div className="performance-actual-input-wrapper">
                                                <input
                                                    type="number"
                                                    name="actualValue"
                                                    value={formData.actualValue || ''}
                                                    onChange={handleChange}
                                                    placeholder="0"
                                                    step="0.01"
                                                    min="0"
                                                    disabled={isReadOnly}
                                                    readOnly={isReadOnly}
                                                    className="performance-actual-value-compact-input"
                                                />
                                                <span className="performance-actual-unit">{metricUnit}</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    // 건수, 금액 기준: #월 실적 입력창만
                                    <div className="performance-row-box performance-actual-compact">
                                        <span className="performance-actual-label-compact">{isReadOnly ? `${viewingMonth}월 실적` : `${inputMonth}월 실적`}</span>
                                        {isReadOnly ? (
                                            <span className="performance-actual-value-compact">{formatTableValue(currentMonthActualValue, taskMetric)}</span>
                                        ) : (
                                            <div className="performance-actual-input-wrapper">
                                                <input
                                                    type="number"
                                                    name="actualValue"
                                                    value={formData.actualValue !== '' && formData.actualValue != null ? formData.actualValue : '0'}
                                                    onChange={handleChange}
                                                    placeholder="0"
                                                    step="1"
                                                    min="0"
                                                    disabled={isReadOnly}
                                                    readOnly={isReadOnly}
                                                    className="performance-actual-value-compact-input"
                                                />
                                                <span className="performance-actual-unit">{metricUnit}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* 목표 / 합계·평균 / 현재 과제 달성률 한 줄 요약 */}
                                <div className="performance-target-achievement-box">
                                    <div className="performance-ta-summary">
                                        <div className="performance-ta-item">
                                            <span className="performance-ta-item-label">목표</span>
                                            <span className="performance-ta-item-value">
                                                {formatTableValue(targetValue, taskMetric)}
                                            </span>
                                        </div>
                                        <div className="performance-ta-item">
                                            <span className="performance-ta-item-label">
                                                {taskMetric === 'percent'
                                                    ? '평균 실적(%)'
                                                    : (taskMetric === 'monthly_avg_count'
                                                        ? '월 평균 건수'
                                                        : taskMetric === 'monthly_avg_head'
                                                            ? '월 평균 명(인원)'
                                                            : taskMetric === 'monthly_avg_minutes'
                                                                ? '월 평균 분(min)'
                                                                : taskMetric === 'monthly_avg_amount'
                                                                    ? '월 평균 금액'
                                                                : '누적 합계')}
                                            </span>
                                            <span className="performance-ta-item-value">
                                                {formatTableValue(aggregatedTaskActualValue, taskMetric)}
                                            </span>
                                        </div>
                                        <div className="performance-ta-item performance-ta-item-achievement">
                                            <span className="performance-ta-item-label">현재 과제 달성률</span>
                                            <span
                                                className="performance-ta-item-value performance-ta-achievement-value"
                                                style={{ color: progressColor }}
                                            >
                                                {achievement != null ? Number(achievement).toFixed(1) : '0'}%
                                            </span>
                                        </div>
                                    </div>
                                    {effectiveTask?.targetDescription && String(effectiveTask.targetDescription).trim() && (
                                        <div className="performance-ta-target-desc-row">
                                            <span className="performance-ta-target-desc-label">목표 기준</span>
                                            <span className="performance-ta-target-desc">{effectiveTask.targetDescription}</span>
                                        </div>
                                    )}
                                </div>

                                {/* 월별 실적 그래프 */}
                                {(monthlyActualValues.length > 0 || (formData.actualValue && parseFloat(formData.actualValue) > 0)) && (
                                    <div className="monthly-chart-compact">
                                        <MonthlyLineChart
                                            data={monthlyActualValues}
                                            color="#3b82f6"
                                            targetValue={targetValue}
                                            metricUnit={metricUnit}
                                            isPercent={taskMetric === 'percent'}
                                            currentInputMonth={isReadOnly ? viewingMonth : inputMonth}
                                            currentInputValue={formData.actualValue}
                                            year={chartYear}
                                        />
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* 버튼 - 저장하기 우측에 닫기 */}
                    <div className="form-actions">
                        {isReadOnly ? (
                            <button type="button" className="btn-submit" onClick={onClose}>
                                닫기
                            </button>
                        ) : (
                            <>
                                <button type="submit" className="btn-submit" disabled={submitting || loading}>
                                    {submitting ? '저장 중...' : '저장하기'}
                                </button>
                                <button type="button" className="btn-cancel" onClick={onClose}>
                                    닫기
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </div>

        </div>
    );
}

export default TaskInputModal;
