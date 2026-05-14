import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Spinner } from "@medusajs/icons";

import { SignUpPage } from "@components/ui/sign-up";
import { useFeatureFlags, useSignUpWithEmailPass } from "@hooks/api";
import { MercurFeatureFlags } from "@mercurjs/types";

const REGISTER_DRAFT_KEY = "mercur_register_draft";

const FARM_TESTIMONIALS = [
  {
    avatarSrc: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80",
    name: "Emily Parker",
    handle: "Willow Creek Farm",
    text: "I started selling my organic vegetables here and now I have a waitlist every harvest season!",
  },
  {
    avatarSrc: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
    name: "James Wilson",
    handle: "Red Barn Poultry",
    text: "The onboarding was smooth and we had our first orders within a week. Incredible platform.",
  },
  {
    avatarSrc: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
    name: "Maria Santos",
    handle: "Santos Family Vineyard",
    text: "Finally a marketplace that understands local producers. Our wine sales grew 5x in 6 months.",
  },
];

const HERO_IMAGE = "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&auto=format&fit=crop&q=80";

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const { feature_flags, isLoading } = useFeatureFlags();
  const { mutateAsync: signUp, isPending } = useSignUpWithEmailPass();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="text-ui-fg-interactive animate-spin" />
      </div>
    );
  }

  if (!feature_flags?.[MercurFeatureFlags.SELLER_REGISTRATION]) {
    return <Navigate to="/login" replace />;
  }

  const handleSignUp = async ({
    first_name,
    last_name,
    email,
    password,
  }: {
    first_name: string
    last_name: string
    email: string
    password: string
  }) => {
    setServerError(null);
    try {
      await signUp({ email, password });
      sessionStorage.setItem(
        REGISTER_DRAFT_KEY,
        JSON.stringify({ first_name, last_name, email })
      );
      navigate("/onboarding", { state: { email, first_name, last_name } });
    } catch (error: any) {
      setServerError(error?.message || "Failed to create account");
    }
  };

  return (
    <SignUpPage
      title={
        <span className="font-light tracking-tighter">
          Join our marketplace
        </span>
      }
      description="Create your seller account and start reaching customers who care about fresh, local produce."
      heroImageSrc={HERO_IMAGE}
      testimonials={FARM_TESTIMONIALS}
      onSignUp={handleSignUp}
      onSignIn={() => navigate("/login")}
      isLoading={isPending}
      serverError={serverError}
      storefrontUrl={(import.meta as any).env?.VITE_MERCUR_STOREFRONT_URL || "http://localhost:3000"}
    />
  );
};
