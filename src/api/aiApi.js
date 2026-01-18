import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api/ai';

/**
 * 맞춤법 검사
 * @param {String} text - 검사할 텍스트
 * @returns {Promise<String>} 맞춤법이 교정된 텍스트
 */
export const checkSpelling = async (text) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/spelling-check`, {
            text
        });
        return response.data.result;
    } catch (error) {
        console.error('맞춤법 검사 실패:', error);
        throw error;
    }
};

/**
 * 활동내역 추천
 * @param {String} taskName - 과제명
 * @param {String} previousActivities - 이전 활동내역들
 * @returns {Promise<String>} 추천된 활동내역
 */
export const recommendActivity = async (taskName, previousActivities) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/recommend-activity`, {
            taskName,
            previousActivities
        });
        return response.data.result;
    } catch (error) {
        console.error('활동내역 추천 실패:', error);
        throw error;
    }
};

/**
 * 문맥 교정
 * @param {String} text - 교정할 텍스트
 * @returns {Promise<String>} 문맥이 교정된 텍스트
 */
export const improveContext = async (text) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/improve-context`, {
            text
        });
        return response.data.result;
    } catch (error) {
        console.error('문맥 교정 실패:', error);
        throw error;
    }
};

/**
 * 전체 과제 브리핑 생성
 * @param {Array} tasks - 전체 과제 목록
 * @returns {Promise<Object>} 브리핑 결과 { summary, highlights, concerns, recommendations }
 */
export const generateBriefing = async (tasks) => {
    try {
        const response = await axios.post(`${API_BASE_URL}/generate-briefing`, {
            tasks
        });
        return response.data;
    } catch (error) {
        console.error('브리핑 생성 실패:', error);
        throw error;
    }
};
