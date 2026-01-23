const DEFAULT_SITE_URL = "https://lingoisland.com";

const normalizeSiteUrl = (url: string) => url.replace(/\/+$/, "");

export const getSiteUrl = () => {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    DEFAULT_SITE_URL;

  return normalizeSiteUrl(rawUrl);
};

