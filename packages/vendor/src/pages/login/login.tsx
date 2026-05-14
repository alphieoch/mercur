import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { SignInPage } from "@components/ui/sign-in";
import { useSignInWithEmailPass } from "@hooks/api";
import { isFetchError } from "@lib/is-fetch-error";

const FARM_TESTIMONIALS = [
  {
    avatarSrc: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&auto=format&fit=crop&q=80",
    name: "Sarah Chen",
    handle: "Green Acres Farm",
    text: "Since joining, we've tripled our direct sales and built lasting relationships with local customers.",
  },
  {
    avatarSrc: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
    name: "Marcus Johnson",
    handle: "Sunrise Dairy",
    text: "The platform makes it so easy to manage orders and communicate with buyers. Best decision we made.",
  },
  {
    avatarSrc: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80",
    name: "David Martinez",
    handle: "Heritage Orchard",
    text: "We went from selling at one farmers market to reaching customers across the region in just 3 months.",
  },
];

const HERO_IMAGE = "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1200&auto=format&fit=crop&q=80";

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const reason = searchParams.get("reason") || "";
  const reasonMessage =
    reason && reason.toLowerCase() === "unauthorized"
      ? "Session expired. Please sign in again."
      : "";

  const { mutateAsync, isPending } = useSignInWithEmailPass();

  const handleSignIn = async ({
    email,
    password,
  }: {
    email: string
    password: string
    rememberMe: boolean
  }) => {
    setServerError(null);
    try {
      await mutateAsync(
        { email, password },
        {
          onError: (error) => {
            if (isFetchError(error)) {
              if (error.status === 401) {
                setServerError(error.message || "Invalid email or password");
                return;
              }
            }
            setServerError(error.message || "An error occurred");
          },
          onSuccess: () => {
            setTimeout(() => {
              navigate("/store-select", {
                replace: true,
                state: { email },
              });
            }, 600);
          },
        }
      );
    } catch (error: any) {
      // Error handled in onError callback
    }
  };

  return (
    <SignInPage
      title={
        <span className="font-light tracking-tighter">
          Welcome back
        </span>
      }
      description="Sign in to manage your farm store, track orders, and connect with customers."
      heroImageSrc={HERO_IMAGE}
      testimonials={FARM_TESTIMONIALS}
      onSignIn={handleSignIn}
      onResetPassword={() => navigate("/reset-password")}
      onCreateAccount={() => navigate("/register")}
      isLoading={isPending}
      serverError={serverError || reasonMessage || null}
      storefrontUrl={(import.meta as any).env?.VITE_MERCUR_STOREFRONT_URL || "http://localhost:3000"}
    />
  );
};
