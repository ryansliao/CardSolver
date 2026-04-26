import { useQuery } from '@tanstack/react-query'
import { walletApi } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { queryKeys } from '../../../lib/queryKeys'

/**
 * Returns the user's single wallet (auto-created on first call) along with
 * its owned ``card_instances`` and ``scenarios`` summaries.
 */
export function useMyWallet() {
  const { isAuthenticated } = useAuth()

  return useQuery({
    queryKey: queryKeys.myWalletWithScenarios(),
    queryFn: () => walletApi.get(),
    enabled: isAuthenticated,
  })
}
