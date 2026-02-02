const DEFAULT_SITE_URL = "https://lingoisland.com";

const normalizeSiteUrl = (url: string) => {
  // Remove trailing slashes
  let normalized = url.replace(/\/+$/, "");
  
  // Remove www. from the URL for canonical consistency
  normalized = normalized.replace(/\/\/www\./, '//');
  
  return normalized;
};

export const getSiteUrl = () => {
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    DEFAULT_SITE_URL;

  return normalizeSiteUrl(rawUrl);
};

export const getCanonicalUrl = (path: string = '') => {
  const siteUrl = getSiteUrl();
  const cleanPath = path.replace(/^\/+/, ''); // Remove leading slashes
  return cleanPath ? `${siteUrl}/${cleanPath}` : siteUrl;
};

