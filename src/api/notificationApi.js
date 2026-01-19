import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

/**
 * 미입력된 과제 목록 조회 (관리자용)
 * @param {String} gubun - OI 또는 중점추진
 * @returns {Promise} 과제 목록
 */
export const getNotInputtedTasks = async (gubun) => {
    const response = await axios.get(`${API_BASE_URL}/notifications/not-inputted?gubun=${gubun}`);
    return response.data;
};

/**
 * 선택된 과제에 대한 알림 전송 (관리자용)
 * @param {Object} request - 알림 요청 데이터
 * @param {String} request.gubun - OI 또는 중점추진
 * @param {Array<Number>} request.taskIds - 선택된 과제 ID 목록
 * @returns {Promise} API 응답
 */
export const sendNotifications = async (request) => {
    const response = await axios.post(`${API_BASE_URL}/notifications/send`, request);
    return response.data;
};

/**
 * 개별 알림 재전송 (관리자용)
 * @param {Number} notificationId - 알림 ID
 * @returns {Promise} API 응답
 */
export const resendNotification = async (notificationId) => {
    const response = await axios.post(`${API_BASE_URL}/notifications/${notificationId}/resend`);
    return response.data;
};

/**
 * 전체 알림 목록 조회 (관리자용, 페이징)
 * @param {Number} page - 페이지 번호 (0부터 시작)
 * @param {Number} size - 페이지 크기
 * @returns {Promise} 페이징된 알림 목록
 */
export const getAllNotifications = async (page = 0, size = 10) => {
    const response = await axios.get(`${API_BASE_URL}/notifications?page=${page}&size=${size}`);
    return response.data;
};

/**
 * 사용자별 알림 목록 조회
 * @param {String} skid - 사용자 ID
 * @returns {Promise} 알림 목록
 */
export const getNotificationsByUser = async (skid) => {
    const response = await axios.get(`${API_BASE_URL}/notifications/user?skid=${skid}`);
    return response.data;
};
