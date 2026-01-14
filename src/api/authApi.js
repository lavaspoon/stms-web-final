import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080';

export const loginApi = async (skid) => {
    const response = await axios.get(`${API_BASE_URL}/auth/login`, {
        params: { skid }
    });
    return response.data;
};
