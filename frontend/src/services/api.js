import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Extract a structured, user-friendly error object from an Axios or fetch error.
 */
export function normalizeApiError(error) {
  if (error?.response?.data) {
    const data = error.response.data
    return {
      status: error.response.status,
      message: data.detail || data.message || 'An unexpected server error occurred.',
      errorCode: data.error_code || 'API_ERROR',
      missingKeys: data.missing_keys || [],
    }
  }
  if (error?.message) {
    return {
      status: error.status || 0,
      message: error.message,
      errorCode: error.errorCode || 'NETWORK_ERROR',
      missingKeys: error.missingKeys || [],
    }
  }
  return {
    status: 0,
    message: 'Unable to reach ResearchPilot backend service.',
    errorCode: 'NETWORK_ERROR',
    missingKeys: [],
  }
}

export async function fetchHealth() {
  const { data } = await apiClient.get('/health')
  return data
}

export async function runResearch(payload) {
  const { data } = await apiClient.post('/research', payload)
  return data
}

export async function runFollowUp(payload) {
  const { data } = await apiClient.post('/research/follow-up', payload)
  return data
}

export async function fetchHistory(query = '') {
  const params = query ? { q: query } : {}
  const { data } = await apiClient.get('/research/history', { params })
  return data
}

export async function fetchReport(researchId) {
  const { data } = await apiClient.get(`/research/${encodeURIComponent(researchId)}`)
  return data
}

export async function deleteReport(researchId) {
  const { data } = await apiClient.delete(`/research/${encodeURIComponent(researchId)}`)
  return data
}

export function getReportPdfUrl(researchId) {
  return `${API_BASE_URL}/research/${encodeURIComponent(researchId)}/pdf`
}

export async function downloadReportPdf(researchId, filenameSlug = 'research-report') {
  const response = await apiClient.get(`/research/${encodeURIComponent(researchId)}/pdf`, {
    responseType: 'blob',
  })
  const blob = new Blob([response.data], { type: 'application/pdf' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `${filenameSlug}.pdf`)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

/**
 * Streams real-time SSE events from POST /api/research/stream or /api/research/follow-up/stream.
 */
export async function streamResearchRequest(endpoint, payload, { onStep, onComplete, onError, signal }) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    let errorBody = {}
    try {
      errorBody = await response.json()
    } catch {
      errorBody = { detail: `Request failed with status ${response.status}` }
    }
    const err = {
      status: response.status,
      message: errorBody.detail || errorBody.message || 'Research request failed.',
      errorCode: errorBody.error_code || 'API_ERROR',
      missingKeys: errorBody.missing_keys || [],
    }
    onError?.(err)
    throw err
  }

  if (!response.body) {
    const err = {
      status: 500,
      message: 'Streaming response body unavailable.',
      errorCode: 'STREAM_ERROR',
      missingKeys: [],
    }
    onError?.(err)
    throw err
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() || ''

    for (const block of blocks) {
      if (!block.trim()) continue
      const lines = block.split('\n')
      let eventType = 'message'
      const dataLines = []

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim())
        }
      }

      if (dataLines.length === 0) continue
      const rawJson = dataLines.join('\n')
      let parsed
      try {
        parsed = JSON.parse(rawJson)
      } catch {
        continue
      }

      if (eventType === 'step') {
        onStep?.(parsed)
      } else if (eventType === 'complete') {
        onComplete?.(parsed.report)
        return parsed.report
      } else if (eventType === 'error') {
        const err = {
          status: parsed.status_code || 500,
          message: parsed.message || 'Agent workflow failed.',
          errorCode: parsed.error_code || 'WORKFLOW_ERROR',
          missingKeys: parsed.missing_keys || [],
        }
        onError?.(err)
        throw err
      }
    }
  }
}
