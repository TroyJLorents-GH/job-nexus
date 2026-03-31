import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '../services/api'

export interface VmDocument {
  id: string
  filename?: string
  name?: string
  uploadedAt?: string
  fullText?: string
  extractedText?: string
}

export const docKeys = {
  all: ['documents'] as const,
  list: () => [...docKeys.all, 'list'] as const,
  detail: (id: string) => [...docKeys.all, id] as const,
}

export const useDocuments = () => {
  return useQuery({
    queryKey: docKeys.list(),
    queryFn: async (): Promise<VmDocument[]> => {
      const resp = await apiFetch('/vm-documents')
      const data = await resp.json()
      return Array.isArray(data.documents) ? data.documents : Array.isArray(data) ? data : []
    },
  })
}

export const useUploadDocument = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const resp = await apiFetch('/vm-analyze', { method: 'POST', body: form })
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error || 'Upload failed')
      }
      return resp.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docKeys.list() })
    },
  })
}

export const useDeleteDocument = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const resp = await apiFetch(`/vm-documents?id=${id}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error('Delete failed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: docKeys.list() })
    },
  })
}
