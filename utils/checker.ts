export const checkEnv = (key: string): string => {
  const variable = process.env[key]
  if (typeof variable === 'string') {
    return variable
  } else {
    throw new Error(`Error:${key} is undefined.`)
  }
}
