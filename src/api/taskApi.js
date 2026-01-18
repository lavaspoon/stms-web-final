import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

/**
 * 과제 등록
 * @param {Object} taskData - 과제 데이터
 * @param {String} taskData.taskType - 과제 타입 (OI, 중점추진)
 * @param {String} taskData.category1 - 대주제
 * @param {String} taskData.category2 - 중주제
 * @param {String} taskData.taskName - 과제명
 * @param {String} taskData.description - 과제 설명
 * @param {String} taskData.startDate - 시작일 (YYYY-MM-DD)
 * @param {String} taskData.endDate - 종료일 (YYYY-MM-DD)
 * @param {Number} taskData.deptId - 부서 ID
 * @param {Array<String>} taskData.managerIds - 담당자 ID 목록
 * @param {String} taskData.performanceType - 성과 분류 (financial, nonFinancial)
 * @param {String} taskData.evaluationType - 평가 방법 (quantitative, qualitative)
 * @param {String} taskData.metric - 성과 지표 (count, amount, percent)
 * @returns {Promise} API 응답
 */
export const createTask = async (taskData) => {
    const response = await axios.post(`${API_BASE_URL}/tasks`, taskData);
    return response.data;
};

/**
 * 전체 과제 목록 조회
 * @returns {Promise} 과제 목록
 */
export const getAllTasks = async () => {
    const response = await axios.get(`${API_BASE_URL}/tasks`);
    return response.data;
};

/**
 * 과제 타입별 조회
 * @param {String} taskType - 과제 타입 (OI, 중점추진)
 * @param {String} userId - 사용자 ID (선택)
 * @param {String} role - 사용자 역할 (선택, 기본값: 담당자)
 * @returns {Promise} 과제 목록
 */
export const getTasksByType = async (taskType, userId = null, role = '담당자') => {
    const params = { type: taskType };
    if (userId) {
        params.userId = userId;
        params.role = role;
    }
    const response = await axios.get(`${API_BASE_URL}/tasks`, { params });
    return response.data;
};

/**
 * 과제 상세 조회
 * @param {Number} taskId - 과제 ID
 * @returns {Promise} 과제 상세 정보
 */
export const getTask = async (taskId) => {
    const response = await axios.get(`${API_BASE_URL}/tasks/${taskId}`);
    return response.data;
};

/**
 * 과제 수정
 * @param {Number} taskId - 과제 ID
 * @param {Object} taskData - 수정할 과제 데이터
 * @returns {Promise} API 응답
 */
export const updateTask = async (taskId, taskData) => {
    const response = await axios.put(`${API_BASE_URL}/tasks/${taskId}`, taskData);
    return response.data;
};

/**
 * 과제 삭제
 * @param {Number} taskId - 과제 ID
 * @returns {Promise} API 응답
 */
export const deleteTask = async (taskId) => {
    const response = await axios.delete(`${API_BASE_URL}/tasks/${taskId}`);
    return response.data;
};

/**
 * 과제 활동내역 입력
 * @param {Number} taskId - 과제 ID
 * @param {String} userId - 사용자 ID
 * @param {Object} activityData - 활동내역 데이터
 * @param {String} activityData.activityContent - 활동내역
 * @param {Number} activityData.targetValue - 목표(%)
 * @param {Number} activityData.actualValue - 실적(%)
 * @param {String} activityData.status - 진행 상태
 * @returns {Promise} API 응답
 */
export const inputTaskActivity = async (taskId, userId, activityData) => {
    const response = await axios.post(
        `${API_BASE_URL}/tasks/${taskId}/activity?userId=${userId}`,
        activityData
    );
    return response.data;
};

/**
 * 과제 활동내역 조회
 * @param {Number} taskId - 과제 ID
 * @returns {Promise} 활동내역 정보
 */
export const getTaskActivity = async (taskId) => {
    const response = await axios.get(`${API_BASE_URL}/tasks/${taskId}/activity`);
    return response.data;
};

/**
 * 이전 월 활동내역 조회 (참고용)
 * @param {Number} taskId - 과제 ID
 * @param {Number} limit - 조회할 개수 (기본값: 3)
 * @returns {Promise} 이전 활동내역 목록
 */
export const getPreviousActivities = async (taskId, limit = 3) => {
    const response = await axios.get(
        `${API_BASE_URL}/tasks/${taskId}/activity/previous?limit=${limit}`
    );
    return response.data;
};

/**
 * 1년치 월별 목표/실적 조회
 * @param {Number} taskId - 과제 ID
 * @param {Number} year - 년도
 * @returns {Promise} 1년치 월별 목표/실적 데이터
 */
export const getYearlyGoals = async (taskId, year) => {
    const response = await axios.get(
        `${API_BASE_URL}/tasks/${taskId}/yearly-goals?year=${year}`
    );
    return response.data;
};

/**
 * 1년치 월별 목표/실적 일괄 저장
 * @param {Number} taskId - 과제 ID
 * @param {Object} yearlyGoalData - 1년치 목표/실적 데이터
 * @param {Number} yearlyGoalData.year - 년도
 * @param {Array} yearlyGoalData.monthlyGoals - 월별 데이터 배열
 * @returns {Promise} API 응답
 */
export const saveYearlyGoals = async (taskId, yearlyGoalData) => {
    const response = await axios.post(
        `${API_BASE_URL}/tasks/${taskId}/yearly-goals`,
        yearlyGoalData
    );
    return response.data;
};

/**
 * 모든 월 활동내역 조회 (참고용)
 * @param {Number} taskId - 과제 ID
 * @param {Number} limit - 조회할 개수 (기본값: 12)
 * @returns {Promise} 활동내역 목록
 */
export const getAllPreviousActivities = async (taskId, limit = 12) => {
    const response = await axios.get(
        `${API_BASE_URL}/tasks/${taskId}/activity/previous?limit=${limit}`
    );
    return response.data;
};
