import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

export const getAllDepts = async () => {
    const response = await axios.get(`${API_BASE_URL}/depts`);
    return response.data;
};

export const getDeptMembers = async (deptId) => {
    const response = await axios.get(`${API_BASE_URL}/depts/${deptId}/members`);
    return response.data;
};

export const getAllMembers = async () => {
    const response = await axios.get(`${API_BASE_URL}/depts/members`);
    return response.data;
};
