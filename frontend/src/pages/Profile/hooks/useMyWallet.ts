import { useQuery } from '@tanstack/react-query'
import { walletsApi } from '../../../api/client'
import { useAuth } from '../../../auth/AuthContext'
import { queryKeys } from '../../RoadmapTool/lib/queryKeys'

export function useMyWallet() {
  const { isAuthenticated } = useAuth()

  return useQuery({
    queryKey: queryKeys.myWallet(),
    queryFn: () => walletsApi.getMyWallet(),
    enabled: isAuthenticated,
  })
}
