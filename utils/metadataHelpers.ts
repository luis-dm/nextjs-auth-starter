import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export const buildI18nMetadata = async (
  locale: string,
  namespace: string
): Promise<Metadata> => {
  const t = await getTranslations({ locale, namespace })
  const title = t('title')
  const description = t('description')

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export const makeGenerateMetadata =
  (namespace: string) =>
  async ({ params }: { params: Promise<{ locale: string }> }) => {
    const { locale } = await params

    return buildI18nMetadata(locale, namespace)
  }
