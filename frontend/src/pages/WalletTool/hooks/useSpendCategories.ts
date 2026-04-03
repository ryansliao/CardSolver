import { useQuery } from '@tanstack/react-query'
import { spendApi } from '../../../api/client'
import { queryKeys } from '../lib/queryKeys'

export function useSpendCategories() {
  return useQuery({
    queryKey: queryKeys.spend(),
    queryFn: spendApi.list,
  })
}
