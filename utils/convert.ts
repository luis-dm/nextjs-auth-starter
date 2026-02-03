/* クエリ文字列にコンバート */

export interface QueryParams {
  [key: string]: string | number | boolean | undefined | null
}

export const convertToQueryString = (params: QueryParams): string => {
  const queryString = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null) // nullまたはundefinedを除外
    .map(([key, value]) => {
      const encodedKey = encodeURIComponent(key)
      const encodedValue = encodeURIComponent(String(value)).replace(
        /%2B/g,
        '+'
      )
      return `${encodedKey}=${encodedValue}`
    })
    .join('&')

  return queryString ? queryString : ''
}
