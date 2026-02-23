import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

/**
 * KPI 이미지 업로드
 * @param {File} file - 업로드할 이미지 파일
 * @param {String} userId - 사용자 ID
 * @param {String} description - 설명 (선택)
 * @returns {Promise} 업로드된 이미지 정보
 */
export const uploadKpiImage = async (file, userId, description = '') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);
    if (description) {
        formData.append('description', description);
    }

    const response = await axios.post(`${API_BASE_URL}/kpi-images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

/**
 * 최신 KPI 이미지 정보 조회
 * @returns {Promise} 최신 이미지 정보 (없으면 null)
 */
export const getLatestKpiImage = async () => {
    const response = await axios.get(`${API_BASE_URL}/kpi-images/latest`);
    return response.data;
};

/**
 * KPI 이미지 목록 조회 (최신순)
 * @returns {Promise} 이미지 목록
 */
export const getAllKpiImages = async () => {
    const response = await axios.get(`${API_BASE_URL}/kpi-images`);
    return response.data;
};

/**
 * KPI 이미지 파일 URL 반환
 * @param {Number} imageId - 이미지 ID
 * @returns {String} 이미지 URL
 */
export const getKpiImageUrl = (imageId) => {
    return `${API_BASE_URL}/kpi-images/${imageId}/file`;
};

/**
 * KPI 이미지 삭제
 * @param {Number} imageId - 이미지 ID
 * @returns {Promise} API 응답
 */
export const deleteKpiImage = async (imageId) => {
    const response = await axios.delete(`${API_BASE_URL}/kpi-images/${imageId}`);
    return response.data;
};
