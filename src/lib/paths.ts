// The app can be mounted at the site root (local) or under a prefix (/interviewace on the live server).
// Links and redirects are built from wherever it is mounted, never from "/", which could be another site.
export const appBase = () =>
  window.location.pathname
    .replace(/\/(practice|hiring|join)\/?$/, "")
    .replace(/\/$/, "");
export const homePath = () => `${appBase()}/`;
export const appPath = (to: "practice" | "hiring") => `${appBase()}/${to}`;
