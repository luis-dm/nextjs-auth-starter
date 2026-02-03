import type { Metadata } from "next";

export const buildI18nMetadata = async (
  locale: string,
  namespace: string,
): Promise<Metadata> => {
  const title = "title";
  const description = "description";

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
};

export const makeGenerateMetadata =
  (namespace: string) =>
  async ({ params }: { params: Promise<{ locale: string }> }) => {
    const { locale } = await params;

    return buildI18nMetadata(locale, namespace);
  };
