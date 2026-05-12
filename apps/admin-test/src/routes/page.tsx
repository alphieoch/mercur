import { useEffect } from "react";

const STOREFRONT_URL =
  typeof __STOREFRONT_URL__ !== "undefined"
    ? __STOREFRONT_URL__
    : "http://localhost:3000";

export default function StorefrontRedirect() {
  useEffect(() => {
    window.location.href = STOREFRONT_URL;
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <p>Redirecting to storefront…</p>
      <a href={STOREFRONT_URL}>Click here if you are not redirected.</a>
    </div>
  );
}
