import { useQuery } from '@tanstack/react-query'
import { userSpendCategoriesApi, type UserSpendCategory } from '../api/client'
import { queryKeys } from '../lib/queryKeys'

export function useUserSpendCategories() {
  return useQuery<UserSpendCategory[]>({
    queryKey: queryKeys.userSpendCategories(),
    queryFn: userSpendCategoriesApi.listForInput,
    staleTime: Infinity,
  })
}
