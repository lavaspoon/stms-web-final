import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, TrendingUp, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Sparkles, CheckCircle, Wand2, Clock, AlertCircle, XCircle, Upload, Download, Trash2, Paperclip } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { inputTaskActivity, getTaskActivity, getAllPreviousActivities, uploadActivityFile, getActivityFiles, downloadActivityFile, deleteActivityFile, getMonthlyActualValues } from '../api/taskApi';
import { checkSpelling, recommendActivity, improveContext } from '../api/aiApi';
import { formatDate } from '../utils/dateUtils';
import useUserStore from '../store/userStore';
import './TaskInputModal.css';

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

    // 읽기 전용 모드: forceReadOnly가 true이거나 담당자가 아닌 경우
    const isReadOnly = forceReadOnly || !isTaskManager();

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
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // 뷰어 모드용 현재 보고 있는 월 상태
    const [viewingMonth, setViewingMonth] = useState(currentMonth);
    
    // 입력 모드용 선택한 월 상태 (담당자가 입력할 월)
    const [inputMonth, setInputMonth] = useState(currentMonth);

    // 각 월별로 입력 중인 데이터를 임시 저장 (키: "year-month", 값: formData)
    const [monthlyInputCache, setMonthlyInputCache] = useState({});

    // 활동내역 입력 시간 상태
    const [activityUpdatedAt, setActivityUpdatedAt] = useState(null);

    // 파일 관련 상태
    const [files, setFiles] = useState([]);
    const [uploadingFiles, setUploadingFiles] = useState([]);
    const [currentActivityId, setCurrentActivityId] = useState(null);
    const fileInputRef = useRef(null);

    // 최신 formData와 currentActivityId를 추적하기 위한 ref
    const formDataRef = useRef(formData);
    const currentActivityIdRef = useRef(null);

    // 월별 실적값 그래프용 상태
    const [monthlyActualValues, setMonthlyActualValues] = useState([]);
    const [hoveredPoint, setHoveredPoint] = useState(null); // 마우스 오버된 점 정보

    // 월별 실적값 로드 함수
    const loadMonthlyActualValues = async () => {
        if (!task?.id) return;
        try {
            const data = await getMonthlyActualValues(task.id, currentYear);
            setMonthlyActualValues(data || []);
        } catch (error) {
            console.error('월별 실적값 조회 실패:', error);
            setMonthlyActualValues([]);
        }
    };

    // 기존 데이터 로드
    useEffect(() => {
        if (isOpen && task) {
            // 뷰어 모드일 때는 현재 월로 초기화
            if (isReadOnly) {
                setViewingMonth(currentMonth);
            } else {
                // 입력 모드: inputMonth를 현재 월로 초기화 (미래 달이면 현재 달로)
                const initialMonth = inputMonth > currentMonth ? currentMonth : inputMonth;
                setInputMonth(initialMonth);
            }
            loadExistingData();
            loadPreviousActivities();
            // 정량 평가일 때만 월별 실적값 로드
            const evaluationType = task?.performance?.evaluation || task?.performanceOriginal?.evaluation || task?.evaluationType || '';
            if (evaluationType === 'quantitative' || evaluationType === '정량') {
                loadMonthlyActualValues();
            }
        } else {
            // 모달 닫을 때 초기화
            setFormData({
                activityContent: '',
                status: task?.status || 'inProgress',
                actualValue: ''
            });
            setPreviousActivities([]);
            setViewingMonth(currentMonth);
            setInputMonth(currentMonth);
            setMonthlyActualValues([]);
            setMonthlyInputCache({}); // 캐시도 초기화
            setActivityUpdatedAt(null);
        }
    }, [isOpen, task]);

    const loadExistingData = async () => {
        try {
            setLoading(true);
            let data;
            // 뷰어 모드: 현재 보고 있는 월의 활동 내역 로드
            if (isReadOnly) {
                data = await getTaskActivity(task.id, currentYear, viewingMonth);
            } else {
                // 입력 모드: 선택한 월의 활동 내역 로드
                data = await getTaskActivity(task.id, currentYear, inputMonth);
            }

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
                const emptyFormData = {
                    activityContent: '',
                    status: task.status || 'inProgress',
                    actualValue: ''
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

    // 뷰어 모드에서 월이 변경될 때 해당 월의 활동내역 로드
    useEffect(() => {
        if (isReadOnly && isOpen && task) {
            const loadViewingMonthData = async () => {
                try {
                    setLoading(true);
                    const data = await getTaskActivity(task.id, currentYear, viewingMonth);
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
                        const emptyFormData = {
                            activityContent: '',
                            status: task.status || 'inProgress',
                            actualValue: ''
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
                    const emptyFormData = {
                        activityContent: '',
                        status: task.status || 'inProgress',
                        actualValue: ''
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
    }, [viewingMonth, isReadOnly, isOpen, task, currentYear]);

    // formData와 currentActivityId 변경 시 ref 동기화
    useEffect(() => {
        formDataRef.current = formData;
    }, [formData]);

    useEffect(() => {
        currentActivityIdRef.current = currentActivityId;
    }, [currentActivityId]);

    // 입력 모드에서 월이 변경될 때 해당 월의 활동내역 로드
    useEffect(() => {
        if (!isReadOnly && isOpen && task) {
            const loadInputMonthData = async () => {
                try {
                    setLoading(true);
                    
                    // 먼저 캐시에서 해당 월의 입력 데이터 확인
                    const cacheKey = `${currentYear}-${inputMonth}`;
                    const cachedData = monthlyInputCache[cacheKey];
                    
                    // 서버에서 데이터 로드
                    const data = await getTaskActivity(task.id, currentYear, inputMonth);
                    
                    // 캐시된 데이터가 있고, 서버 데이터와 activityId가 같거나 서버에 데이터가 없는 경우 캐시 사용
                    // (서버에 저장된 최신 데이터가 있으면 서버 데이터 우선)
                    if (cachedData && (!data || !data.activityId || data.activityId === cachedData.activityId)) {
                        // 캐시된 데이터 사용
                        const cachedFormData = {
                            activityContent: cachedData.activityContent || '',
                            status: cachedData.status || task.status || 'inProgress',
                            actualValue: cachedData.actualValue || ''
                        };
                        setFormData(cachedFormData);
                        formDataRef.current = cachedFormData; // ref 업데이트
                        setCurrentActivityId(cachedData.activityId || null);
                        currentActivityIdRef.current = cachedData.activityId || null; // ref 업데이트
                        // 캐시에는 시간 정보가 없으므로 null로 설정
                        setActivityUpdatedAt(null);
                        
                        // 파일 목록 로드 (activityId가 있으면)
                        if (cachedData.activityId) {
                            await loadFiles(cachedData.activityId);
                        } else {
                            setFiles([]);
                        }
                    } else if (data) {
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
                        // 데이터 없음
                        const emptyFormData = {
                            activityContent: '',
                            status: task.status || 'inProgress',
                            actualValue: ''
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
                    // 에러 발생 시 캐시 확인
                    const cacheKey = `${currentYear}-${inputMonth}`;
                    const cachedData = monthlyInputCache[cacheKey];
                    if (cachedData) {
                        const cachedFormData = {
                            activityContent: cachedData.activityContent || '',
                            status: cachedData.status || task.status || 'inProgress',
                            actualValue: cachedData.actualValue || ''
                        };
                        setFormData(cachedFormData);
                        formDataRef.current = cachedFormData; // ref 업데이트
                        setCurrentActivityId(cachedData.activityId || null);
                        currentActivityIdRef.current = cachedData.activityId || null; // ref 업데이트
                        setActivityUpdatedAt(null);
                        setFiles([]);
                    } else {
                        const emptyFormData = {
                            activityContent: '',
                            status: task.status || 'inProgress',
                            actualValue: ''
                        };
                        setFormData(emptyFormData);
                        formDataRef.current = emptyFormData; // ref 업데이트
                        setCurrentActivityId(null);
                        currentActivityIdRef.current = null; // ref 업데이트
                        setActivityUpdatedAt(null);
                        setFiles([]);
                    }
                } finally {
                    setLoading(false);
                }
            };
            loadInputMonthData();
        }
    }, [inputMonth, isReadOnly, isOpen, task, currentYear]);

    // 뷰어 모드에서 월 이동 함수
    const handleViewingMonthChange = (direction) => {
        if (direction === 'prev') {
            setViewingMonth(prev => {
                if (prev === 1) return 12;
                return prev - 1;
            });
        } else {
            setViewingMonth(prev => {
                if (prev === 12) return 1;
                return prev + 1;
            });
        }
    };

    // 입력 모드에서 월 이동 함수
    const handleInputMonthChange = (direction) => {
        // 현재 입력 중인 데이터를 캐시에 저장 (ref를 사용하여 최신 값 보장)
        const currentCacheKey = `${currentYear}-${inputMonth}`;
        setMonthlyInputCache(prev => ({
            ...prev,
            [currentCacheKey]: {
                ...formDataRef.current,
                activityId: currentActivityIdRef.current
            }
        }));

        // 월 변경
        if (direction === 'prev') {
            setInputMonth(prev => {
                if (prev === 1) return 12;
                return prev - 1;
            });
        } else {
            // 다음 달로 이동 시 현재 달보다 미래인지 확인
            setInputMonth(prev => {
                const nextMonth = prev === 12 ? 1 : prev + 1;
                const nextYear = prev === 12 ? currentYear + 1 : currentYear;
                
                // 미래 달로 이동하려고 하면 막음
                if (nextYear > currentYear || (nextYear === currentYear && nextMonth > currentMonth)) {
                    return prev; // 변경하지 않음
                }
                return nextMonth;
            });
        }
    };

    // 다음 달로 이동 가능한지 확인 (현재 달보다 미래가 아닌지)
    const canMoveToNextMonth = () => {
        const nextMonth = inputMonth === 12 ? 1 : inputMonth + 1;
        const nextYear = inputMonth === 12 ? currentYear + 1 : currentYear;
        return !(nextYear > currentYear || (nextYear === currentYear && nextMonth > currentMonth));
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

    // 프로그레스바 드래그 핸들러 (0~100% 범위)
    const handleProgressChange = (value) => {
        // 읽기 전용 모드에서는 변경 불가
        if (isReadOnly) return;

        const percentage = typeof value === 'number' ? value : parseFloat(value);
        // 100%를 초과하지 않도록 제한
        const clampedPercentage = Math.min(percentage, 100);
        const newActualValue = (targetValue * clampedPercentage) / 100;
        setFormData(prev => {
            const newData = {
                ...prev,
                actualValue: newActualValue.toFixed(taskMetric === 'percent' ? 2 : 0)
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


    // AI 기능 핸들러
    const handleSpellingCheck = async () => {
        if (!formData.activityContent.trim()) {
            alert('활동내역을 먼저 입력해주세요.');
            return;
        }

        try {
            setAiProcessing(true);
            setAiSuggestion(null);
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

    const handleRecommendActivity = async () => {
        const recentActivities = previousActivities.slice(0, 3)
            .map(a => `${a.activityYear}년 ${a.activityMonth}월: ${a.activityContent}`)
            .join('\n');

        try {
            setAiProcessing(true);
            setAiSuggestion(null);
            const recommendedText = await recommendActivity(task.name, recentActivities);
            setAiSuggestion(recommendedText);
            setAiSuggestionType('recommend');
        } catch (error) {
            console.error('활동내역 추천 실패:', error);
            alert('활동내역 추천 중 오류가 발생했습니다.');
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
        }
    };

    // AI 제안 거부
    const handleRejectSuggestion = () => {
        setAiSuggestion(null);
        setAiSuggestionType(null);
    };

    // AI 재생성
    const handleRegenerateSuggestion = () => {
        if (aiSuggestionType === 'spelling') {
            handleSpellingCheck();
        } else if (aiSuggestionType === 'recommend') {
            handleRecommendActivity();
        } else if (aiSuggestionType === 'improve') {
            handleImproveContext();
        }
    };

    // 파일 업로드 핸들러
    const handleFileUpload = async (e) => {
        const selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length === 0) return;

        // 활동내역이 저장되어 있지 않으면 먼저 저장
        if (!currentActivityId) {
            alert('먼저 활동내역을 저장해주세요.');
            e.target.value = ''; // 파일 선택 초기화
            return;
        }

        for (const file of selectedFiles) {
            try {
                setUploadingFiles(prev => [...prev, file.name]);
                await uploadActivityFile(currentActivityId, file, user.skid);
                await loadFiles(currentActivityId);
            } catch (error) {
                console.error('파일 업로드 실패:', error);
                alert(`파일 "${file.name}" 업로드 중 오류가 발생했습니다.`);
            } finally {
                setUploadingFiles(prev => prev.filter(name => name !== file.name));
            }
        }
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

        if (!formData.activityContent.trim()) {
            alert('활동내역을 입력해주세요.');
            return;
        }

        // 평가기준 확인
        const evaluationType = task?.performance?.evaluation || task?.performanceOriginal?.evaluation || task?.evaluationType || '';
        const isQuantitative = evaluationType === 'quantitative' || evaluationType === '정량';

        try {
            setSubmitting(true);

            // 활동내역 저장 (정량일 때만 actualValue 전송, 선택한 월 정보 포함)
            const response = await inputTaskActivity(task.id, user.skid, {
                activityContent: formData.activityContent,
                actualValue: isQuantitative && formData.actualValue ? parseFloat(formData.actualValue) : null,
                status: formData.status,
                year: currentYear,
                month: inputMonth
            });

            // 저장 후 activityId가 있으면 파일 목록 다시 로드
            if (response && response.activityId) {
                setCurrentActivityId(response.activityId);
                currentActivityIdRef.current = response.activityId; // ref 업데이트
                // 저장 후 시간 정보 업데이트 (updatedAt 우선, 없으면 createdAt)
                setActivityUpdatedAt(response.updatedAt || response.createdAt || new Date().toISOString());
                await loadFiles(response.activityId);
            }

            // 저장된 데이터로 캐시 업데이트
            const cacheKey = `${currentYear}-${inputMonth}`;
            setMonthlyInputCache(prev => ({
                ...prev,
                [cacheKey]: {
                    ...formData,
                    activityId: response?.activityId || currentActivityId
                }
            }));

            // 월별 실적값 다시 로드 (그래프 업데이트)
            const evaluationType = task?.performance?.evaluation || task?.performanceOriginal?.evaluation || task?.evaluationType || '';
            if (evaluationType === 'quantitative' || evaluationType === '정량') {
                await loadMonthlyActualValues();
            }

            alert('활동내역이 성공적으로 저장되었습니다.');
            onClose();
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
            '금액': 'amount',
            '%': 'percent',
            'count': 'count',
            'amount': 'amount',
            'percent': 'percent'
        };
        return metricMap[metric] || 'percent';
    };

    // 성과지표에 따른 단위 설정 (정규화된 영어 값 받음)
    const getMetricUnit = (normalizedMetric) => {
        const unitMap = {
            'count': '건',
            'amount': '원',
            'percent': '%'
        };
        return unitMap[normalizedMetric] || '%';
    };

    const getMetricLabel = (normalizedMetric) => {
        const labelMap = {
            'count': '건수',
            'amount': '금액',
            'percent': '%'
        };
        return labelMap[normalizedMetric] || '%';
    };

    // task의 metric 확인 (performanceOriginal.metric을 우선 사용)
    const rawMetric = task.performanceOriginal?.metric || task.performance?.metric || 'percent';
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

    // 목표값과 실적값
    // 목표값은 task에서 가져오고, 실적값은 월별로 저장된 값(formData.actualValue)을 우선 사용
    const targetValue = task?.targetValue != null && task.targetValue !== 0 ? parseFloat(task.targetValue) : 0;
    // 월별 실적값이 있으면 사용, 없으면 task의 실적값 사용 (호환성)
    const actualValue = formData.actualValue ? parseFloat(formData.actualValue) : (task?.actualValue != null && task.actualValue !== 0 ? parseFloat(task.actualValue) : 0);
    const achievement = task?.achievement != null ? parseFloat(task.achievement) : 0;

    // 달성률 계산 (목표값이 있을 때만, 실시간 업데이트)
    const calculatedAchievement = targetValue > 0 && actualValue > 0
        ? (actualValue / targetValue) * 100
        : 0;

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

    // 월별 실적 그래프 컴포넌트
    const MonthlyLineChart = ({ data, color, targetValue: chartTargetValue, metricUnit: chartMetricUnit }) => {
        if (!data || data.length === 0) return null;

        const width = 140;
        const height = 60;
        const padding = { top: 18, right: 5, bottom: 5, left: 5 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // 목표값과 실적값 중 최대값으로 정규화
        const maxActualValue = Math.max(...data.map(d => d.actualValue || 0), 0);
        const maxValue = Math.max(maxActualValue, chartTargetValue || 0, 1);

        const normalizedData = data.map(d => ({
            ...d,
            normalized: (d.actualValue || 0) / maxValue
        }));

        // 목표선 Y 좌표 계산
        const targetNormalized = chartTargetValue && maxValue > 0 ? chartTargetValue / maxValue : 0;
        const targetY = padding.top + chartHeight - (targetNormalized * chartHeight);

        // 점 좌표 계산
        const points = normalizedData.map((d, index) => {
            const x = padding.left + (index / (normalizedData.length - 1 || 1)) * chartWidth;
            const y = padding.top + chartHeight - (d.normalized * chartHeight);
            // 목표치 달성 여부 확인
            const isAchieved = chartTargetValue > 0 && d.actualValue >= chartTargetValue;
            return { x, y, value: d.actualValue, month: d.month, isAchieved };
        });

        // 경로 생성 (꺾은선)
        const pathData = points.map((point, index) => {
            return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
        }).join(' ');

        // 월 이름 배열
        const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

        return (
            <div className="monthly-chart-wrapper">
                <div className="monthly-chart-label">월별 실적 그래프</div>
                <div className="monthly-chart-svg-container"
                    onMouseLeave={() => setHoveredPoint(null)}>
                    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                        <defs>
                            <linearGradient id={`lineGradient-${task?.id || 'default'}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                                <stop offset="100%" stopColor={color} stopOpacity="0" />
                            </linearGradient>
                        </defs>

                        {/* 목표선 */}
                        {chartTargetValue > 0 && (
                            <>
                                <line
                                    x1={padding.left}
                                    y1={targetY}
                                    x2={width - padding.right}
                                    y2={targetY}
                                    stroke="#9ca3af"
                                    strokeWidth="1.5"
                                    strokeDasharray="3 3"
                                    opacity="0.6"
                                />
                                {/* 목표값 라벨 */}
                                <text
                                    x={width - padding.right - 2}
                                    y={targetY - 3}
                                    fontSize="9"
                                    fill="#6b7280"
                                    textAnchor="end"
                                    fontWeight="600"
                                >
                                    목표 {chartTargetValue.toLocaleString()}
                                </text>
                            </>
                        )}

                        {/* 영역 채우기 */}
                        <path
                            d={`${pathData} L ${points[points.length - 1].x} ${height - padding.bottom} L ${padding.left} ${height - padding.bottom} Z`}
                            fill={`url(#lineGradient-${task?.id || 'default'})`}
                        />

                        {/* 꺾은선 */}
                        <path
                            d={pathData}
                            fill="none"
                            stroke={color}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* 점 및 호버 영역 */}
                        {points.map((point, index) => {
                            const monthName = monthNames[point.month - 1] || `${point.month}월`;
                            const isHovered = hoveredPoint?.index === index;

                            return (
                                <g key={index}>
                                    {/* 호버 영역 (더 큰 원) */}
                                    <circle
                                        cx={point.x}
                                        cy={point.y}
                                        r="8"
                                        fill="transparent"
                                        onMouseEnter={() => setHoveredPoint({ index, ...point, monthName })}
                                        style={{ cursor: 'pointer' }}
                                    />

                                    {/* 목표 달성 시 강조 원 */}
                                    {point.isAchieved && (
                                        <circle
                                            cx={point.x}
                                            cy={point.y}
                                            r={isHovered ? "7" : "6"}
                                            fill="rgba(16, 185, 129, 0.15)"
                                            stroke="rgba(16, 185, 129, 0.3)"
                                            strokeWidth="1.5"
                                            style={{ transition: 'r 0.2s ease' }}
                                        />
                                    )}

                                    {/* 점 */}
                                    <circle
                                        cx={point.x}
                                        cy={point.y}
                                        r={isHovered ? "4" : (point.isAchieved ? "3.5" : "2.5")}
                                        fill={point.isAchieved ? "#10b981" : color}
                                        stroke="white"
                                        strokeWidth={isHovered ? "2" : (point.isAchieved ? "2" : "1")}
                                        style={{ transition: 'r 0.2s ease' }}
                                    />

                                    {/* 목표 달성 체크마크 */}
                                    {point.isAchieved && (
                                        <g transform={`translate(${point.x}, ${point.y})`}>
                                            <path
                                                d="M -3.5 -0.5 L -1 2 L 3.5 -2.5"
                                                stroke="white"
                                                strokeWidth="1.8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                fill="none"
                                            />
                                        </g>
                                    )}
                                </g>
                            );
                        })}
                    </svg>

                    {/* 툴팁 */}
                    {hoveredPoint && (
                        <div
                            className="monthly-chart-tooltip"
                            style={{
                                left: `${(hoveredPoint.x / 140) * 100}%`,
                                top: `${(hoveredPoint.y / 60) * 100 - 60}%`,
                                transform: 'translateX(-50%)'
                            }}
                        >
                            <div className="tooltip-month">
                                {hoveredPoint.monthName}
                                {hoveredPoint.isAchieved && (
                                    <span className="tooltip-achieved-badge">✓ 달성</span>
                                )}
                            </div>
                            <div className="tooltip-value">{hoveredPoint.value.toLocaleString()}{chartMetricUnit}</div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // 평가기준 확인
    const evaluationType = task?.performance?.evaluation || task?.performanceOriginal?.evaluation || task?.evaluationType || '';
    const isQuantitative = evaluationType === 'quantitative' || evaluationType === '정량';
    // 평가기준 텍스트 변환 (영어 -> 한글)
    let evaluationText = '-';
    if (task?.performance?.evaluation) {
        evaluationText = task.performance.evaluation === 'quantitative' ? '정량' :
            task.performance.evaluation === 'qualitative' ? '정성' :
                task.performance.evaluation;
    } else if (task?.performanceOriginal?.evaluation) {
        evaluationText = task.performanceOriginal.evaluation === 'quantitative' ? '정량' :
            task.performanceOriginal.evaluation === 'qualitative' ? '정성' :
                task.performanceOriginal.evaluation;
    } else if (task?.evaluationType) {
        evaluationText = task.evaluationType === 'quantitative' ? '정량' :
            task.evaluationType === 'qualitative' ? '정성' :
                task.evaluationType;
    }

    return (
        <div className="task-input-modal-overlay">
            <div className="task-input-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-content">
                        <div className="modal-header-top">
                            <h2 className="task-name-header">{task.name || task.taskName}</h2>
                        </div>
                        <div className="modal-header-badges">
                            {getStatusBadge(task.status)}
                            <span className={`task-input-evaluation-badge ${isQuantitative ? 'quantitative' : 'qualitative'}`}>
                                {evaluationText}
                            </span>
                            {task.startDate && task.endDate && (
                                <div className="task-period-info">
                                    <Calendar size={14} />
                                    <span className="task-period-text">
                                        {formatDate(task.startDate)} ~ {formatDate(task.endDate)}
                                    </span>
                                </div>
                            )}
                            {task.managers && task.managers.length > 0 && (
                                <div className="task-managers-info-inline">
                                    {getManagersByDept(task.managers).map((deptGroup, idx) => (
                                        <span key={idx} className="manager-dept-inline">
                                            <span className="dept-name-inline">{deptGroup.deptName}</span>
                                            <span className="dept-separator-inline">·</span>
                                            <span className="manager-names-inline">
                                                {deptGroup.managers.map((m, mIdx) => (
                                                    <span key={m.userId || mIdx}>
                                                        {m.mbName || '-'}
                                                        {mIdx < deptGroup.managers.length - 1 && ', '}
                                                    </span>
                                                ))}
                                            </span>
                                            {idx < getManagersByDept(task.managers).length - 1 && <span className="dept-separator-inline"> / </span>}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="modal-header-right">
                        <button className="close-btn" onClick={onClose}>
                            <X size={20} />
                        </button>
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
                                                title="이전 월"
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                            <span className="month-display-inline">
                                                {currentYear}년 {viewingMonth}월
                                            </span>
                                            <button
                                                type="button"
                                                className="month-nav-btn-inline"
                                                onClick={() => handleViewingMonthChange('next')}
                                                title="다음 월"
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                        <span className="read-only-badge">읽기 전용</span>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <h3>활동내역 입력 (필수)</h3>
                                        <div className="month-navigation-inline">
                                            <button
                                                type="button"
                                                className="month-nav-btn-inline"
                                                onClick={() => handleInputMonthChange('prev')}
                                                title="이전 월"
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                            <span className="month-display-inline">
                                                {currentYear}년 {inputMonth}월
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
                                    required={!isReadOnly}
                                    disabled={isReadOnly}
                                    readOnly={isReadOnly}
                                    className="activity-main-textarea"
                                />
                            </div>

                            {/* AI 기능 버튼 - 읽기 전용일 때 숨김 */}
                            {!isReadOnly && (
                                <div className="ai-actions">
                                    <button
                                        type="button"
                                        className="ai-btn"
                                        onClick={handleRecommendActivity}
                                        disabled={aiProcessing || previousActivities.length === 0}
                                    >
                                        <Sparkles size={16} />
                                        <span>지난달 기반 AI 추천</span>
                                    </button>
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
                                            {aiSuggestionType === 'recommend' && 'AI 활동내역 추천'}
                                            {aiSuggestionType === 'improve' && 'AI 문맥 교정 결과'}
                                        </span>
                                    </div>
                                    <div className="ai-suggestion-content">
                                        <div className="suggestion-text suggested">
                                            {aiSuggestion}
                                        </div>
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

                    {/* 첨부파일 섹션 */}
                    <section className="form-section file-section">
                        <div className="file-section-header">
                            <Paperclip size={14} />
                            <h3>첨부파일</h3>
                        </div>
                        <div className="file-section-content">
                            {!isReadOnly && (
                                <div className="file-upload-area">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        multiple
                                        style={{ display: 'none' }}
                                        disabled={!currentActivityId}
                                    />
                                    <button
                                        type="button"
                                        className="file-upload-btn"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={!currentActivityId || submitting}
                                    >
                                        <Upload size={14} />
                                        <span>파일 선택</span>
                                    </button>
                                    {!currentActivityId && (
                                        <span className="file-upload-hint">
                                            활동내역을 먼저 저장해주세요.
                                        </span>
                                    )}
                                </div>
                            )}

                            {uploadingFiles.length > 0 && (
                                <div className="file-uploading-list">
                                    {uploadingFiles.map((fileName, idx) => (
                                        <div key={idx} className="file-item uploading">
                                            <Paperclip size={14} />
                                            <span>{fileName}</span>
                                            <span className="uploading-text">업로드 중...</span>
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

                            {/* 활동내역이 저장된 경우: 파일이 없으면 "첨부파일 없음" 표시 */}
                            {files.length === 0 && uploadingFiles.length === 0 && currentActivityId && (
                                <div className="file-empty-state">
                                    <Paperclip size={14} />
                                    <span>첨부파일 없음</span>
                                </div>
                            )}

                            {/* 읽기 전용 모드: 활동내역이 없는 경우에도 "첨부파일 없음" 표시 */}
                            {isReadOnly && !currentActivityId && files.length === 0 && uploadingFiles.length === 0 && (
                                <div className="file-empty-state">
                                    <Paperclip size={14} />
                                    <span>첨부파일 없음</span>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 목표 대비 실적 - 정량 평가일 때만 표시 */}
                    {isQuantitative && (
                        <section className="performance-section-compact">
                            <div className="performance-compact-header">
                                <TrendingUp size={14} />
                                <h3>목표 대비 실적</h3>
                            </div>

                            <div className="performance-compact-row">
                                {/* 프로그레스바 - 작게 */}
                                <div className="performance-slider-wrapper">
                                    <div className="performance-slider-compact">
                                        {isReadOnly ? (
                                            <div className="progress-readonly-track-small">
                                                <div
                                                    className="progress-readonly-fill-small"
                                                    style={{
                                                        width: `${Math.min(calculatedAchievement, 100)}%`,
                                                        backgroundColor: progressColor
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <Slider
                                                min={0}
                                                max={100}
                                                step={taskMetric === 'percent' ? 0.1 : 0.5}
                                                value={targetValue > 0 ? Math.min((actualValue / targetValue) * 100, 100) : 0}
                                                onChange={handleProgressChange}
                                                disabled={isReadOnly}
                                                trackStyle={{ backgroundColor: progressColor, height: '3px' }}
                                                handleStyle={{
                                                    borderColor: progressColor,
                                                    backgroundColor: progressColor,
                                                    width: '12px',
                                                    height: '12px',
                                                    marginTop: '-4.5px',
                                                    borderWidth: '2px'
                                                }}
                                                railStyle={{ height: '3px' }}
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* 실적값 - 목표/달성률과 동일한 박스 스타일 */}
                                <div className="performance-actual-compact">
                                    <span className="performance-actual-label-compact">{isReadOnly ? `${viewingMonth}월 실적` : `${inputMonth}월 실적`}</span>
                                    {isReadOnly ? (
                                        <span className="performance-actual-value-compact">{actualValue ? parseFloat(actualValue).toLocaleString() : '0'}{metricUnit}</span>
                                    ) : (
                                        <input
                                            type="number"
                                            name="actualValue"
                                            value={formData.actualValue || ''}
                                            onChange={handleChange}
                                            placeholder="0"
                                            step={taskMetric === 'percent' ? '0.01' : '1'}
                                            min="0"
                                            max={targetValue || undefined}
                                            disabled={isReadOnly}
                                            readOnly={isReadOnly}
                                            className="performance-actual-value-compact-input"
                                        />
                                    )}
                                </div>

                                {/* 목표값 */}
                                <div className="performance-target-compact">
                                    <span className="performance-target-label-compact">목표</span>
                                    <span className="performance-target-value-compact">{targetValue ? parseFloat(targetValue).toLocaleString() : '0'}{metricUnit}</span>
                                </div>

                                {/* 달성률 박스 */}
                                <div className="performance-achievement-compact">
                                    <span className="performance-achievement-label-compact">{isReadOnly ? `${viewingMonth}월 달성률` : `${inputMonth}월 달성률`}</span>
                                    <span
                                        className="performance-achievement-value-compact"
                                        style={{ color: progressColor }}
                                    >
                                        {calculatedAchievement.toFixed(1)}%
                                    </span>
                                </div>

                                {/* 월별 실적 그래프 */}
                                {monthlyActualValues.length > 0 && (
                                    <div className="monthly-chart-compact">
                                        <MonthlyLineChart
                                            data={monthlyActualValues}
                                            color={progressColor}
                                            targetValue={targetValue}
                                            metricUnit={metricUnit}
                                        />
                                    </div>
                                )}
                            </div>
                        </section>
                    )}

                    {/* 버튼 - 읽기 전용일 때는 닫기 버튼만 표시 */}
                    <div className="form-actions">
                        {isReadOnly ? (
                            <button type="button" className="btn-submit" onClick={onClose}>
                                닫기
                            </button>
                        ) : (
                            <>
                                <button type="button" className="btn-cancel" onClick={onClose}>
                                    취소
                                </button>
                                <button type="submit" className="btn-submit" disabled={submitting || loading}>
                                    {submitting ? '저장 중...' : '저장하기'}
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
