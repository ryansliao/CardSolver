import { useQuery } from '@tanstack/react-query'
import { creditsApi } from '../api/client'
import { queryKeys } from '../lib/queryKeys'

export function useCreditLibrary() {
  return useQuery({
    queryKey: queryKeys.credits(),
    queryFn: () => creditsApi.list(),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}
