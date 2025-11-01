import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

export const uploadCode = async (formData) => {
  const response = await api.post('/api/reviews', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

export const getReview = async (id) => {
  const response = await api.get(`/api/reviews/${id}`)
  return response.data
}

export const getAllReviews = async () => {
  const response = await api.get('/api/reviews')
  return response.data
}

export const updateReview = async (id, data) => {
  const response = await api.put(`/api/reviews/${id}`, data)
  return response.data
}

export default api

